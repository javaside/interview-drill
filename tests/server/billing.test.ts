import { ulid } from 'ulid'
import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { insertOrder, loadOrder, loadSettings } from '../../src/server/db/adapters.js'
import { createOrder, fulfillOrder, handleWebhook, type PaymentGateway } from '../../src/server/billing.js'

const fakeGateway: PaymentGateway = {
  createPayment: async () => ({ payParams: { fake: true } }),
  verifySignature: () => true,
  parseCallback: () => ({ orderId: 'x', amountCents: 12900, gatewayTxnId: 't', event: 'paid' }),
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
    await insertOrder(t.db as never, { id, userId: 'u1', amountCents: 12900, gateway: 'fake' })
    const row = (await loadOrder(t.db as never, id))!
    expect(row.status).toBe('pending')
    expect(row.amountCents).toBe(12900)
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
      { orderId: 'nope', amountCents: 12900, gatewayTxnId: 't', event: 'paid' })
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
