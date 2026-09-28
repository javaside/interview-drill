import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { requeueTodaysMissedCards, countTodayMisses } from '../../src/server/db/adapters.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'
import { localDateOf } from '../../src/server/time.js'
import { addDays } from '../../src/lib/scheduler/date.js'

const TZ = 'Asia/Shanghai'
const SERVER_NOW = Date.UTC(2026, 8, 28, 3, 0)
const TODAY = localDateOf(SERVER_NOW, TZ)
const TOMORROW = addDays(TODAY, 1)

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}
function plusDays(n: number): string {
  return addDays(TODAY, n)
}

/** 常备用户 + 3 卡（c0/c1 今天答错过，c2 今天答对），计划都在明天 */
async function seedMisses(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  for (const id of ['c0', 'c1', 'c2']) {
    await t.db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${id}, 'b1', 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
    await t.db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', ${id}, 'learning', 1, 2, ${JSON.stringify([TOMORROW])}::jsonb, 0, 1, 'v2')`)
  }
  // c0/c1 今天答错（2·correct < total），c2 今天答对
  const miss = sql`insert into review_log (id, submission_id, user_id, card_id, reviewed_at, local_date,
    correct_checked, wrong_checked, key_points_total, ready_by_date_at_review, daily_capacity_at_review,
    distractor_ids, clock_clamped, algo_version)
    values (${`r-${Math.random().toString(36).slice(2)}`}, ${`s-${Math.random().toString(36).slice(2)}`}, 'u1', 'c0', now(), ${TODAY},
      1, 3, 5, null, 45, '[]'::jsonb, null, 'v2')`
  await t.db.execute(miss)
  await t.db.execute(sql`
    insert into review_log (id, submission_id, user_id, card_id, reviewed_at, local_date,
      correct_checked, wrong_checked, key_points_total, ready_by_date_at_review, daily_capacity_at_review,
      distractor_ids, clock_clamped, algo_version)
    values ('r-c1', 's-c1', 'u1', 'c1', now(), ${TODAY},
      0, 2, 4, null, 45, '[]'::jsonb, null, 'v2')`)
  await t.db.execute(sql`
    insert into review_log (id, submission_id, user_id, card_id, reviewed_at, local_date,
      correct_checked, wrong_checked, key_points_total, ready_by_date_at_review, daily_capacity_at_review,
      distractor_ids, clock_clamped, algo_version)
    values ('r-c2', 's-c2', 'u1', 'c2', now(), ${TODAY},
      4, 0, 4, null, 45, '[]'::jsonb, null, 'v2')`)
  return t
}

test('再练错题：今天答错的卡被拉回今天，答对的不动', async () => {
  const t = await seedMisses()
  try {
    expect(await countTodayMisses(runner(t), 'u1', TODAY)).toBe(2)
    const n = await requeueTodaysMissedCards(runner(t), 'u1', TODAY)
    expect(n).toBe(2)
    const r = await t.db.execute<{ card_id: string; plan: string[] }>(sql`
      select card_id, plan from card_state order by card_id`)
    const byId = new Map(r.rows.map(row => [row.card_id, row.plan] as const))
    expect(byId.get('c0')).toEqual([TODAY])       // 答错 → 今天
    expect(byId.get('c1')).toEqual([TODAY])       // 答错 → 今天
    expect(byId.get('c2')).toEqual([plusDays(1)]) // 答对 → 明天不动
  } finally {
    await t.pg.close()
  }
})

test('再练错题幂等：再跑一遍没有卡可拉（plan 首项已是今天）', async () => {
  const t = await seedMisses()
  try {
    await requeueTodaysMissedCards(runner(t), 'u1', TODAY)
    expect(await requeueTodaysMissedCards(runner(t), 'u1', TODAY)).toBe(0)
  } finally {
    await t.pg.close()
  }
})
