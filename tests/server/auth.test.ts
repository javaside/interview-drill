import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { requireUserIdWith, ensureUser } from '../../src/server/auth.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

test('requireUserId：无会话返回 401，有会话返回 userId（不依赖真实 OAuth）', async () => {
  const res = await requireUserIdWith(new Request('http://x'), async () => null)
  expect(res).toBeInstanceOf(Response)
  expect((res as Response).status).toBe(401)
  const ok = await requireUserIdWith(new Request('http://x'), async () => ({ userId: 'u1' }))
  expect(ok).toBe('u1')
})

test('首次登录铸造用户与默认设置（Asia/Shanghai / free / 45），且幂等', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    const rows = await t.db.execute<{ timezone: string; plan: string; daily_capacity: number }>(sql`
      select timezone, plan, daily_capacity from user_settings where user_id = ${uid}`)
    expect(rows.rows[0]).toMatchObject({ timezone: 'Asia/Shanghai', plan: 'free', daily_capacity: 45 })

    const again = await ensureUser(db, 'gh-1')   // 幂等：同 githubId 复用同一 userId
    expect(again).toBe(uid)
    const n = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from users`)
    expect(n.rows[0]!.n).toBe(1)
    const ns = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from user_settings`)
    expect(ns.rows[0]!.n).toBe(1)
  } finally {
    await t.pg.close()
  }
})
