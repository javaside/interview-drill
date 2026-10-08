import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { buildDailyPayload, type DailyPayloadDeps } from '../../src/server/queue.js'
import {
  loadSettings, entitlementOf, loadAllCards, loadAllCardStates,
  persistPlans, ensureDailySession, countTodayDone, type SqlRunner,
} from '../../src/server/db/adapters.js'
import { localDateOf } from '../../src/server/time.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import { addDays } from '../../src/lib/scheduler/date.js'

const TZ = 'Asia/Shanghai'
const SERVER_NOW = Date.UTC(2026, 8, 21, 3, 0)   // 上海 2026-09-21 11:00
const TODAY = localDateOf(SERVER_NOW, TZ)          // '2026-09-21'

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}

type SeedOpts = { readyBy?: string | null }

/** 免费用户夹具：2 解锁块（b1/b2 各 5 卡）+ 1 未解锁块（b-lock，非 public 语料） */
async function seedQueueFixture(opts: SeedOpts = {}): Promise<TestDb> {
  const readyBy = opts.readyBy === undefined ? addDays(TODAY, 21) : opts.readyBy
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u-free', 'gh-free')`)
  await db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u-free', ${readyBy}, 45, ${TZ}, 'free', ${JSON.stringify(['b1', 'b2'])}::jsonb)`)
  for (const b of ['b1', 'b2', 'b-lock']) {
    await db.execute(sql`insert into blocks (id, name, category) values (${b}, ${b}, 'cat-a')`)
  }
  const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
  const addCard = async (cardId: string, blockId: string, kpTexts: string[], pub: boolean) => {
    await db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${cardId}, ${blockId}, 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
    for (let i = 0; i < kpTexts.length; i++) {
      await db.execute(sql`
        insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
        values (${cardId}, ${`${cardId}-k${i}`}, ${kpTexts[i]}, ${src}::jsonb, ${pub}, '[]'::jsonb)`)
    }
  }
  for (const b of ['b1', 'b2']) {
    for (let n = 0; n < 5; n++) {
      const id = `${b}-c${n}`
      await addCard(id, b, [`${id}-a`, `${id}-b`, `${id}-c`], false)
    }
  }
  // 未解锁块：全部非 public，文本带 LOCK 前缀便于泄露断言
  for (let n = 0; n < 2; n++) {
    const id = `b-lock-c${n}`
    await addCard(id, 'b-lock', [`LOCK-${n}-0`, `LOCK-${n}-1`, `LOCK-${n}-2`], false)
  }
  return t
}

function mkDeps(t: TestDb, userId: string): DailyPayloadDeps {
  const db = runner(t)
  return {
    userId,
    serverNowMs: SERVER_NOW,
    async loadSettings() {
      const row = await loadSettings(db, userId, SERVER_NOW)
      return {
        settings: { readyByDate: row.readyByDate, dailyCapacity: row.dailyCapacity, timezone: row.timezone },
        ent: entitlementOf(row, SERVER_NOW),
        selectionBlockIds: new Set(row.freeBlockIds),
        // 本文件的夹具都不是宽限用户（免费 / 有效期内付费），恒 false；
        // 宽限口径走 payloadDepsOf 的真实装配，见「宽限期只跑已有计划」两条用例
        graceActive: false,
      }
    },
    loadCards: () => loadAllCards(db),
    loadStates: () => loadAllCardStates(db, userId, TODAY),
    persistPlans: plans => persistPlans(db, userId, plans),
    ensureDailySession: (today, size) => ensureDailySession(db, userId, today, size),
    countTodayDone: today => countTodayDone(db, userId, today),
    countTodayMisses: () => Promise.resolve(0),
    loadDemoCode: () => null,
  }
}

/** 未解锁块的全部要点文本（泄露断言的禁集） */
async function lockedTexts(t: TestDb): Promise<Set<string>> {
  const r = await t.db.execute<{ text: string }>(sql`
    select text from key_points where card_id like 'b-lock%'`)
  return new Set(r.rows.map(x => x.text))
}

