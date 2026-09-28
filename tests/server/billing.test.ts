import { ulid } from 'ulid'
import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { insertOrder, loadOrder } from '../../src/server/db/adapters.js'

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
