import { sql } from 'drizzle-orm'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { createTestDb, type TestDb } from './helpers.js'
import { adminQaStreamHandler, resetAdminQaRateLimiterForTest, type AdminQaDeps } from '../../src/server/admin-qa.js'
import { QA_MAX_OUTPUT_TOKENS } from '../../src/lib/ai/qa.js'
import type { ProviderSelection, QaStreamEvent } from '../../src/lib/ai/qa.js'
import { parseSseChunks } from '../../src/lib/ai/sse.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

/**
 * 管理员审题编排层集成测试（PGlite）：与用户版的关键差异在这里钉住——
 * 无免费墙（无 settings 行的账号也能审）、上下文含答案（要点清单）与源文件路径。
 */

const READY: ProviderSelection = {
  status: 'ready',
  provider: {
    id: 'zhipu', label: '智谱', baseUrl: 'https://ai.example/v4',
    apiKey: 'sk-test', model: 'test-model',
    maxTokens: QA_MAX_OUTPUT_TOKENS, extraBody: {},
  },
}

let t: TestDb
beforeEach(async () => {
  resetAdminQaRateLimiterForTest()
  t = await createTestDb()
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  await t.db.execute(sql`
    insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values ('c1', 'b1', 'C1 题面', 'enumeration', 'C1 入门题解<!--advanced-->C1 进阶', '[]'::jsonb, 'Java', 'high')`)
  await t.db.execute(sql`
    insert into key_points (card_id, id, text, source, public, "order")
    values ('c1', 'kp-1', '要点一原文', '{"kind":"x","url":"u","locator":"l"}'::jsonb, true, 2)`)
  await t.db.execute(sql`
    insert into key_points (card_id, id, text, source, public, retired_at)
    values ('c1', 'kp-dead', '退役要点', '{"kind":"x","url":"u","locator":"l"}'::jsonb, true, '2026-01-01')`)
})
afterEach(async () => { await t.pg.close() })

function runner(): SqlRunner { return t.db as unknown as SqlRunner }

/** 抓 provider 请求体再回一段流，供断言装配的消息内容 */
function capturingProvider(): { fetchImpl: typeof fetch; calls: Array<{ model: string; messages: unknown[] }> } {
  const calls: Array<{ model: string; messages: unknown[] }> = []
  const enc = new TextEncoder()
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)) as { model: string; messages: unknown[] })
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: '审题意见' } }] })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }), { status: 200 })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

function deps(over: Partial<AdminQaDeps> = {}): AdminQaDeps {
  return {
    db: runner(), userId: 'boss', cardId: 'c1',
    history: [{ role: 'user', content: '这条要点对吗' }],
    selection: READY,
    loadDemoCode: () => null,
    ...over,
  }
}

describe('adminQaStreamHandler', () => {
  test('无 settings 行的账号也能审题（无免费墙、无配额依赖），消息含答案与源文件路径', async () => {
    const cap = capturingProvider()
    const stream = await adminQaStreamHandler(deps({ fetchImpl: cap.fetchImpl }))
    const events: QaStreamEvent[] = parseSseChunks(await new Response(stream).text()).frames
      .map(f => JSON.parse(f.data) as QaStreamEvent)
    expect(events.filter(e => e.type === 'delta').map(e => (e as { text: string }).text).join('')).toBe('审题意见')
    expect(events.at(-1)).toEqual({ type: 'done' })

    const body = cap.calls[0]!
    expect(body.model).toBe('test-model')
    const sys = (body.messages[0] as { role: string; content: string }).content
    expect(sys).toContain('要点清单（这就是答案')
    expect(sys).toContain('要点一原文')
    expect(sys).not.toContain('退役要点')   // 墓碑不进审题上下文
    expect(sys).toContain('# 源文件\ncontent/b1/c1.md')
    expect((body.messages[1] as { role: string }).role).toBe('user')
  })

  test('题目不存在 → 抛「题目不存在或已下线」', async () => {
    const cap = capturingProvider()
    await expect(adminQaStreamHandler(deps({ cardId: 'nope', fetchImpl: cap.fetchImpl })))
      .rejects.toThrow('题目不存在或已下线')
    expect(cap.calls).toHaveLength(0)
  })

  test('provider 非 2xx → 准备段抛中文（400 协议，未开流）', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 })) as unknown as typeof fetch
    await expect(adminQaStreamHandler(deps({ fetchImpl })))
      .rejects.toThrow('智谱 暂时不可用（HTTP 503）')
  })
})
