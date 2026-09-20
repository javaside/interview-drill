import { screenPairs } from '../../tools/review/recall.js'
import type { Pair } from '../../tools/review/pairs.js'

const pairs: Pair[] = [
  { ownerCardId: 'c1', keyPointId: 'k1', keyPointText: 'B+ 树非叶子节点只存键', targetCardId: 'c2', targetQuestion: '为什么用 B+ 树？' },
  { ownerCardId: 'c1', keyPointId: 'k2', keyPointText: 'undo log 用于回滚', targetCardId: 'c2', targetQuestion: '为什么用 B+ 树？' },
]

test('只保留打分超过阈值的组合', async () => {
  const score = async (p: Pair) => (p.keyPointId === 'k1' ? 0.9 : 0.1)
  const flagged = await screenPairs(pairs, score, 0.5)
  expect(flagged.map(f => f.pair.keyPointId)).toEqual(['k1'])
})

test('召回导向：阈值调低会保留更多，不会漏掉高分项', async () => {
  const score = async () => 0.3
  expect(await screenPairs(pairs, score, 0.5)).toHaveLength(0)
  expect(await screenPairs(pairs, score, 0.2)).toHaveLength(2)
})

test('打分函数抛错时该组合被保留，不被静默丢弃', async () => {
  const score = async (p: Pair) => {
    if (p.keyPointId === 'k1') throw new Error('API 超时')
    return 0.1
  }
  const flagged = await screenPairs(pairs, score, 0.5)
  expect(flagged.map(f => f.pair.keyPointId)).toEqual(['k1'])
  expect(flagged[0]!.reason).toContain('打分失败')
})
