import { prepareOptions } from '../../../src/lib/options/prepare.js'
import type { DistractorPools, OptionCard, OptionKeyPoint } from '../../../src/lib/options/types.js'

const S0 = { num: 0, den: 1 }

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function poolOf(prefix: string, n: number): OptionKeyPoint[] {
  return Array.from({ length: n }, (_, i) => kp(`${prefix}${i}`))
}
function bigPools(): DistractorPools {
  return { sameBlock: poolOf('s', 10), crossBlock: poolOf('c', 12), neighbor: [] }
}
function enumCard(n: number): OptionCard {
  return {
    id: 'e1', blockId: 'b1', cardType: 'enumeration',
    keyPoints: Array.from({ length: n }, (_, i) => kp(`k${i}`)),
  }
}

test('选项总数恒为 9：正确 3/4/6 条都不改变总数（§4.3 防数数）', () => {
  for (const n of [3, 4, 6]) {
    const r = prepareOptions(enumCard(n), bigPools(), S0, 'u1', 0, 2)
    for (const v of r.variants) {
      expect(v.optionTexts).toHaveLength(9)
      expect(v.correctIndices).toHaveLength(n)
      expect(v.distractorKeyPointIds).toHaveLength(9 - n)
      expect(v.correctIndices.every(i => i >= 0 && i < 9)).toBe(true)
    }
  }
})

test('atomic：4 选 1，正确项 = 首条要点', () => {
  const card: OptionCard = { id: 'a1', blockId: 'b1', cardType: 'atomic', keyPoints: [kp('k0')] }
  const r = prepareOptions(card, bigPools(), S0, 'u1', 0, 1)
  const v = r.variants[0]!
  expect(v.optionTexts).toHaveLength(4)
  expect(v.correctIndices).toHaveLength(1)
  expect(v.distractorKeyPointIds).toHaveLength(3)
  // 正确项真的指向首条要点，且本题要点没被误抽成干扰项
  expect(v.optionTexts[v.correctIndices[0]!]).toBe('T-k0')
  expect(v.distractorKeyPointIds).not.toContain('k0')
})

