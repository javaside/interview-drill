import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { syncHandler } from '../../src/server/sync.js'
import { variantAt } from '../../src/server/replay.js'
import { loadCardSnapshots, type SqlRunner } from '../../src/server/db/adapters.js'
import type { Submission } from '../../src/server/types.js'
import type { DistractorPools, OptionKeyPoint } from '../../src/lib/options/types.js'
import { rat } from '../../src/lib/scheduler/types.js'
import { addDays } from '../../src/lib/scheduler/date.js'
import { localDateOf } from '../../src/server/time.js'

// 固定服务端时钟（上海 2026-09-21 11:00）——测试内所有相对日期都由它派生
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)

// 全测试共用的干扰项池：8 条同块假要点，够 enum（3 正确 + 6 干扰）抽取
const DISTRACTORS: OptionKeyPoint[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i}`, text: `distractor-${i}`, public: false, excludeAsDistractorFor: [],
}))
const POOL: DistractorPools = { sameBlock: DISTRACTORS, crossBlock: [], neighbor: [] }
const poolsOf = (): DistractorPools => POOL

function todayIso(tz = 'Asia/Shanghai'): string {
  return localDateOf(SERVER_NOW, tz)
}

type SeedOpts = { tz?: string; withPlan?: boolean }

async function seedDb(opts: SeedOpts = {}): Promise<TestDb> {
  const tz = opts.tz ?? 'Asia/Shanghai'
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', '2027-01-01', 45, ${tz}, 'free', '[]'::jsonb)`)
  await db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  await db.execute(sql`
    insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values ('c1', 'b1', 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
  const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
  for (let i = 0; i < 3; i++) {
    await db.execute(sql`
      insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
      values ('c1', ${`kp${i}`}, ${`point-${i}`}, ${src}::jsonb, false, '[]'::jsonb)`)
  }
  if (opts.withPlan) {
    const plan = JSON.stringify([todayIso(tz), addDays(todayIso(tz), 5)])
    await db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', 'c1', 'learning', 0, 1, ${plan}::jsonb, 0, 0, 'v1')`)
  }
  return t
}

// pglite 的 drizzle 实例结构上满足 SqlRunner，但 execute 泛型方差 TS 判为不兼容——
// 在测试边界统一收敛一次（与 db/client.ts 生产侧同款处理）
function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}

async function variantCorrectIndices(t: TestDb, reviewIndex: number): Promise<number[]> {
  const cards = await loadCardSnapshots(runner(t), ['c1'])
  return variantAt(cards.get('c1')!, POOL, rat(0, 1), 'u1', reviewIndex).correctIndices
}

function mkSelection(submissionId: string, cardId: string, selected: number[], reviewedAtMs = 1_000): Submission {
  return { submissionId, cardId, reviewedAtMs, kind: 'selection', selected }
}

async function syncViaApi(t: TestDb, userId: string, subs: Submission[], opts?: { serverNow?: number }) {
  return syncHandler(runner(t), userId, subs, { serverNow: opts?.serverNow ?? SERVER_NOW, poolsOf })
}

test('重复 submissionId 幂等：重试不写第二条日志，duplicated 上报（§11）', async () => {
  const t = await seedDb()
  try {
    const allCorrect = await variantCorrectIndices(t, 0)   // 首次复习 reviewIndex=0
    const sub = mkSelection('sub-1', 'c1', allCorrect)
    const r1 = await syncViaApi(t, 'u1', [sub])
    const r2 = await syncViaApi(t, 'u1', [sub])   // 超时重试
    expect(r2.duplicated).toEqual(['sub-1'])
    const logs = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from review_log`)
    expect(logs.rows[0]!.n).toBe(1)
    expect(r1.results[0]!.outcome.newS.num).toBeGreaterThan(0)
  } finally {
    await t.pg.close()
  }
})

test('乱序回传按 reviewedAt 排序重放，s 正确（§11）', async () => {
  const t = await seedDb()
  try {
    // 组内按 reviewedAt 升序：a(1000, 差) 在前 → reviewIndex 0；b(2000, 好) 在后 → reviewIndex 1
    const idx0 = await variantCorrectIndices(t, 0)
    const idx1 = await variantCorrectIndices(t, 1)
    const a = mkSelection('s-a', 'c1', [idx0[0]!], 1_000)   // 勾 1 对 → 1/3
    const b = mkSelection('s-b', 'c1', idx1, 2_000)         // 全对 → 3/3
    await syncViaApi(t, 'u1', [b, a])   // 乱序传入
    const rows = await t.db.execute<{ reviewed_at: string }>(sql`select reviewed_at from review_log order by reviewed_at`)
    expect(rows.rows).toHaveLength(2)
    // 先差(1/3,旧)后好(3/3,新) → weightedS([3/3, 1/3]) = 11/15
    const st = await t.db.execute<{ s_num: number; s_den: number }>(sql`select s_num, s_den from card_state where card_id='c1'`)
    expect(`${st.rows[0]!.s_num}/${st.rows[0]!.s_den}`).toBe('11/15')
  } finally {
    await t.pg.close()
  }
})

test('异常时钟被钳制并留痕（§11）', async () => {
  const t = await seedDb()
  try {
    const allCorrect = await variantCorrectIndices(t, 0)
    const future = mkSelection('s-f', 'c1', allCorrect, SERVER_NOW + 60 * 60_000)
    await syncViaApi(t, 'u1', [future])
    const rows = await t.db.execute<{ clock_clamped: string }>(sql`select clock_clamped from review_log`)
    expect(rows.rows[0]!.clock_clamped).toBe('future')
  } finally {
    await t.pg.close()
  }
})

test('离线跨日界：localDate 由服务端按用户时区判定（§11）', async () => {
  const t = await seedDb({ tz: 'Asia/Shanghai' })
  try {
    const allCorrect = await variantCorrectIndices(t, 0)
    // UTC 2026-09-21T17:00 = 上海 09-22：客户端以为自己刷的是 21 号
    const sub = mkSelection('s-tz', 'c1', allCorrect, Date.UTC(2026, 8, 21, 17, 0))
    await syncViaApi(t, 'u1', [sub], { serverNow: Date.UTC(2026, 8, 21, 18, 0) })
    const rows = await t.db.execute<{ local_date: string }>(sql`select local_date from review_log`)
    expect(rows.rows[0]!.local_date).toBe('2026-09-22')
  } finally {
    await t.pg.close()
  }
})

test('答错入队离线重放：服务端统一重排，plan 从明天起（§8.3）', async () => {
  const t = await seedDb({ withPlan: true })   // c1 有 plan=[今天, +5]
  try {
    const bad = mkSelection('s-x', 'c1', [], 1_000)   // 空勾 → 0 分（客户端应拦；服务端也要稳）
    await syncViaApi(t, 'u1', [bad])
    const st = await t.db.execute<{ plan: string[] }>(sql`select plan from card_state where card_id='c1'`)
    expect(st.rows[0]!.plan[0]!).not.toBe(todayIso())   // 绝不今天
  } finally {
    await t.pg.close()
  }
})
