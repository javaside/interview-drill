import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { applySettingsChange, applyBlockSelection, type ServerDeps } from '../../src/server/settings.js'
import { buildDailyPayload } from '../../src/server/queue.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'
import { localDateOf } from '../../src/server/time.js'
import { addDays } from '../../src/lib/scheduler/date.js'

const TZ = 'Asia/Shanghai'
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)
const TODAY = localDateOf(SERVER_NOW, TZ)

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}
function mkDeps(t: TestDb): ServerDeps {
  return { db: runner(t), serverNowMs: SERVER_NOW }
}
function plusDays(n: number): string {
  return addDays(TODAY, n)
}

const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
async function addCard(t: TestDb, cardId: string, blockId: string): Promise<void> {
  await t.db.execute(sql`
    insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values (${cardId}, ${blockId}, 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
  for (let i = 0; i < 3; i++) {
    await t.db.execute(sql`
      insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
      values (${cardId}, ${`${cardId}-k${i}`}, ${`${cardId}-pt-${i}`}, ${src}::jsonb, false, '[]'::jsonb)`)
  }
}

/** 3 卡都有计划（readyBy=+21d），验证设置变更触发重排 */
async function seedWithPlans(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', ${plusDays(21)}, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  for (let n = 0; n < 3; n++) {
    const id = `c${n}`
    await addCard(t, id, 'b1')
    const plan = JSON.stringify([plusDays(1), plusDays(6)])
    await t.db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, plan_generated_at, algo_version)
      values ('u1', ${id}, 'learning', 1, 2, ${plan}::jsonb, 0, 1, now(), 'v1')`)
  }
  return t
}

/** b1/b2 两块各 2 卡，都有计划（验证减块 pause、往返幂等） */
async function seedBlocksFixture(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', ${plusDays(21)}, 45, ${TZ}, 'free', ${JSON.stringify(['b1', 'b2'])}::jsonb)`)
  for (const b of ['b1', 'b2']) {
    await t.db.execute(sql`insert into blocks (id, name, category) values (${b}, ${b}, 'cat-a')`)
    for (let n = 0; n < 2; n++) {
      const id = `${b}-c${n}`
      await addCard(t, id, b)
      const plan = JSON.stringify([plusDays(1), plusDays(6)])
      await t.db.execute(sql`
        insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, plan_generated_at, algo_version)
        values ('u1', ${id}, 'learning', 1, 2, ${plan}::jsonb, 0, 1, now(), 'v1')`)
    }
  }
  return t
}

async function allPlans(t: TestDb): Promise<Record<string, string[]>> {
  const r = await t.db.execute<{ card_id: string; plan: string[] }>(sql`
    select card_id, plan from card_state order by card_id`)
  const out: Record<string, string[]> = {}
  for (const row of r.rows) out[row.card_id] = row.plan
  return out
}

test('readyByDate 变更：已有计划的卡全部重排（§5.5 条件 2）', async () => {
  const t = await seedWithPlans()
  try {
    const r = await applySettingsChange(mkDeps(t), 'u1', { readyByDate: plusDays(40) })
    expect(r.replanned).toBe(3)
    const rows = await t.db.execute<{ n: number }>(sql`
      select count(*)::int as n from card_state where plan_generated_at is not null`)
    expect(rows.rows[0]!.n).toBe(3)   // 重排后重新落盘
  } finally {
    await t.pg.close()
  }
})

test('dailyCapacity 变更同样触发重排（§5.5 条件 3）', async () => {
  const t = await seedWithPlans()
  try {
    const r = await applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 10 })
    expect(r.replanned).toBe(3)
  } finally {
    await t.pg.close()
  }
})

test('减块：目标块卡置 paused、plan 原样保留、不进今日队列（§5.5 / §11）', async () => {
  const t = await seedBlocksFixture()
  try {
    const r = await applyBlockSelection(mkDeps(t), 'u1', ['b1'])   // 减 b2
    expect(r.paused).toBe(2)
    const st = await t.db.execute<{ phase: string; plan: string[] }>(sql`
      select phase, plan from card_state where card_id like 'b2%'`)
    expect(st.rows[0]!.phase).toBe('paused')
    expect(st.rows[0]!.plan.length).toBeGreaterThan(0)   // plan 保留
    const p = await buildDailyPayload(payloadDepsOf(runner(t), 'u1', SERVER_NOW))
    expect(p.queue.every(q => !q.cardId.startsWith('b2'))).toBe(true)
  } finally {
    await t.pg.close()
  }
})

test('加→减→加 往返：计划与只加一次一致（§11）', async () => {
  const t = await seedBlocksFixture()
  try {
    const plans1 = await allPlans(t)
    await applyBlockSelection(mkDeps(t), 'u1', ['b1'])          // 减 b2
    await applyBlockSelection(mkDeps(t), 'u1', ['b1', 'b2'])    // 加回
    const plans2 = await allPlans(t)
    expect(plans2).toEqual(plans1)   // plan 保留未被重排（I4），往返逐字节一致
    const st = await t.db.execute<{ phase: string }>(sql`
      select phase from card_state where card_id like 'b2%'`)
    expect(st.rows.every(r => r.phase === 'learning')).toBe(true)   // 恢复为在学
  } finally {
    await t.pg.close()
  }
})
