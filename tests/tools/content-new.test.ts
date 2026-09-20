import { renderTemplate } from '../../tools/content-new/template.js'
import { parseCard } from '../../src/lib/content/parse.js'

test('生成的骨架能被 parseCard 解析（enumeration）', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000A', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
})

test('sequence 型骨架自带 4 条带 order 的要点', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000B', blockId: 'mysql/mvcc', cardType: 'sequence', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints).toHaveLength(4)
  expect(r.card.keyPoints.map(k => k.order)).toEqual([1, 2, 3, 4])
})

test('atomic 型骨架只有 1 条要点', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000C', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints).toHaveLength(1)
})

test('骨架里的 verifiedAt 是传入的日期', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000D', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-01-02' })
  expect(src).toContain('verifiedAt: 2026-01-02')
})

test('同块两张卡的要点 id 不会相撞', () => {
  const a = renderTemplate({ id: '01J8ZKQ7Y00000000000000AAA', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const b = renderTemplate({ id: '01J8ZKQ7Y00000000000000BBB', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const ra = parseCard(a, 'a.md'); const rb = parseCard(b, 'b.md')
  expect(ra.ok && rb.ok).toBe(true)
  if (!ra.ok || !rb.ok) return
  const idsA = new Set(ra.card.keyPoints.map(k => k.id))
  for (const k of rb.card.keyPoints) expect(idsA.has(k.id)).toBe(false)
})

test('要点 id 不含位置序号派生的成分 —— 插入新题不应触发任何重编号', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y00000000000000AAA', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-09-18' })
  const r = parseCard(src, 'a.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  // 前缀来自卡自己的 ULID，与它在块里的第几位无关
  expect(r.card.keyPoints[0]!.id).toContain('000aaa')
})
