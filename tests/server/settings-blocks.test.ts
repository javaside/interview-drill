import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { applySettingsChange, applyBlockSelection, type ServerDeps } from '../../src/server/settings.js'
import { loadSettings } from '../../src/server/db/adapters.js'
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

/** 常备用户（未设就绪日）+ 1 卡带滚动计划（维持模式的下次复习） */
async function seedSteadyWithRollingPlan(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  await addCard(t, 'c0', 'b1')
  await t.db.execute(sql`
    insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
    values ('u1', 'c0', 'learning', 1, 2, ${JSON.stringify([plusDays(1)])}::jsonb, 2, 1, 'v1')`)
  return t
}

test('常备模式（未设就绪日）改容量：不清空滚动计划（R-1 黑洞）', async () => {
  const t = await seedSteadyWithRollingPlan()
  try {
    const r = await applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 30 })
    expect(r.replanned).toBe(0)   // 常备模式：没有卡被「重排」
    const row = await t.db.execute<{ plan: string[] }>(sql`
      select plan from card_state where card_id = 'c0'`)
    expect(row.rows[0]!.plan).toEqual([plusDays(1)])   // 滚动计划原样保留
  } finally {
    await t.pg.close()
  }
})

/** done 存量卡（v1 毕业的）+ 常备用户：保存设置应复活 */
async function seedSteadyWithDoneCard(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  await addCard(t, 'c0', 'b1')
  await addCard(t, 'c1', 'b1')
  await t.db.execute(sql`
    insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
    values ('u1', 'c0', 'done', 0, 1, '[]'::jsonb, 0, 3, 'v1')`)
  return t
}

test('常备用户保存设置：存量 done 卡复活为 learning 且补种滚动计划（评审耦合点）', async () => {
  const t = await seedSteadyWithDoneCard()
  try {
    await applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 30 })
    const st = await t.db.execute<{ phase: string; plan: string[] }>(sql`
      select phase, plan from card_state where card_id = 'c0'`)
    expect(st.rows[0]!.phase).toBe('learning')   // 复活
    expect(st.rows[0]!.plan).toEqual([plusDays(1)])   // 补种 [today+interval(k)]——k=0 → 明天，不再是黑洞
  } finally {
    await t.pg.close()
  }
})

/** done 卡 + 未解锁块（b2 不在 free_block_ids）：复活范围按解锁块收敛 */
async function seedDoneOutsideEntitlement(): Promise<TestDb> {
  const t = await seedSteadyWithDoneCard()
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b2', 'B2', 'cat-b')`)
  await addCard(t, 'c9', 'b2')
  await t.db.execute(sql`
    insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
    values ('u1', 'c9', 'done', 0, 1, '[]'::jsonb, 0, 1, 'v1')`)
  return t
}

test('done 复活范围按解锁块收敛：未解锁块的 done 卡不动', async () => {
  const t = await seedDoneOutsideEntitlement()
  try {
    await applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 30 })
    const st = await t.db.execute<{ card_id: string; phase: string }>(sql`
      select card_id, phase from card_state order by card_id`)
    const byId = new Map(st.rows.map(r => [r.card_id, r.phase]))
    expect(byId.get('c0')).toBe('learning')   // 解锁块内复活
    expect(byId.get('c9')).toBe('done')       // 未解锁块不动（entitlement 外无意义）
  } finally {
    await t.pg.close()
  }
})

// ---------- 免费墙（服务端补漏）：applyBlockSelection 直写 freeBlockIds 曾无校验 ----------

test('免费墙：free 提交超过 2 块 → 拒绝且 freeBlockIds 不被写坏', async () => {
  const t = await seedBlocksFixture()
  try {
    await t.db.execute(sql`insert into blocks (id, name, category) values ('b3', 'B3', 'cat-b')`)
    await expect(applyBlockSelection(mkDeps(t), 'u1', ['b1', 'b2', 'b3']))
      .rejects.toThrow(/免费层最多 2 个块/)
    const s = await loadSettings(runner(t), 'u1')
    expect(s.freeBlockIds).toEqual(['b1', 'b2'])   // 拒绝即无副作用
  } finally {
    await t.pg.close()
  }
})

test('免费墙：块 id 不存在 → 拒绝（防 API 直调写脏数据）', async () => {
  const t = await seedBlocksFixture()
  try {
    await expect(applyBlockSelection(mkDeps(t), 'u1', ['b1', 'ghost']))
      .rejects.toThrow(/不存在/)
    const s = await loadSettings(runner(t), 'u1')
    expect(s.freeBlockIds).toEqual(['b1', 'b2'])
  } finally {
    await t.pg.close()
  }
})

/** paid 用户 + 3 块各 1 卡：块数不受 FREE_BLOCK_LIMIT 约束 */
async function seedPaidBlocks(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'paid', ${JSON.stringify(['b1'])}::jsonb)`)
  for (const b of ['b1', 'b2', 'b3']) {
    await t.db.execute(sql`insert into blocks (id, name, category) values (${b}, ${b}, 'cat-a')`)
    await addCard(t, `${b}-c0`, b)
  }
  return t
}

test('paid 不受免费块数限制：3 块一次提交正常生效', async () => {
  const t = await seedPaidBlocks()
  try {
    await applyBlockSelection(mkDeps(t), 'u1', ['b1', 'b2', 'b3'])   // 不抛即过
    const s = await loadSettings(runner(t), 'u1')
    expect(s.freeBlockIds).toEqual(['b1', 'b2', 'b3'])
  } finally {
    await t.pg.close()
  }
})

// ---------- 无变化提交跳过重排（保护 cram 布局 / 消除无意义全局重排） ----------

test('设置无变化提交：changed=false 且计划逐字节不变', async () => {
  const t = await seedWithPlans()   // readyBy=+21d、容量 45
  try {
    const before = await allPlans(t)
    const r = await applySettingsChange(mkDeps(t), 'u1', { readyByDate: plusDays(21), dailyCapacity: 45, trackId: null })
    expect(r.changed).toBe(false)
    expect(r.replanned).toBe(0)
    expect(await allPlans(t)).toEqual(before)
  } finally {
    await t.pg.close()
  }
})

test('设置有变化提交：changed=true（现有重排行为保持）', async () => {
  const t = await seedWithPlans()
  try {
    const r = await applySettingsChange(mkDeps(t), 'u1', { readyByDate: plusDays(40) })
    expect(r.changed).toBe(true)
    expect(r.replanned).toBe(3)
  } finally {
    await t.pg.close()
  }
})

// ---------- 容量服务端校验（此前 0/小数可直接入库） ----------

test('容量校验：0 或小数 → 拒绝且设置不动', async () => {
  const t = await seedWithPlans()
  try {
    await expect(applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 0 })).rejects.toThrow(/容量/)
    await expect(applySettingsChange(mkDeps(t), 'u1', { dailyCapacity: 1.5 })).rejects.toThrow(/容量/)
    const s = await loadSettings(runner(t), 'u1')
    expect(s.dailyCapacity).toBe(45)
  } finally {
    await t.pg.close()
  }
})
