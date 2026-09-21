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

test('sequence：选项不打乱——按 order 排列，无干扰项，K 份变体全同（§4.3 强制例外 / §11）', () => {
  // keyPoints 数组故意乱序存放，order 才是答案；order 与 id 对齐（k0=1..k3=4）
  const card: OptionCard = {
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [
      kp('k2', { order: 3 }), kp('k0', { order: 1 }),
      kp('k3', { order: 4 }), kp('k1', { order: 2 }),
    ],
  }
  const r = prepareOptions(card, bigPools(), S0, 'u1', 0, 3)
  for (const v of r.variants) {
    expect(v.optionTexts).toEqual(['T-k0', 'T-k1', 'T-k2', 'T-k3'])   // order 1..4
    expect(v.correctIndices).toEqual([0, 1, 2, 3])                    // 呈现序即正确序
    expect(v.distractorKeyPointIds).toEqual([])
  }
  expect(r.variants[0]).toEqual(r.variants[1])
  expect(r.variants[1]).toEqual(r.variants[2])
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
