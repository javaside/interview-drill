import { ulid } from 'ulid'
import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { insertOrder, loadOrder, loadSettings } from '../../src/server/db/adapters.js'
import { createOrder, fulfillOrder, handleWebhook, type PaymentGateway } from '../../src/server/billing.js'
import { buildBlockMap } from '../../src/server/map.js'
import { mapDepsOf } from '../../src/server/deps.js'
import { PASS_PRICE_CENTS } from '../../src/lib/billing/order.js'

const fakeGateway: PaymentGateway = {
  createPayment: async () => ({ payParams: { fake: true } }),
  verifySignature: () => true,
  parseCallback: () => ({ orderId: 'x', amountCents: PASS_PRICE_CENTS, gatewayTxnId: 't', event: 'paid' }),
}

async function seedUser(db: never) {
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
    sql`insert into users (id, github_id) values ('u1','gh1')`)
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
    sql`insert into user_settings (user_id) values ('u1')`)
}

test('insertOrder/loadOrder 往返：新单 status=pending、金额落库、不存在→null', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const id = ulid()
    await insertOrder(t.db as never, { id, userId: 'u1', amountCents: PASS_PRICE_CENTS, gateway: 'fake' })
    const row = (await loadOrder(t.db as never, id))!
    expect(row.status).toBe('pending')
    expect(row.amountCents).toBe(PASS_PRICE_CENTS)
    expect(row.userId).toBe('u1')
    expect(await loadOrder(t.db as never, 'nope')).toBeNull()
  } finally { await t.pg.close() }
})

test('履约首次：pending → paid，用户升级 paid 且 free_block_ids 清空', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const r = await fulfillOrder({ db: t.db as never, gateway: fakeGateway }, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    expect(r.outcome).toBe('fulfilled')
    const s = await loadSettings(t.db as never, 'u1')
    expect(s.plan).toBe('paid')
    expect(s.freeBlockIds).toEqual([])
  } finally { await t.pg.close() }
})

test('重复回调幂等：同一订单第二次 → already，plan 仍 paid，不报错', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const deps = { db: t.db as never, gateway: fakeGateway }
    await fulfillOrder(deps, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    const r2 = await fulfillOrder(deps, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    expect(r2.outcome).toBe('already')
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('paid')
  } finally { await t.pg.close() }
})

test('金额不符：assertAmount 抛错，履约中止，plan 不变', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    await expect(fulfillOrder({ db: t.db as never, gateway: fakeGateway },
      { orderId, amountCents: 1, gatewayTxnId: 't1', event: 'paid' })).rejects.toThrow()
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('free')
  } finally { await t.pg.close() }
})

test('未知订单 → rejected', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const r = await fulfillOrder({ db: t.db as never, gateway: fakeGateway },
      { orderId: 'nope', amountCents: PASS_PRICE_CENTS, gatewayTxnId: 't', event: 'paid' })
    expect(r.outcome).toBe('rejected')
  } finally { await t.pg.close() }
})

const badSig: PaymentGateway = { ...fakeGateway, verifySignature: () => false }

test('webhook 验签失败 → 401，不履约', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const r = await handleWebhook({ db: t.db as never, gateway: badSig }, '{}', {})
    expect(r.status).toBe(401)
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('free')
  } finally { await t.pg.close() }
})

test('webhook 验签成功 → 履约 200，用户升级 paid', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const gw: PaymentGateway = { ...fakeGateway,
      parseCallback: () => ({ orderId, amountCents, gatewayTxnId: 't1', event: 'paid' }) }
    const r = await handleWebhook({ db: t.db as never, gateway: gw }, '{}', { sig: 'ok' })
    expect(r.status).toBe(200)
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('paid')
  } finally { await t.pg.close() }
})

test('端到端：免费未解锁块 → 下单 → 回调履约 → 地图全量解锁', async () => {
  const t = await createTestDb()
  try {
    // 免费用户仅选 b1；b1/b2 各 1 张卡
    await t.db.execute(sql`insert into users (id, github_id) values ('u1','gh1')`)
    await t.db.execute(sql`insert into user_settings (user_id, free_block_ids) values ('u1', '["b1"]'::jsonb)`)
    await t.db.execute(sql`insert into blocks (id, name, category) values ('b1','MySQL','db'),('b2','Redis','db')`)
    await t.db.execute(sql`insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values ('b1-0','b1','q','enumeration','d','[]'::jsonb,'x','high'),
             ('b2-0','b2','q','enumeration','d','[]'::jsonb,'x','high')`)

    const before = await buildBlockMap(mapDepsOf(t.db as never, 'u1'))
    expect(before.find(e => e.blockId === 'b2')!.unlocked).toBe(false)

    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const gw: PaymentGateway = { ...fakeGateway,
      parseCallback: () => ({ orderId, amountCents, gatewayTxnId: 't1', event: 'paid' }) }
    const r = await handleWebhook({ db: t.db as never, gateway: gw }, '{}', { sig: 'ok' })
    expect(r.status).toBe(200)

    const after = await buildBlockMap(mapDepsOf(t.db as never, 'u1'))
    expect(after.find(e => e.blockId === 'b2')!.unlocked).toBe(true)   // paid 全解锁
    expect(after.every(e => e.unlocked)).toBe(true)
  } finally { await t.pg.close() }
})
