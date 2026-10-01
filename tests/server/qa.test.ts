import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestDb, type TestDb } from './helpers.js'
import { prepareQa, qaStreamHandler, resetQaRateLimiterForTest, type QaDeps } from '../../src/server/qa.js'
import { parseSseChunks } from '../../src/lib/ai/sse.js'
import type { ProviderSelection, QaStreamEvent } from '../../src/lib/ai/qa.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

/**
 * AI 问答编排层集成测试（PGlite）。
 * 分两段测：prepareQa = 全部业务校验（免费墙/上下文隔离/限流）；
 * qaStreamHandler = provider 连接（可 400 的错误）与流式转发。
 * 供应商选择（各家独立环境变量）在 tests/lib/ai/qa.test.ts 单测。
 */

const READY: ProviderSelection = {
  status: 'ready',
  provider: { id: 'zhipu', label: '智谱', baseUrl: 'https://ai.example/v4', apiKey: 'sk-test', model: 'test-model' },
}

/** 造一个流式 provider 响应：依次吐 deltas，最后 [DONE] */
function providerStream(deltas: string[], opts: { done?: boolean } = {}): typeof fetch {
  const enc = new TextEncoder()
  return vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const d of deltas) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`))
      }
      if (opts.done !== false) controller.enqueue(enc.encode('data: [DONE]\n\n'))
      controller.close()
    },
  }), { status: 200 })) as unknown as typeof fetch
}

/** 读干流并解析成事件列表 */
async function drain(stream: ReadableStream<Uint8Array>): Promise<QaStreamEvent[]> {
  const text = await new Response(stream).text()
  return parseSseChunks(text).frames.map(f => JSON.parse(f.data) as QaStreamEvent)
}

let t: TestDb
beforeEach(async () => {
  resetQaRateLimiterForTest()
  t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 10, 'Asia/Shanghai', 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b2', 'B2', 'cat-b')`)
  await t.db.execute(sql`
    insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values ('c1', 'b1', 'C1 独有题面：undo log 的作用', 'enumeration',
      ${'C1 独有题解 UNIQ-C1-DETAIL<!--advanced-->C1 进阶'}, '[]'::jsonb, 'MySQL 8', 'high')`)
  await t.db.execute(sql`
    insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values ('c2', 'b2', 'C2 独有题面 UNIQ-C2-QUESTION', 'enumeration',
      'C2 独有题解 UNIQ-C2-DETAIL', '[]'::jsonb, 'Redis 7', 'mid')`)
})
afterEach(async () => { await t.pg.close() })

function runner(): SqlRunner { return t.db as unknown as SqlRunner }

function deps(over: Partial<QaDeps> = {}): QaDeps {
  return {
    db: runner(), userId: 'u1', cardId: 'c1',
    history: [{ role: 'user', content: '这道题没看懂' }],
    selection: READY, fetchImpl: providerStream(['答']),
    now: () => 1_000,
    ...over,
  }
}

