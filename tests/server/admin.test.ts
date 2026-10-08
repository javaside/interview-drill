import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { ensureUser } from '../../src/server/auth.js'
import { isAdminUser } from '../../src/server/admin.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

test('名单内 github_id → true；名单外/未注册/名单空 → false', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const boss = await ensureUser(db, '100000001')
    const guest = await ensureUser(db, '999')
    expect(await isAdminUser({ db, adminGithubIds: '100000001' }, boss)).toBe(true)
    expect(await isAdminUser({ db, adminGithubIds: '100000001' }, guest)).toBe(false)
    expect(await isAdminUser({ db, adminGithubIds: '' }, boss)).toBe(false)   // 名单空 = 无人可管
    // 多个 id 逗号分隔
    expect(await isAdminUser({ db, adminGithubIds: '1, 100000001 ,2' }, boss)).toBe(true)
    // 未注册 userId（无 users 行）不炸，直接 false
    expect(await isAdminUser({ db, adminGithubIds: '100000001' }, 'nobody')).toBe(false)
  } finally { await t.pg.close() }
})
