import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import {
  loadSettings, entitlementOf, planOf, selectionBlockIdsOf, accessStateOfRow, daysLeftOf,
  extendPass, loadScheduledLastDates, type SqlRunner,
} from '../../src/server/db/adapters.js'
import { isEntitled, FREE_BLOCK_LIMIT } from '../../src/lib/entitlement/entitlement.js'
import { localDateOf } from '../../src/server/time.js'
import { addDays } from '../../src/lib/scheduler/date.js'

/**
 * 到期惰性结算的集成测试（PGlite）：loadSettings 是结算触发点，也是「付费用户
 * 到期后不会整站 500」的唯一防线。
 */
const TZ = 'Asia/Shanghai'
const DAY = 86400_000
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)   // 上海 2026-09-21 11:00
const TODAY = localDateOf(SERVER_NOW, TZ)

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}

/** 一个用户 + 3 个块各 1 张卡；card_state 按传入口播种 */
async function seed(opts: {
  plan?: 'free' | 'paid'
  paidUntilIso?: string | null
  readyBy?: string | null
  selection?: string[]
} = {}): Promise<TestDb> {
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u1', 'gh1')`)
  await db.execute(sql`
    insert into user_settings (user_id, ready_by_date, timezone, plan, paid_until, free_block_ids)
    values ('u1', ${opts.readyBy ?? null}, ${TZ}, ${opts.plan ?? 'free'},
            ${opts.paidUntilIso ?? null}::timestamptz,
            ${JSON.stringify(opts.selection ?? [])}::jsonb)`)
  for (const b of ['b1', 'b2', 'b3', 'b4']) {
    await db.execute(sql`insert into blocks (id, name, category) values (${b}, ${b}, 'cat-a')`)
    await db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${`${b}-c`}, ${b}, 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
  }
  return t
}

/** 给某块播一条卡状态（plan 为绝对日期数组） */
async function planCard(db: SqlRunner, cardId: string, dates: string[]): Promise<void> {
  await db.execute(sql`
    insert into card_state (user_id, card_id, plan, algo_version)
    values ('u1', ${cardId}, ${JSON.stringify(dates)}::jsonb, 'test')`)
}

const expiredIso = () => new Date(SERVER_NOW - DAY).toISOString()
const futureIso = (days: number) => new Date(SERVER_NOW + days * DAY).toISOString()

test('从未付费：loadSettings 不结算，档位 free，勾选原样', async () => {
  const t = await seed({ selection: ['b1', 'b2'] })
  try {
    const db = runner(t)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('free')
    expect(planOf(row, SERVER_NOW)).toBe('free')
    expect(row.graceUntil).toBeNull()
    expect(selectionBlockIdsOf(row, SERVER_NOW)).toEqual(['b1', 'b2'])
  } finally { await t.pg.close() }
})

test('有效期内：paid、全量放行、勾选原样', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: futureIso(10), selection: ['b1'] })
  try {
    const db = runner(t)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('paid')
    expect(planOf(row, SERVER_NOW)).toBe('paid')
    // 付费 = 全量，与勾选无关
    expect(isEntitled(entitlementOf(row, SERVER_NOW), 'b4')).toBe(true)
    expect(row.graceUntil).toBeNull()   // 未到期 → 不结算
  } finally { await t.pg.close() }
})

test('到期（无就绪日）：结算成维持 14 天，勾选收敛到 2 块，不再抛「最多 2 个块」', async () => {
  const t = await seed({
    plan: 'paid', paidUntilIso: expiredIso(), selection: ['b1', 'b2', 'b3', 'b4'],
  })
  try {
    const db = runner(t)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(row.graceUntil).toBe(addDays(TODAY, 14))
    // 关键回归：付费期勾了 4 块，到期后 entitlementOf 不能抛（此前会让整页 500）
    expect(() => entitlementOf(row, SERVER_NOW)).not.toThrow()
    expect(row.freeBlockIds).toHaveLength(FREE_BLOCK_LIMIT)
    // 落库了（不是只在内存里）
    const r = await db.execute<{ grace_until: string; free_block_ids: string[] }>(sql`
      select grace_until, free_block_ids from user_settings where user_id = 'u1'`)
    expect(r.rows[0]!.grace_until).not.toBeNull()
    expect(r.rows[0]!.free_block_ids).toHaveLength(FREE_BLOCK_LIMIT)
  } finally { await t.pg.close() }
})