describe('prepareQa：业务校验（流开始之前，全部抛中文错误）', () => {
  test('selection=off → 抛下线提示（列出各家 key 变量名）', async () => {
    await expect(prepareQa(deps({
      selection: { status: 'off', message: 'AI 问答还没有配置（在环境变量里配 ZHIPU_API_KEY 或 DEEPSEEK_API_KEY 即可启用）' },
    }))).rejects.toThrow('ZHIPU_API_KEY 或 DEEPSEEK_API_KEY')
  })

  test('selection=misconfigured → 透传纯核拼好的中文消息', async () => {
    await expect(prepareQa(deps({
      selection: { status: 'misconfigured', message: 'AI_PROVIDER 指定了 deepseek，但还没有配 DEEPSEEK_API_KEY' },
    }))).rejects.toThrow('还没有配 DEEPSEEK_API_KEY')
  })

  test('题目不存在 → 抛「题目不存在或已下线」', async () => {
    await expect(prepareQa(deps({ cardId: 'nope' }))).rejects.toThrow('题目不存在或已下线')
  })

  test('历史末条不是 user → 抛「没有可回答的问题」', async () => {
    await expect(prepareQa(deps({ history: [{ role: 'assistant', content: 'a' }] })))
      .rejects.toThrow('没有可回答的问题')
  })

  test('未解锁块的卡 → 抛「还没有解锁」，且不打 provider、不开流', async () => {
    const fetchMock = vi.fn()
    await expect(qaStreamHandler(deps({ cardId: 'c2', fetchImpl: fetchMock as unknown as typeof fetch })))
      .rejects.toThrow('这个块还没有解锁')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('装配出的消息只含该卡（其他卡零泄漏）', async () => {
    const { messages, provider } = await prepareQa(deps({
      history: [
        { role: 'user', content: '第一问' },
        { role: 'assistant', content: '第一答' },
        { role: 'user', content: '追问' },
      ],
    }))
    expect(provider.id).toBe('zhipu')
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('C1 独有题面：undo log 的作用')
    expect(messages[0]?.content).toContain('UNIQ-C1-DETAIL')
    expect(messages[0]?.content).toContain('C1 进阶')
    expect(messages.slice(1)).toEqual([
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一答' },
      { role: 'user', content: '追问' },
    ])
    const blob = JSON.stringify(messages)
    expect(blob).not.toContain('UNIQ-C2-QUESTION')
    expect(blob).not.toContain('UNIQ-C2-DETAIL')
  })

  test('同一用户 1 分钟窗口内第 21 问被限流', async () => {
    for (let i = 0; i < 20; i++) {
      await expect(prepareQa(deps({ cardId: 'nope' }))).rejects.toThrow('题目不存在或已下线')
    }
    await expect(prepareQa(deps())).rejects.toThrow('提问太快了')
  })
})

describe('qaStreamHandler：连接 provider（仍可 400 的错误）', () => {
  test('网络异常 → 「X 连不上」且不返回流', async () => {
    const broken = vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(qaStreamHandler(deps({ fetchImpl: broken }))).rejects.toThrow('智谱 连不上')
  })

  test('provider 非 2xx → 抛错（供路由回 400，而不是开一个注定失败的流）', async () => {
    const s502 = vi.fn(async () => new Response('bad gateway', { status: 502 })) as unknown as typeof fetch
    await expect(qaStreamHandler(deps({ fetchImpl: s502 }))).rejects.toThrow('智谱 暂时不可用（HTTP 502）')
  })

  test('请求体带 stream:true，且只含该卡消息', async () => {
    const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close() },
    }), { status: 200 }))
    await qaStreamHandler(deps({ fetchImpl: fetchMock as unknown as typeof fetch }))
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    const body = JSON.parse(String(init.body)) as { stream: boolean; model: string; messages: unknown[] }
    expect(body.stream).toBe(true)
    expect(body.model).toBe('test-model')
    expect(JSON.stringify(body.messages)).not.toContain('UNIQ-C2-QUESTION')
  })
})

describe('qaStreamHandler：流式转发', () => {
  test('逐段转发 delta，最后 done', async () => {
    const stream = await qaStreamHandler(deps({
      fetchImpl: providerStream(['MVCC ', '就是', '多版本并发控制']),
    }))
    expect(await drain(stream)).toEqual([
      { type: 'delta', text: 'MVCC ' },
      { type: 'delta', text: '就是' },
      { type: 'delta', text: '多版本并发控制' },
      { type: 'done' },
    ])
  })

  test('provider 忽略 stream（回整包 JSON）→ 兜底一次性补齐', async () => {
    const nonStream = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '整包回答' } }] }), { status: 200 },
    )) as unknown as typeof fetch
    const events = await drain(await qaStreamHandler(deps({ fetchImpl: nonStream })))
    expect(events).toEqual([{ type: 'delta', text: '整包回答' }, { type: 'done' }])
  })

  test('一条增量都没有 → 带内 error（流已开始，HTTP 状态改不了了）', async () => {
    const empty = vi.fn(async () => new Response('data: [DONE]\n\n', { status: 200 })) as unknown as typeof fetch
    expect(await drain(await qaStreamHandler(deps({ fetchImpl: empty }))))
      .toEqual([{ type: 'error', message: 'AI 没有返回内容，换个问法试试' }])
  })

  test('流中途断裂 → 保留已吐内容，再补带内 error', async () => {
    const enc = new TextEncoder()
    // pull 驱动而非 start 里立刻 error：后者会丢弃已排队分片，
    // 模拟不出「数据先到、随后断连」的真实时序（第一次 read 拿到数据，第二次才炸）
    let pulled = 0
    const broken = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      pull(c) {
        if (pulled++ === 0) {
          c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"前半段"}}]}\n\n'))
        } else {
          c.error(new Error('socket hang up'))
        }
      },
    }), { status: 200 })) as unknown as typeof fetch

    const events = await drain(await qaStreamHandler(deps({ fetchImpl: broken })))
    expect(events[0]).toEqual({ type: 'delta', text: '前半段' })
    expect(events[1]).toEqual({ type: 'error', message: '智谱 连接中断，请重试' })
  })

  test('心跳与只带 role 的首帧不进事件流', async () => {
    const enc = new TextEncoder()
    const frames = [
      ': keep-alive\n\n',
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"真正内容"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const noisy = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(c) { for (const f of frames) c.enqueue(enc.encode(f)); c.close() },
    }), { status: 200 })) as unknown as typeof fetch

    expect(await drain(await qaStreamHandler(deps({ fetchImpl: noisy }))))
      .toEqual([{ type: 'delta', text: '真正内容' }, { type: 'done' }])
  })
})
