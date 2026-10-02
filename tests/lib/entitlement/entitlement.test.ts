import {
  makeFreeEntitlement, makePaidEntitlement, isEntitled,
  entitledBlockIds, entitledCards, crossBlockPoolFor, FREE_BLOCK_LIMIT,
  GRACE_MAINTENANCE_DAYS,
} from '../../../src/lib/entitlement/entitlement.js'

test('免费层 = 任选 2 个块：限 2、去重、超选抛错（§10.1）', () => {
  expect(FREE_BLOCK_LIMIT).toBe(2)
  const ent = makeFreeEntitlement(['b1', 'b2'])
  expect(ent).toEqual({ plan: 'free', freeBlockIds: ['b1', 'b2'], graceBlockIds: [] })
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

test('冻结防突变：对象与 freeBlockIds 均 frozen，push/改写抛 TypeError（终审）', () => {
  const ent = makeFreeEntitlement(['b1', 'b2'])
  expect(Object.isFrozen(ent)).toBe(true)
  expect(Object.isFrozen(ent.freeBlockIds)).toBe(true)
  // ESM 严格模式下对 frozen 数组 push 即抛 TypeError
  expect(() => (ent.freeBlockIds as string[]).push('b3')).toThrow(TypeError)
  expect(() => (ent.freeBlockIds as string[]).pop()).toThrow(TypeError)
  expect(() => ((ent as { plan: string }).plan = 'paid')).toThrow(TypeError)
  // 改写失败后状态不变
  expect(ent).toEqual({ plan: 'free', freeBlockIds: ['b1', 'b2'], graceBlockIds: [] })

  const paid = makePaidEntitlement()
  expect(Object.isFrozen(paid)).toBe(true)
  expect(Object.isFrozen(paid.freeBlockIds)).toBe(true)
  expect(Object.isFrozen(paid.graceBlockIds)).toBe(true)
  expect(() => (paid.freeBlockIds as string[]).push('b3')).toThrow(TypeError)
})

test('三源并集：free 勾选 ∪ grace 宽限块 都可刷（§10.1 v3 到期宽限）', () => {
  const ent = makeFreeEntitlement(['b1'], ['b5', 'b6'])
  expect(ent).toEqual({ plan: 'free', freeBlockIds: ['b1'], graceBlockIds: ['b5', 'b6'] })
  // 宽限块不受 FREE_BLOCK_LIMIT 约束（它不是免费额度，是已付费的尾巴）
  expect(isEntitled(ent, 'b5')).toBe(true)
  expect(isEntitled(ent, 'b2')).toBe(false)
  // 但 freeBlockIds 仍严格限 2——写入侧的口子没被放宽
  expect(() => makeFreeEntitlement(['b1', 'b2', 'b3'])).toThrow()
  expect(() => makeFreeEntitlement(['b1', 'b2'], ['x', 'y', 'z', 'w'])).not.toThrow()
})

test('grace 去重且冻结：宽限块集合与 freeBlockIds 同等对待', () => {
  const ent = makeFreeEntitlement([], ['b5', 'b5', 'b6'])
  expect(ent.graceBlockIds).toEqual(['b5', 'b6'])
  expect(Object.isFrozen(ent.graceBlockIds)).toBe(true)
  expect(() => (ent.graceBlockIds as string[]).push('b7')).toThrow(TypeError)
})

test('entitledBlockIds：free+grace 按 allBlockIds 顺序输出（确定）', () => {
  const all = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']
  expect(entitledBlockIds(makeFreeEntitlement(['b4'], ['b1', 'b6']), all))
    .toEqual(['b1', 'b4', 'b6'])
})

test('默认 grace 空数组：不传就是三源退化为两源（旧调用点语义不变）', () => {
  expect(makeFreeEntitlement(['b1']).graceBlockIds).toEqual([])
  expect(makePaidEntitlement().graceBlockIds).toEqual([])
  expect(GRACE_MAINTENANCE_DAYS).toBe(14)
})

test('宽限块走 public-only 语料边界：到期用户按免费层处理，不泄露未解锁语料', () => {
  const kps = [
    { id: 'p1', public: true },
    { id: 'h1', public: false },
  ]
  const ent = makeFreeEntitlement([], ['b5'])
  expect(crossBlockPoolFor(ent, kps).map(k => k.id)).toEqual(['p1'])
})