test('到期后排期照常跑：宽限块在 entitlement 与排期范围里都在', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: expiredIso(), selection: [] })
  try {
    const db = runner(t)
    await planCard(db, 'b2-c', [addDays(TODAY, 5)])
    await planCard(db, 'b3-c', [addDays(TODAY, 3)])

    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('grace')
    expect(planOf(row, SERVER_NOW)).toBe('paid')        // 配额按付费档
    expect(row.graceBlockIds).toEqual(['b2', 'b3'])
    // 勾选口径 = 勾选 ∪ 宽限块——否则宽限排期会被勾选集过滤掉，宽限形同虚设
    expect(selectionBlockIdsOf(row, SERVER_NOW)).toEqual(['b2', 'b3'])
    for (const b of row.graceBlockIds) {
      expect(isEntitled(entitlementOf(row, SERVER_NOW), b)).toBe(true)
    }
    // 非宽限块仍被挡（宽限不是全量）
    expect(isEntitled(entitlementOf(row, SERVER_NOW), 'b1')).toBe(false)
  } finally { await t.pg.close() }
})

test('冲刺模式：宽限到在期排期最后一天（比就绪日更晚时取排期）', async () => {
  const t = await seed({
    plan: 'paid', paidUntilIso: expiredIso(), readyBy: addDays(TODAY, 7), selection: [],
  })
  try {
    const db = runner(t)
    await planCard(db, 'b1-c', [addDays(TODAY, 3), addDays(TODAY, 12)])
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(row.graceUntil).toBe(addDays(TODAY, 12))
  } finally { await t.pg.close() }
})

test('结算幂等：宽限期内再读不重算（宽限终点被冻结，不随排期消费前移）', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: expiredIso(), selection: [] })
  try {
    const db = runner(t)
    await planCard(db, 'b1-c', [addDays(TODAY, 10)])
    const first = await loadSettings(db, 'u1', SERVER_NOW)
    expect(first.graceUntil).toBe(addDays(TODAY, 14))

    // 消费掉那张卡的排期（模拟用户刷完 → plan 缩短）
    await db.execute(sql`update card_state set plan = '[]'::jsonb where card_id = 'b1-c'`)
    const second = await loadSettings(db, 'u1', SERVER_NOW)
    expect(second.graceUntil).toBe(addDays(TODAY, 14))   // 未被前移到 14 天以外/以内
    expect(second.graceBlockIds).toEqual(['b1'])          // 宽限块也冻结
  } finally { await t.pg.close() }
})

test('宽限结束后再读：勾选收敛回 2 块（宽限期内可任意多选）', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: expiredIso(), selection: [] })
  try {
    const db = runner(t)
    // 直接播一个已过期的宽限态（模拟 15 天后回来）
    await db.execute(sql`
      update user_settings
      set grace_until = ${addDays(TODAY, -1)}, grace_block_ids = '["b1","b2","b3","b4"]'::jsonb,
          free_block_ids = '["b1","b2","b3","b4"]'::jsonb
      where user_id = 'u1'`)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('free')
    expect(row.freeBlockIds).toEqual(['b1', 'b2'])
    expect(() => entitlementOf(row, SERVER_NOW)).not.toThrow()
  } finally { await t.pg.close() }
})

