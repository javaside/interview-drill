import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { reviewHandler } from '../../src/server/review.js'
import { variantAt } from '../../src/server/replay.js'
import { loadCardSnapshots, type SqlRunner } from '../../src/server/db/adapters.js'
import type { Submission } from '../../src/server/types.js'
import type { DistractorPools, OptionKeyPoint } from '../../src/lib/options/types.js'
import { rat } from '../../src/lib/scheduler/types.js'
import { addDays } from '../../src/lib/scheduler/date.js'
import { localDateOf } from '../../src/server/time.js'

const TZ = 'Asia/Shanghai'
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)

const DISTRACTORS: OptionKeyPoint[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i}`, text: `distractor-${i}`, public: false, excludeAsDistractorFor: [],
}))
const POOL: DistractorPools = { sameBlock: DISTRACTORS, crossBlock: [], neighbor: [] }
const poolsOf = (): DistractorPools => POOL

function todayIso(): string {
  return localDateOf(SERVER_NOW, TZ)
}

type SeedOpts = { withPlan?: boolean }

async function seedDb(opts: SeedOpts = {}): Promise<TestDb> {
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', '2027-01-01', 45, ${TZ}, 'free', '[]'::jsonb)`)
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
    const plan = JSON.stringify([todayIso(), addDays(todayIso(), 5)])
    await db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', 'c1', 'learning', 0, 1, ${plan}::jsonb, 0, 0, 'v1')`)
  }
  return t
}

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

async function reviewViaApi(t: TestDb, userId: string, sub: Submission) {
  return reviewHandler(runner(t), userId, sub, { serverNow: SERVER_NOW, poolsOf })
}

test('在线刷一张卡：判分落库，返回 §6 屏②所需全部字段', async () => {
  const t = await seedDb({ withPlan: true })
  try {
    const idx = await variantCorrectIndices(t, 0)   // reviewCount=0 → 首次复习
    const r = await reviewViaApi(t, 'u1', mkSelection('r-1', 'c1', [idx[0]!, idx[1]!]))   // 勾 2 对 → 2/3
    expect(r.score).toEqual({ num: 2, den: 3 })
    expect(r.feedback.wrongChecked).toBe(0)
    expect(r.feedback.correctChecked).toBe(2)
    expect(r.feedback.missed).toBe(1)
    expect(typeof r.remainingReviews).toBe('number')
    expect(Array.isArray(r.remainingPlan)).toBe(true)
    const logs = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from review_log`)
    expect(logs.rows[0]!.n).toBe(1)
  } finally {
    await t.pg.close()
  }
})

test('答对不重排（I4）；答错重排且 replanned=true + 圆点换新', async () => {
  const t = await seedDb({ withPlan: true })
  try {
    const idx0 = await variantCorrectIndices(t, 0)
    const good = await reviewViaApi(t, 'u1', mkSelection('r-2', 'c1', idx0))   // 全对
    expect(good.replanned).toBe(false)
    // 第二次：reviewCount 已 +1 → reviewIndex=1
    const idx1 = await variantCorrectIndices(t, 1)
    const bad = await reviewViaApi(t, 'u1', mkSelection('r-3', 'c1', [idx1[0]!], 2_000))   // 勾 1 对 → 1/3 < 1/2
    expect(bad.replanned).toBe(true)
    expect(bad.remainingPlan[0]).not.toBe(todayIso())
  } finally {
    await t.pg.close()
  }
})

test('keyPointsTotal 快照：内容变更后历史分数不被静默改写（§8.1）', async () => {
  const t = await seedDb({ withPlan: true })
  try {
    const idx = await variantCorrectIndices(t, 0)
    await reviewViaApi(t, 'u1', mkSelection('r-4', 'c1', idx))
    // 要点 3 → 5（内容后续扩容）
    const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
    for (let i = 3; i < 5; i++) {
      await t.db.execute(sql`
        insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
        values ('c1', ${`kp${i}`}, ${`point-${i}`}, ${src}::jsonb, false, '[]'::jsonb)`)
    }
    const rows = await t.db.execute<{ key_points_total: number }>(sql`select key_points_total from review_log`)
    expect(rows.rows[0]!.key_points_total).toBe(3)   // 历史快照不被改写
  } finally {
    await t.pg.close()
  }
})
