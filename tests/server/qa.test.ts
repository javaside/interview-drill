import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestDb, type TestDb } from './helpers.js'
import { qaHandler, qaConfigOf, resetQaRateLimiterForTest } from '../../src/server/qa.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

/**
 * AI 问答编排层集成测试（PGlite）：免费墙（未解锁块不给问）、
 * 上下文只含目标卡（provider 请求体里没有其他卡的内容）、provider 错误映射、限流。
 */

const CONFIG = { baseUrl: 'https://ai.example/v4', apiKey: 'sk-test', model: 'test-model' }

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

function okFetch(answer = 'AI 回答'): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), { status: 200 })) as unknown as typeof fetch
}

function runner(): SqlRunner { return t.db as unknown as SqlRunner }

function call(over: Partial<Parameters<typeof qaHandler>[0]> = {}) {
  return qaHandler({
    db: runner(), userId: 'u1', cardId: 'c1',
    history: [{ role: 'user', content: '这道题没看懂' }],
    config: CONFIG, fetchImpl: okFetch(),
    now: () => 1_000,
    ...over,
  })
}

describe('qaHandler：配置与输入校验', () => {
  test('缺 AI_API_KEY → 中文配置提示', () => {
    expect(qaConfigOf({})).toBeNull()
    expect(qaConfigOf({ AI_API_KEY: '' })).toBeNull()
    expect(qaConfigOf({ AI_API_KEY: 'k' })).toEqual({
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'k', model: 'glm-4.7-flash',
    })
    expect(qaConfigOf({ AI_API_KEY: 'k', AI_BASE_URL: 'https://x/v1/', AI_MODEL: 'm' })).toEqual({
      baseUrl: 'https://x/v1', apiKey: 'k', model: 'm',
    })
  })

  test('config=null → 抛配置缺失（功能未配置时不打 provider）', async () => {
    await expect(call({ config: null })).rejects.toThrow('AI 问答还没有配置')
  })

  test('题目不存在 → 抛「题目不存在或已下线」', async () => {
    await expect(call({ cardId: 'nope' })).rejects.toThrow('题目不存在或已下线')
  })

  test('历史末条不是 user → 抛「没有可回答的问题」', async () => {
    await expect(call({ history: [{ role: 'assistant', content: 'a' }] }))
      .rejects.toThrow('没有可回答的问题')
  })
})

describe('qaHandler：免费墙与上下文隔离', () => {
  test('未解锁块的卡 → 抛「还没有解锁」，不打 provider', async () => {
    const fetchMock = vi.fn()
    await expect(call({ cardId: 'c2', fetchImpl: fetchMock as unknown as typeof fetch }))
      .rejects.toThrow('这个块还没有解锁')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('解锁卡：provider 请求只含该卡内容 + 该卡历史（其他卡零泄漏）', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '答' } }] }), { status: 200 }))
    const history = [
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一答' },
      { role: 'user', content: '追问' },
    ]
    const r = await call({ history, fetchImpl: fetchMock as unknown as typeof fetch })
    expect(r).toEqual({ answer: '答' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchMock as unknown as Mock).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ai.example/v4/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
    const body = JSON.parse(String(init.body)) as {
      model: string
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('test-model')
    // 系统提示 = 该卡题面 + 题解（入门/进阶），随后按序拼历史
    expect(body.messages[0]?.role).toBe('system')
    expect(body.messages[0]?.content).toContain('C1 独有题面：undo log 的作用')
    expect(body.messages[0]?.content).toContain('UNIQ-C1-DETAIL')
    expect(body.messages[0]?.content).toContain('C1 进阶')
    expect(body.messages.slice(1)).toEqual([
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一答' },
      { role: 'user', content: '追问' },
    ])
    // 隔离铁律：请求体里没有其他卡（c2）的题面/题解
    const blob = JSON.stringify(body)
    expect(blob).not.toContain('UNIQ-C2-QUESTION')
    expect(blob).not.toContain('UNIQ-C2-DETAIL')
  })
})

describe('qaHandler：provider 错误映射与限流', () => {
  test('网络异常 → 「AI 服务连不上」', async () => {
    const broken = vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(call({ fetchImpl: broken })).rejects.toThrow('AI 服务连不上')
  })

  test('非 2xx → HTTP 状态带进中文消息', async () => {
    const s502 = vi.fn(async () => new Response('bad gateway', { status: 502 })) as unknown as typeof fetch
    await expect(call({ fetchImpl: s502 })).rejects.toThrow('AI 服务暂时不可用（HTTP 502）')
  })

  test('2xx 但无内容 → 「AI 没有返回内容」', async () => {
    const empty = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    await expect(call({ fetchImpl: empty })).rejects.toThrow('AI 没有返回内容')
  })

  test('同一用户 1 分钟窗口内第 21 问被限流', async () => {
    for (let i = 0; i < 20; i++) {
      // 用不存在的卡快速穿到卡校验之前的限流闸（限流在读卡之前）
      await expect(call({ cardId: 'nope' })).rejects.toThrow('题目不存在或已下线')
    }
    await expect(call()).rejects.toThrow('提问太快了')
    // 换用户不受牵连（按 userId 隔离）
    await expect(call({ userId: 'u2' })).rejects.toThrow('用户设置缺失')   // u2 无设置行，证明已过限流闸
  })
})

type Mock = { mock: { calls: unknown[][] } }