/** 直接落一条当天 review_log，代表"刷掉一张卡"（本测试只关心分母恒定） */
async function submitOne(t: TestDb, userId: string, cardId: string): Promise<void> {
  await t.db.execute(sql`
    insert into review_log (
      id, submission_id, user_id, card_id, reviewed_at, local_date,
      correct_checked, wrong_checked, key_points_total, daily_capacity_at_review, algo_version)
    values (
      ${`log-${cardId}`}, ${`sub-${cardId}`}, ${userId}, ${cardId},
      ${new Date(SERVER_NOW).toISOString()}, ${TODAY}, 3, 0, 3, 45, 'v1')`)
}

test('端到端：免费用户取队列——选项集只含可见语料（§11 server 侧泄露验收）', async () => {
  const t = await seedQueueFixture()
  try {
    const p = await buildDailyPayload(mkDeps(t, 'u-free'))
    expect(p.queue.length).toBeGreaterThan(0)
    expect(p.selectedBlocks).toBe(2)   // 勾选 b1/b2 —— 空态 UI 据此分辨「没勾题」与「没到期」
    const forbidden = await lockedTexts(t)
    for (const prep of p.prepared) {
      for (const v of prep.variants) {
        expect(v.optionTexts).toHaveLength(9)
        for (const text of v.optionTexts) expect(forbidden.has(text)).toBe(false)
      }
    }
  } finally {
    await t.pg.close()
  }
})

test('daily_session：当天首次写定 queueSize，第二次取队列分母不变（§6）', async () => {
  const t = await seedQueueFixture()
  try {
    const d = mkDeps(t, 'u-free')
    const p1 = await buildDailyPayload(d)
    await submitOne(t, 'u-free', p1.queue[0]!.cardId)
    const p2 = await buildDailyPayload(d)
    expect(p2.progress.total).toBe(p1.progress.total)
    expect(p2.progress.done).toBe(1)
  } finally {
    await t.pg.close()
  }
})

test('plan-once：当天重复取队列不重算已有计划（I4）', async () => {
  const t = await seedQueueFixture()
  try {
    const d = mkDeps(t, 'u-free')
    await buildDailyPayload(d)
    const after1 = await t.db.execute<{ n: number }>(sql`
      select count(*)::int as n from card_state where plan_generated_at is not null`)
    const ts1 = await t.db.execute<{ m: string }>(sql`
      select max(plan_generated_at)::text as m from card_state`)
    await buildDailyPayload(d)
    const after2 = await t.db.execute<{ n: number }>(sql`
      select count(*)::int as n from card_state where plan_generated_at is not null`)
    const ts2 = await t.db.execute<{ m: string }>(sql`
      select max(plan_generated_at)::text as m from card_state`)
    expect(after2.rows[0]!.n).toBe(after1.rows[0]!.n)
    expect(ts2.rows[0]!.m).toBe(ts1.rows[0]!.m)   // 时间戳也不变（未二次落盘）
  } finally {
    await t.pg.close()
  }
})

test('宽限期只跑已有计划：勾选块里的 fresh 卡不再曝光（宽限 ≠ 再送两周新题）', async () => {
  const t = await seedQueueFixture({ readyBy: null })   // 常备模式：fresh 卡本来会全部曝光
  try {
    // 付费用户已到期 → 进入宽限；勾选仍是 b1/b2；只给 b1 的一张卡留**今天到期**的排期
    await t.db.execute(sql`
      update user_settings
      set plan = 'paid', paid_until = ${'2026-09-20T00:00:00Z'}::timestamptz
      where user_id = 'u-free'`)
    await t.db.execute(sql`
      insert into card_state (user_id, card_id, plan, algo_version)
      values ('u-free', 'b1-c0', ${JSON.stringify([TODAY])}::jsonb, 'test')`)

    const deps = payloadDepsOf(runner(t), 'u-free', SERVER_NOW)
    const loaded = await deps.loadSettings()
    expect(loaded.graceActive).toBe(true)
    // 勾选口径 = 勾选 ∪ 宽限块（否则宽限排期会被勾选集过滤掉）
    expect([...loaded.selectionBlockIds].sort()).toEqual(['b1', 'b2'])

    const p = await buildDailyPayload(deps)
    // 宽限的承诺是「让**在期排的**题跑完」，不是「再免费刷两周新题」：
    // b1/b2 里另外 9 张 fresh 卡必须被挡在队列外（常备模式下它们本来会全进）
    expect(p.queue.map(q => q.cardId)).toEqual(['b1-c0'])
  } finally {
    await t.pg.close()
  }
})

