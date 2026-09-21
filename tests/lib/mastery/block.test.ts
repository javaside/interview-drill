import { blockMastery } from '../../../src/lib/mastery/block.js'
import type { BlockEntry } from '../../../src/lib/mastery/block.js'

const q = (num: number, den: number) => ({ num, den })

test('权重加权：high 满分 + mid 满分 + low 零分 = 5/6（§4.4）', () => {
  const r = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 1) },
    { frequency: 'mid', phase: 'learning', s: q(1, 1) },
    { frequency: 'low', phase: 'learning', s: q(0, 1) },
  ])
  expect(r).toEqual({ kind: 'score', value: { num: 5, den: 6 } })
})

test('new 不进分母：混入 new(满分, high) 不改变结果；全 new → 未刷', () => {
  const learning: BlockEntry = { frequency: 'low', phase: 'learning', s: q(0, 1) }
  expect(blockMastery([learning, { frequency: 'high', phase: 'new', s: q(1, 1) }]))
    .toEqual(blockMastery([learning]))
  expect(blockMastery([{ frequency: 'high', phase: 'new', s: q(1, 1) }]))
    .toEqual({ kind: 'untried' })
})

test('paused 不进分母（块被取消 = 不在当前计划内）；done 计入', () => {
  const r = blockMastery([
    { frequency: 'high', phase: 'paused', s: q(1, 1) },
    { frequency: 'mid', phase: 'done', s: q(1, 1) },
  ])
  expect(r).toEqual({ kind: 'score', value: { num: 1, den: 1 } })
})

test('空块 → 未刷（地图显示"未刷"而非 0%，§4.4）', () => {
  expect(blockMastery([])).toEqual({ kind: 'untried' })
})

test('权重真的起作用：同两个分数，频度排布不同结果不同', () => {
  const a = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 2) },
    { frequency: 'low', phase: 'learning', s: q(1, 1) },
  ])
  const b = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 1) },
    { frequency: 'low', phase: 'learning', s: q(1, 2) },
  ])
  expect(a).toEqual({ kind: 'score', value: { num: 5, den: 8 } })
  expect(b).toEqual({ kind: 'score', value: { num: 7, den: 8 } })
})

test('逐步归约防溢出：50 张 high 卡 s=5/6 → 恰好 5/6（连乘分母会在块规模内溢出）', () => {
  const entries = Array.from({ length: 50 }, () => ({
    frequency: 'high' as const, phase: 'learning' as const, s: q(5, 6),
  }))
  expect(blockMastery(entries)).toEqual({ kind: 'score', value: { num: 5, den: 6 } })
})
