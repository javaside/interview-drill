import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { syncHandler } from '../../src/server/sync.js'
import { buildDailyPayload } from '../../src/server/queue.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import { variantAt } from '../../src/server/replay.js'
import { loadCardSnapshots, type SqlRunner } from '../../src/server/db/adapters.js'
import type { Submission } from '../../src/server/types.js'
import type { DistractorPools, OptionKeyPoint } from '../../src/lib/options/types.js'
import { rat } from '../../src/lib/scheduler/types.js'
import { addDays } from '../../src/lib/scheduler/date.js'
import { localDateOf } from '../../src/server/time.js'

// 固定服务端时钟（上海 2026-09-21 11:00）——跨实例确定性测试的公共锚点
const FIXED_NOW = Date.UTC(2026, 8, 21, 3, 0)
const TZ = 'Asia/Shanghai'
const TODAY = localDateOf(FIXED_NOW, TZ)

const DISTRACTORS: OptionKeyPoint[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i}`, text: `distractor-${i}`, public: false, excludeAsDistractorFor: [],
}))
const POOL: DistractorPools = { sameBlock: DISTRACTORS, crossBlock: [], neighbor: [] }
const poolsOf = (): DistractorPools => POOL

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}

const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })

/** c1..c5：单块 5 张 enum 卡，各有当天计划 [today, +5]；答错的将是 c3。 */
async function seedOfflineScenario(): Promise<TestDb> {
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', '2027-01-01', 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  const plan = JSON.stringify([TODAY, addDays(TODAY, 5)])
  for (let n = 1; n <= 5; n++) {
    const id = `c${n}`
    await db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${id}, 'b1', 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
    for (let i = 0; i < 3; i++) {
      await db.execute(sql`
        insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
        values (${id}, ${`kp${i}`}, ${`${id}-point-${i}`}, ${src}::jsonb, false, '[]'::jsonb)`)
    }
    await db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', ${id}, 'learning', 0, 1, ${plan}::jsonb, 0, 0, 'v1')`)
  }
  return t
}

async function correctIndicesOf(t: TestDb, cardId: string, reviewIndex: number): Promise<number[]> {
  const cards = await loadCardSnapshots(runner(t), [cardId])
  return variantAt(cards.get(cardId)!, POOL, rat(0, 1), 'u1', reviewIndex).correctIndices
}

function sub(id: string, cardId: string, selected: number[], atMs: number): Submission {
  return { submissionId: id, cardId, reviewedAtMs: atMs, kind: 'selection', selected }
}

/**
 * 5 条提交：c1/c2/c4/c5 全对，c3 空勾（ratio<1/2 → 答错重排）。
 * reviewedAt 取 FIXED_NOW 前几秒——落在今天（localDate 由服务端按 reviewedAt 判定）。
 */
async function fiveSubmissions(t: TestDb): Promise<Submission[]> {
  const out: Submission[] = []
  for (let n = 1; n <= 5; n++) {
    const cardId = `c${n}`
    const atMs = FIXED_NOW - (10 - n) * 1000   // 递增，仍在今天
    if (n === 3) { out.push(sub(`s${n}`, cardId, [], atMs)); continue }
    const idx = await correctIndicesOf(t, cardId, 0)
    out.push(sub(`s${n}`, cardId, idx, atMs))
  }
  return out
}

test('§11 离线场景全链路：断网 5 张（含 1 答错）→ 乱序+重复回传 → s/计划/进度全部收敛', async () => {
  const t = await seedOfflineScenario()
  try {
    const subs = await fiveSubmissions(t)
    // 乱序 + 重复（s3 重试一次）
    const shuffled = [subs[2]!, subs[0]!, subs[2]!, subs[4]!, subs[1]!, subs[3]!]
    const r = await syncHandler(runner(t), 'u1', shuffled, { serverNow: FIXED_NOW, poolsOf })
    expect(r.duplicated).toEqual(['s3'])   // c3 的一条重试被去重

    // 5 条唯一日志（重复不入库）
    const logs = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from review_log`)
    expect(logs.rows[0]!.n).toBe(5)

    // c3 答错 → 服务端重排，计划从明天起（绝不今天）
    const c3 = await t.db.execute<{ plan: string[] }>(sql`select plan from card_state where card_id='c3'`)
    expect(c3.rows[0]!.plan[0]).not.toBe(TODAY)

    // 答对的 c1 消费了当天项 → 剩余计划首项 = +5
    const c1 = await t.db.execute<{ plan: string[] }>(sql`select plan from card_state where card_id='c1'`)
    expect(c1.rows[0]!.plan).toEqual([addDays(TODAY, 5)])

    // 进度分母当天写定：5 张刷完，done=5
    const p = await buildDailyPayload(payloadDepsOf(runner(t), 'u1', FIXED_NOW))
    expect(p.progress.done).toBe(5)
  } finally {
    await t.pg.close()
  }
})

test('§11 确定性（跨实例）：同一 inputs 在两个独立 pglite 上全流程结果逐字节相同', async () => {
  // 注：§11.3 原文"Node 与 headless 浏览器同构"属 4b UI 层验收；此处落服务端确定性的
  // 端到端形式（同输入 → 同输出），浏览器侧同构在 4b 补。
  const t1 = await seedOfflineScenario()
  const t2 = await seedOfflineScenario()
  try {
    const subs1 = await fiveSubmissions(t1)
    const subs2 = await fiveSubmissions(t2)
    const r1 = await syncHandler(runner(t1), 'u1', subs1, { serverNow: FIXED_NOW, poolsOf })
    const r2 = await syncHandler(runner(t2), 'u1', subs2, { serverNow: FIXED_NOW, poolsOf })
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))

    // 落库状态也逐字节一致
    const st1 = await t1.db.execute<{ card_id: string; s_num: number; s_den: number; plan: string[] }>(
      sql`select card_id, s_num, s_den, plan from card_state order by card_id`)
    const st2 = await t2.db.execute<{ card_id: string; s_num: number; s_den: number; plan: string[] }>(
      sql`select card_id, s_num, s_den, plan from card_state order by card_id`)
    expect(JSON.stringify(st1.rows)).toBe(JSON.stringify(st2.rows))
  } finally {
    await t1.pg.close()
    await t2.pg.close()
  }
})