test('loadScheduledLastDates：每块取最晚排期日，按 blockId 升序', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: expiredIso() })
  try {
    const db = runner(t)
    await planCard(db, 'b3-c', [addDays(TODAY, 2)])
    await planCard(db, 'b1-c', [addDays(TODAY, 9), addDays(TODAY, 4)])
    await planCard(db, 'b2-c', [])   // 空计划不算「有排期」
    expect(await loadScheduledLastDates(db, 'u1')).toEqual([
      { blockId: 'b1', lastPlannedDate: addDays(TODAY, 9) },
      { blockId: 'b3', lastPlannedDate: addDays(TODAY, 2) },
    ])
  } finally { await t.pg.close() }
})

test('extendPass 叠加不覆盖：有效期内的剩余天数被保留', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: futureIso(10), selection: ['b1'] })
  try {
    const db = runner(t)
    await extendPass(db, 'u1', SERVER_NOW)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    const left = (row.paidUntil!.getTime() - SERVER_NOW) / DAY
    expect(Math.round(left)).toBe(40)   // 10 + 30，不是 30
  } finally { await t.pg.close() }
})

test('extendPass 从当下起算：已过期用户不会「倒扣」', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: new Date(SERVER_NOW - 100 * DAY).toISOString() })
  try {
    const db = runner(t)
    await extendPass(db, 'u1', SERVER_NOW)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(Math.round((row.paidUntil!.getTime() - SERVER_NOW) / DAY)).toBe(30)
    expect(row.graceUntil).toBeNull()      // 重新付费 → 结算态清空
    expect(row.graceBlockIds).toEqual([])
    expect(row.freeBlockIds).toEqual([])   // 勾选清空（与既有「解锁需回设置重勾」一致）
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('paid')
  } finally { await t.pg.close() }
})

test('extendPass 清掉宽限：宽限期内续期 → 立即回到 paid 且排期范围不再靠宽限块兜底', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: expiredIso(), selection: [] })
  try {
    const db = runner(t)
    await planCard(db, 'b2-c', [addDays(TODAY, 5)])
    const grace = await loadSettings(db, 'u1', SERVER_NOW)
    expect(grace.graceBlockIds).toEqual(['b2'])

    await extendPass(db, 'u1', SERVER_NOW)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    expect(accessStateOfRow(row, SERVER_NOW)).toBe('paid')
    expect(row.graceUntil).toBeNull()
    expect(entitlementOf(row, SERVER_NOW).plan).toBe('paid')
  } finally { await t.pg.close() }
})

test('daysLeftOf（导航 chip 与解锁页的唯一实现）：向上取整、至少 1 天、非 paid 为 null', async () => {
  const t = await seed({ plan: 'paid', paidUntilIso: futureIso(12) })
  try {
    const db = runner(t)
    const row = await loadSettings(db, 'u1', SERVER_NOW)
    // 12 天整 + 一点余量 → 向上取整成 13（宁可显示多一天，也不提前说「剩 12」）
    expect(daysLeftOf({ ...row, paidUntil: new Date(SERVER_NOW + 12 * DAY + 3 * 3_600_000) }, SERVER_NOW))
      .toBe(13)
    // 不足一天 → 1，而不是 0（「剩 0 天」读起来像已过期）
    expect(daysLeftOf({ ...row, paidUntil: new Date(SERVER_NOW + 3 * 3_600_000) }, SERVER_NOW)).toBe(1)
    // 已过期 → null（宽限期不该看到「还剩 0 天」）
    expect(daysLeftOf({ ...row, paidUntil: new Date(SERVER_NOW - DAY) }, SERVER_NOW)).toBeNull()
    // 从未付费 → null
    expect(daysLeftOf({ ...row, paidUntil: null }, SERVER_NOW)).toBeNull()
    // 边界：恰好在到期时刻 → 已过期（paid 判定是严格大于）
    expect(daysLeftOf({ ...row, paidUntil: new Date(SERVER_NOW) }, SERVER_NOW)).toBeNull()
  } finally { await t.pg.close() }
})
