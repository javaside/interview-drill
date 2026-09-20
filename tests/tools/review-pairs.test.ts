import { buildPairs, countPairs } from '../../tools/review/pairs.js'
import type { Card, KeyPoint } from '../../src/lib/content/types.js'

function kp(id: string, excl: string[] = []): KeyPoint {
  return {
    id, text: `要点 ${id}`, public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: excl, confirmedIndependentOf: [],
    source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
  }
}
function card(id: string, blockId: string, kps: KeyPoint[]): Card {
  return {
    id, blockId, relatedBlocks: [], question: `问题 ${id}？`, cardType: 'enumeration',
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
  }
}

test('组合数 = 要点数 × 同块其他题数', () => {
  const cards = [
    card('c1', 'b1', [kp('k1'), kp('k2')]),
    card('c2', 'b1', [kp('k3')]),
    card('c3', 'b1', [kp('k4')]),
  ]
  // c1 的 2 条 × 2 题 + c2 的 1 条 × 2 题 + c3 的 1 条 × 2 题 = 8
  expect(countPairs(cards, 'b1')).toBe(8)
})

test('只在同块内生成组合', () => {
  const cards = [card('c1', 'b1', [kp('k1')]), card('c2', 'b2', [kp('k2')])]
  expect(buildPairs(cards, 'b1')).toEqual([])
})

test('要点不与自己所属的卡配对', () => {
  const cards = [card('c1', 'b1', [kp('k1')]), card('c2', 'b1', [kp('k2')])]
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.every(p => p.ownerCardId !== p.targetCardId)).toBe(true)
  expect(pairs).toHaveLength(2)
  // 文本字段必须真的带出来 —— 人工确认界面全靠它们，清空了也看不出来
  const p0 = pairs.find(p => p.keyPointId === 'k1')!
  expect(p0.keyPointText).toBe('要点 k1')
  expect(p0.targetQuestion).toBe('问题 c2？')
})

test('已登记过的组合被跳过，避免重复人工确认', () => {
  const cards = [
    card('c1', 'b1', [kp('k1', ['c2'])]),
    card('c2', 'b1', [kp('k2')]),
  ]
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.find(p => p.keyPointId === 'k1' && p.targetCardId === 'c2')).toBeUndefined()
  expect(pairs).toHaveLength(1)
})

test('答过"否"的组合也被跳过，不重复询问', () => {
  const cards = [
    card('c1', 'b1', [kp('k1', [])]),
    card('c2', 'b1', [kp('k2')]),
  ]
  cards[0]!.keyPoints[0]!.confirmedIndependentOf = ['c2']
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.find(p => p.keyPointId === 'k1' && p.targetCardId === 'c2')).toBeUndefined()
})

test('退役卡不参与组合', () => {
  const cards = [
    card('c1', 'b1', [kp('k1')]),
    { ...card('c2', 'b1', [kp('k2')]), retiredAt: '2026-01-01' },
  ]
  expect(buildPairs(cards, 'b1')).toEqual([])
})
