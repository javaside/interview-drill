import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { applyCram, type CramDeps } from '../../src/server/cram.js'
import { loadSettings } from '../../src/server/db/adapters.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'
import { localDateOf } from '../../src/server/time.js'
import { addDays } from '../../src/lib/scheduler/date.js'

const TZ = 'Asia/Shanghai'
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)
const TODAY = localDateOf(SERVER_NOW, TZ)

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}
function mkDeps(t: TestDb): CramDeps {
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

/** 常备用户（未设就绪日）+ b1（3 卡无状态）+ b2（2 卡带既有滚动计划） */
async function seedCramFixture(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1', 'b2'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a'), ('b2', 'B2', 'cat-b')`)
  for (let n = 0; n < 3; n++) await addCard(t, `b1-c${n}`, 'b1')
  for (let n = 0; n < 2; n++) {
    await addCard(t, `b2-c${n}`, 'b2')
    await t.db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', ${`b2-c${n}`}, 'learning', 1, 2, ${JSON.stringify([plusDays(2), plusDays(5)])}::jsonb, 1, 2, 'v1')`)
  }
  return t
}

async function plansOf(t: TestDb, pattern: string): Promise<Array<{ card_id: string; plan: string[] }>> {
  const r = await t.db.execute<{ card_id: string; plan: string[] }>(sql`
    select card_id, plan from card_state where card_id like ${pattern} order by card_id`)
  return r.rows
}

test('常备用户 cram：选中块重铺、就绪日=面试前一天、其他块计划逐字节不变（§5.8）', async () => {
  const t = await seedCramFixture()
  try {
    const b2Before = await plansOf(t, 'b2-c%')
    const r = await applyCram(mkDeps(t), 'u1', { examDate: plusDays(4), blockIds: ['b1'] })
    expect(r.crammed).toBe(3)
    expect(r.excluded).toBe(0)

    // 就绪日 = 面试前一天（冲刺窗口内 mode=sprint；面试过自动回常备）
    const s = await loadSettings(runner(t), 'u1')
    expect(s.readyByDate).toBe(plusDays(3))

    // 选中块 3 卡都有计划（阶梯、末次 ≤ 面试前一天）
    const b1Plans = await plansOf(t, 'b1-c%')
    expect(b1Plans).toHaveLength(3)
    for (const row of b1Plans) {
      expect(row.plan.length).toBeGreaterThan(0)
      for (const d of row.plan) expect(d <= plusDays(3)).toBe(true)
    }

    // 未选中块计划逐字节不变（§5.8 明文）
    expect(await plansOf(t, 'b2-c%')).toEqual(b2Before)
  } finally {
    await t.pg.close()
  }
})

test('E<1（面试就在明天）：窗口不足全排除，设置不动', async () => {
  const t = await seedCramFixture()
  try {
    const r = await applyCram(mkDeps(t), 'u1', { examDate: plusDays(1), blockIds: ['b1'] })
    expect(r.crammed).toBe(0)
    expect(r.excluded).toBe(3)
    const s = await loadSettings(runner(t), 'u1')
    expect(s.readyByDate).toBeNull()   // 常备空值不被覆盖
    expect(await plansOf(t, 'b1-c%')).toHaveLength(0)   // 无计划落盘
  } finally {
    await t.pg.close()
  }
})

test('块不在解锁集 → 拒绝（免费墙边界不被 cram 绕过）', async () => {
  const t = await seedCramFixture()
  try {
    await t.db.execute(sql`
      insert into blocks (id, name, category) values ('b3', 'B3', 'cat-c')`)
    await addCard(t, 'b3-c0', 'b3')
    await expect(applyCram(mkDeps(t), 'u1', { examDate: plusDays(4), blockIds: ['b3'] }))
      .rejects.toThrow()
  } finally {
    await t.pg.close()
  }
})
