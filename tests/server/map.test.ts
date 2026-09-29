import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { buildBlockMap, filterEntriesByTrack } from '../../src/server/map.js'
import type { BlockMapEntry } from '../../src/server/map.js'
import { mapDepsOf } from '../../src/server/deps.js'

const TZ = 'Asia/Shanghai'

// b1 免费已选、b2 未解锁；b1 有 2 张卡（1 张 learning s=1/1），b2 有 3 张卡（无状态）
async function seedMap() {
  const t = await createTestDb()
  const db = t.db
  await db.execute(sql`insert into users (id, github_id) values ('u1','gh1')`)
  await db.execute(sql`insert into user_settings (user_id, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await db.execute(sql`insert into blocks (id, name, category) values ('b1','MySQL 索引','db'),('b2','Redis','db')`)
  for (const [b, n] of [['b1', 2], ['b2', 3]] as const)
    for (let i = 0; i < n; i++)
      await db.execute(sql`insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
        values (${`${b}-${i}`}, ${b}, 'q', 'enumeration', 'd', '[]'::jsonb, 'x', 'high')`)
  await db.execute(sql`insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
    values ('u1','b1-0','learning',1,1,'[]'::jsonb,0,1,'v1')`)
  return t
}

test('buildBlockMap：题数、解锁位、掌握度（未刷块 untried）', async () => {
  const t = await seedMap()
  try {
    const m = await buildBlockMap(mapDepsOf(t.db as never, 'u1'))
    const b1 = m.find(e => e.blockId === 'b1')!
    const b2 = m.find(e => e.blockId === 'b2')!
    expect(b1.cardCount).toBe(2)
    expect(b1.blockName).toBe('MySQL 索引')
    expect(b1.unlocked).toBe(true)
    expect(b1.mastery.kind).toBe('score')   // 有 1 张 learning 卡
    expect(b2.unlocked).toBe(false)          // 免费未选
    expect(b2.cardCount).toBe(3)
    expect(b2.mastery).toEqual({ kind: 'untried' })  // 无状态卡
  } finally { await t.pg.close() }
})

// ===== 岗位包过滤（纯核，不依赖 DB） =====
const mkEntry = (id: string): BlockMapEntry => ({
  blockId: id, blockName: id, category: 'x', cardCount: 1, unlocked: true,
  mastery: { kind: 'untried' },
})

test('filterEntriesByTrack：按 track 过滤并按建议顺序排列', () => {
  const entries = [mkEntry('a'), mkEntry('b'), mkEntry('c')]
  const tracks = [{ id: 't1', blockIds: ['c', 'a'] }]
  expect(filterEntriesByTrack(entries, tracks, 't1').map(e => e.blockId)).toEqual(['c', 'a'])
})

test('filterEntriesByTrack：null 或未知 track → 全量原样（宁可全显不空白）', () => {
  const entries = [mkEntry('a'), mkEntry('b')]
  expect(filterEntriesByTrack(entries, [{ id: 't1', blockIds: ['a'] }], null)).toHaveLength(2)
  expect(filterEntriesByTrack(entries, [{ id: 't1', blockIds: ['a'] }], 'ghost')).toHaveLength(2)
})
