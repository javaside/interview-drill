import {
  makeFreeEntitlement, makePaidEntitlement, isEntitled,
  entitledBlockIds, entitledCards, crossBlockPoolFor, FREE_BLOCK_LIMIT,
} from '../../../src/lib/entitlement/entitlement.js'

test('免费层 = 任选 2 个块：限 2、去重、超选抛错（§10.1）', () => {
  expect(FREE_BLOCK_LIMIT).toBe(2)
  const ent = makeFreeEntitlement(['b1', 'b2'])
  expect(ent).toEqual({ plan: 'free', freeBlockIds: ['b1', 'b2'] })
  expect(makeFreeEntitlement(['b1', 'b1', 'b2']).freeBlockIds).toEqual(['b1', 'b2'])
  expect(() => makeFreeEntitlement(['b1', 'b2', 'b3'])).toThrow()
})

test('isEntitled：free 命中所选块；paid 恒 true', () => {
  const free = makeFreeEntitlement(['b1', 'b2'])
  expect(isEntitled(free, 'b1')).toBe(true)
  expect(isEntitled(free, 'b3')).toBe(false)
  expect(isEntitled(makePaidEntitlement(), 'anything')).toBe(true)
})

test('entitledBlockIds：paid 全量；free 交集且按 allBlockIds 顺序（确定）', () => {
  const all = ['b1', 'b2', 'b3', 'b4']
  expect(entitledBlockIds(makePaidEntitlement(), all)).toEqual(all)
  const free = makeFreeEntitlement(['b4', 'b1'])   // 故意乱序传入
  expect(entitledBlockIds(free, all)).toEqual(['b1', 'b4'])
})

test('entitledCards：只留有权块的卡（喂 schedule() 的 cards[]，§7）', () => {
  const cards = [
    { id: 'c1', blockId: 'b1' },
    { id: 'c2', blockId: 'b3' },
    { id: 'c3', blockId: 'b2' },
  ]
  expect(entitledCards(makeFreeEntitlement(['b1', 'b2']), cards).map(c => c.id))
    .toEqual(['c1', 'c3'])
  expect(entitledCards(makePaidEntitlement(), cards)).toHaveLength(3)
})

test('crossBlockPoolFor：免费只留 public，付费全量（§4.3/§11 泄露边界）', () => {
  const kps = [
    { id: 'p1', public: true },
    { id: 'h1', public: false },
    { id: 'p2', public: true },
    { id: 'h2', public: false },
  ]
  expect(crossBlockPoolFor(makeFreeEntitlement(['b1']), kps).map(k => k.id))
    .toEqual(['p1', 'p2'])
  expect(crossBlockPoolFor(makePaidEntitlement(), kps)).toHaveLength(4)
})
