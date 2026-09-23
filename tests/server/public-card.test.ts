import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { loadPublicCard } from '../../src/server/db/adapters.js'

async function seed() {
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into blocks (id, name, category) values ('b1','MySQL 索引','db')`)
  await db.execute(sql`insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
    values ('c1','b1','B+ 树的特点？','enumeration','d','[]'::jsonb,'x','high')`)
  const src = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
  // 2 条 public、1 条私有
  await db.execute(sql`insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for) values
    ('c1','k0','叶子有序链表',${src}::jsonb,true,'[]'::jsonb),
    ('c1','k1','非叶只存键',${src}::jsonb,true,'[]'::jsonb),
    ('c1','k2','私有要点不可泄露',${src}::jsonb,false,'[]'::jsonb)`)
  return t
}

test('loadPublicCard：只返回 public 要点，totalKeyPoints 记全部活要点', async () => {
  const t = await seed()
  try {
    const card = (await loadPublicCard(t.db as never, 'c1'))!
    expect(card.question).toBe('B+ 树的特点？')
    expect(card.blockName).toBe('MySQL 索引')
    expect(card.publicKeyPoints).toHaveLength(2)
    expect(card.totalKeyPoints).toBe(3)
    // 泄露边界：私有要点文本绝不出现在任何字段
    expect(JSON.stringify(card)).not.toContain('私有要点不可泄露')
  } finally { await t.pg.close() }
})

test('loadPublicCard：不存在的卡 → null', async () => {
  const t = await seed()
  try { expect(await loadPublicCard(t.db as never, 'nope')).toBeNull() }
  finally { await t.pg.close() }
})