test('非宽限的付费用户不受此限：fresh 卡照常首次曝光（对照组，防过滤条件写宽）', async () => {
  const t = await seedQueueFixture({ readyBy: null })
  try {
    await t.db.execute(sql`
      update user_settings
      set plan = 'paid', paid_until = ${'2099-01-01T00:00:00Z'}::timestamptz
      where user_id = 'u-free'`)

    const deps = payloadDepsOf(runner(t), 'u-free', SERVER_NOW)
    const loaded = await deps.loadSettings()
    expect(loaded.graceActive).toBe(false)
    const p = await buildDailyPayload(deps)
    expect(p.queue.length).toBeGreaterThan(0)
  } finally {
    await t.pg.close()
  }
})

test('未设就绪日：维持模式——无冲刺计划落盘，队列 = 无计划新卡首次曝光（§5.7）', async () => {
  const t = await seedQueueFixture({ readyBy: null })
  try {
    const p = await buildDailyPayload(mkDeps(t, 'u-free'))
    expect(p.mode).toBe('maintenance')
    expect(p.queue).toHaveLength(10)   // b1/b2 各 5 张 new 卡全部首次曝光
    expect(p.queue.every(q => q.reason === 'due')).toBe(true)
    const n = await t.db.execute<{ n: number }>(sql`
      select count(*)::int as n from card_state where plan_generated_at is not null`)
    expect(n.rows[0]!.n).toBe(0)   // 维持模式不生成冲刺计划
  } finally {
    await t.pg.close()
  }
})

test('DailyPayload.cards 携带屏①/屏② 所需展示元数据（题面/块名/频度/要点文本）', async () => {
  const t = await seedQueueFixture()
  try {
    const p = await buildDailyPayload(mkDeps(t, 'u-free'))
    expect(p.cards.length).toBe(p.queue.length)
    const first = p.cards.find(c => c.cardId === p.queue[0]!.cardId)!
    expect(first.question.length).toBeGreaterThan(0)
    expect(first.blockName.length).toBeGreaterThan(0)
    expect(['high', 'mid', 'low']).toContain(first.frequency)
    expect(first.keyPoints.length).toBeGreaterThan(0)
    expect(first.detail.length).toBeGreaterThan(0)   // 先学后练：屏①「看讲解」的材料
    // 免费用户：cards 里也不得泄露未解锁块的要点文本（只出队列内卡的自身要点）
    const queued = new Set(p.queue.map(q => q.cardId))
    expect(p.cards.every(c => queued.has(c.cardId))).toBe(true)
  } finally {
    await t.pg.close()
  }
})

test('demoCode 注入：deps.loadDemoCode 命中的卡携带剥头源码，其余缺省（spec §5）', async () => {
  const t = await seedQueueFixture()
  try {
    const d = mkDeps(t, 'u-free')
    d.loadDemoCode = (blockId, cardId) => (cardId === 'b1-c0' ? 'public class Demo {}' : null)
    const p = await buildDailyPayload(d)
    // 夹具 daily_capacity=45、两块各 5 卡 fresh，首轮全进队列，b1-c0 必在
    expect(p.cards.some(c => c.cardId === 'b1-c0')).toBe(true)
    // 携带者恰为 b1-c0，且是 deps 给的剥头源码
    const withDemo = p.cards.find(c => c.demoCode !== undefined)
    expect(withDemo?.cardId).toBe('b1-c0')
    expect(withDemo?.demoCode).toBe('public class Demo {}')
    // 其余卡缺省该字段（无 demo 的卡不携带空串占位）
    expect(p.cards.filter(c => c.cardId !== 'b1-c0').every(c => c.demoCode === undefined)).toBe(true)
  } finally {
    await t.pg.close()
  }
})
