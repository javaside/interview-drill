import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { runUpsert } from '../../src/server/content-upsert/run.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

function runner(db: unknown): SqlRunner {
  return db as SqlRunner
}

test('试点块完整落库且可重复执行（幂等）', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    const db = runner(t.db)
    const r1 = await runUpsert(db)
    expect(r1.blocks).toBeGreaterThanOrEqual(1)
    expect(r1.cards).toBeGreaterThanOrEqual(5)
    const r2 = await runUpsert(db)
    expect(r2).toEqual(r1)
    const n = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from cards`)
    expect(n.rows[0]!.n).toBe(r1.cards)
  } finally {
    await t.pg.close()
  }
})

test('judgment 卡的 conclusion 字段落库', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    await runUpsert(runner(t.db))
    const rows = await t.db.execute<{ conclusion: string | null }>(
      sql`select conclusion from cards where card_type='judgment'`)
    expect(rows.rows.length).toBeGreaterThan(0)
    expect(rows.rows[0]!.conclusion).toMatch(/^(yes|no|depends)$/)
  } finally {
    await t.pg.close()
  }
})

test('源目录消失的卡被 tombstone 而非删除（§7 id 稳定性）', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    const db = runner(t.db)
    await runUpsert(db)
    // 手动插一张"已从源里消失"的卡（先补外键指向的块）
    await t.db.execute(sql`insert into blocks (id, name, category) values ('ghost-b','Ghost','ghost-cat')`)
    await t.db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values ('ghost','ghost-b','q','atomic','d','[]'::jsonb,'JDK 8+','mid')`)
    await runUpsert(db)
    const ghost = await t.db.execute<{ retired_at: string | null }>(
      sql`select retired_at from cards where id='ghost'`)
    expect(ghost.rows[0]!.retired_at).not.toBeNull()
    // 源里真实存在的卡不被 tombstone
    const live = await t.db.execute<{ n: number }>(
      sql`select count(*)::int as n from cards where retired_at is null`)
    expect(live.rows[0]!.n).toBeGreaterThanOrEqual(5)
  } finally {
    await t.pg.close()
  }
})
