import { createTestDb } from './helpers.js'
import { sql } from 'drizzle-orm'

test('迁移建出全部表与关键约束', async () => {
  const t = await createTestDb()
  try {
    const rows = await t.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema='public'`,
    )
    const names = rows.rows.map(r => r.table_name)
    for (const want of ['users', 'user_settings', 'blocks', 'cards', 'key_points',
      'card_state', 'review_log', 'daily_session']) {
      expect(names).toContain(want)
    }
    // submissionId 唯一索引是 §8.3 幂等的物理底座
    const idx = await t.db.execute<{ indexname: string }>(sql`
      select indexname from pg_indexes where tablename='review_log' and indexname like '%submission%'`)
    expect(idx.rows.length).toBeGreaterThan(0)
  } finally {
    await t.pg.close()
  }
})