test('sequence：呈现序非答案化——是排列、恒≠canonical、按正确序语义可复原（终审 Ruling）', () => {
  // keyPoints 数组故意乱序存放，order 才是答案；order 与 id 对齐（k0=1..k3=4）
  const card: OptionCard = {
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [
      kp('k2', { order: 3 }), kp('k0', { order: 1 }),
      kp('k3', { order: 4 }), kp('k1', { order: 2 }),
    ],
  }
  const canonical = ['T-k0', 'T-k1', 'T-k2', 'T-k3']   // 按 order 升序的 text 序
  const r = prepareOptions(card, bigPools(), S0, 'u1', 0, 3)
  for (const v of r.variants) {
    // 呈现序是 canonical 的一个排列（排序后相等，非全序比较逐元素）
    expect([...v.optionTexts].sort()).toEqual([...canonical].sort())
    // 呈现序 ≠ canonical 序——恒等置换时循环左移 1 位兜底，永不是答案本身
    expect(v.optionTexts).not.toEqual(canonical)
    // 按正确序语义可复原：按 canonical 顺序读出呈现下标，逐元素严格相等
    expect(v.correctIndices.map(i => v.optionTexts[i]!)).toEqual(canonical)
    // correctIndices 是 0..n-1 的一个排列
    expect([...v.correctIndices].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
    expect(v.distractorKeyPointIds).toEqual([])
  }
  // K 份变体呈现序全同：哨兵 seed 与 reviewIndex 无关（spec"固定顺序呈现"）
  expect(r.variants[0]!.optionTexts).toEqual(r.variants[1]!.optionTexts)
  expect(r.variants[1]!.optionTexts).toEqual(r.variants[2]!.optionTexts)
  expect(r.variants[0]!.correctIndices).toEqual(r.variants[1]!.correctIndices)
})

test('sequence 呈现序恒定：跨 reviewIndexBase/跨天不变，同输入两次调用逐字节相等', () => {
  const card: OptionCard = {
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [
      kp('k2', { order: 3 }), kp('k0', { order: 1 }),
      kp('k3', { order: 4 }), kp('k1', { order: 2 }),
    ],
  }
  const a = prepareOptions(card, bigPools(), S0, 'u1', 0, 2)
  const b = prepareOptions(card, bigPools(), S0, 'u1', 500, 2)   // 换一批复习轮次
  expect(b.variants[0]!.optionTexts).toEqual(a.variants[0]!.optionTexts)
  expect(b.variants[0]!.correctIndices).toEqual(a.variants[0]!.correctIndices)
  const again = prepareOptions(card, bigPools(), S0, 'u1', 0, 2)
  expect(JSON.stringify(a)).toBe(JSON.stringify(again))
})

test('sequence 呈现序参与 seed：多个用户中至少出现两种呈现序（且每种都 ≠ canonical）', () => {
  const mk = (): OptionCard => ({
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [
      kp('k2', { order: 3 }), kp('k0', { order: 1 }),
      kp('k3', { order: 4 }), kp('k1', { order: 2 }),
    ],
  })
  const canonical = ['T-k0', 'T-k1', 'T-k2', 'T-k3']
  const presentations = new Set<string>()
  for (const user of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) {
    const v = prepareOptions(mk(), bigPools(), S0, user, 0, 1).variants[0]!
    expect(v.optionTexts).not.toEqual(canonical)
    presentations.add(v.optionTexts.join('\u0000'))
  }
  expect(presentations.size).toBeGreaterThan(1)
})

test('同 seed 复现：同一输入两次调用逐字节相等（§11）', () => {
  const card = enumCard(4)
  const a = prepareOptions(card, bigPools(), S0, 'u1', 7, 3)
  const b = prepareOptions(card, bigPools(), S0, 'u1', 7, 3)
  expect(a).toEqual(b)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
})

test('每次重抽：K 份变体的 rng 派生自不同 reviewIndex，选项排布不全相同（§4.3）', () => {
  const r = prepareOptions(enumCard(3), bigPools(), S0, 'u1', 0, 3)
  expect(r.variants[0]).not.toEqual(r.variants[1])
  expect(r.variants[1]).not.toEqual(r.variants[2])
})

test('不同用户不同选项：userId 参与 seed（§4.3 规格第 1 条）', () => {
  const card = enumCard(3)
  const a = prepareOptions(card, bigPools(), S0, 'alice', 0, 1)
  const b = prepareOptions(card, bigPools(), S0, 'bob', 0, 1)
  expect(a).not.toEqual(b)
})

test('活要点校验：atomic 唯一要点退役 → 抛错（终审：防退役清空正确项）', () => {
  const card: OptionCard = {
    id: 'a9', blockId: 'b1', cardType: 'atomic',
    keyPoints: [kp('k0', { retiredAt: '2026-09-01' })],
  }
  expect(() => prepareOptions(card, bigPools(), S0, 'u1', 0, 1)).toThrow(/cardId=a9, cardType=atomic/)
})

test('活要点校验：全要点退役抛错；sequence 活要点缺 order 抛错（消息定位到卡）', () => {
  const allRetired: OptionCard = {
    id: 'e9', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0', { retiredAt: 'x' }), kp('k1', { retiredAt: 'x' })],
  }
  expect(() => prepareOptions(allRetired, bigPools(), S0, 'u1', 0, 1))
    .toThrow(/cardId=e9, cardType=enumeration/)

  const noOrder: OptionCard = {
    id: 'q9', blockId: 'b1', cardType: 'sequence',
    keyPoints: [kp('k0', { order: 1 }), kp('k1')],
  }
  expect(() => prepareOptions(noOrder, bigPools(), S0, 'u1', 0, 1))
    .toThrow(/cardId=q9, cardType=sequence/)

  // 部分退役但仍有活要点：正常出题，退役要点不出现
  const partial: OptionCard = {
    id: 'e8', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0', { retiredAt: 'x' }), kp('k1'), kp('k2')],
  }
  const r = prepareOptions(partial, bigPools(), S0, 'u1', 0, 1)
  expect(r.variants[0]!.correctIndices).toHaveLength(2)   // 只剩 2 条正确项
  expect(r.variants[0]!.optionTexts).not.toContain('T-k0')
})

test('degradedTo 上浮：两层枯竭走 neighbor 则顶层聚合为 neighbor；充足池为 none（终审 Ruling）', () => {
  const starved: DistractorPools = { sameBlock: [], crossBlock: poolOf('c', 1), neighbor: poolOf('n', 10) }
  const r = prepareOptions(enumCard(3), starved, S0, 'u1', 0, 2)
  expect(r.degradedTo).toBe('neighbor')
  expect(r.variants[0]!.optionTexts).toHaveLength(9)      // 降级不断供

  const ok = prepareOptions(enumCard(3), bigPools(), S0, 'u1', 0, 2)
  expect(ok.degradedTo).toBe('none')

  // sequence 无抽取，恒 'none'——即使池子枯竭也不受影响
  const seqCard: OptionCard = {
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [kp('k0', { order: 1 }), kp('k1', { order: 2 }), kp('k2', { order: 3 })],
  }
  expect(prepareOptions(seqCard, starved, S0, 'u1', 0, 2).degradedTo).toBe('none')
})
