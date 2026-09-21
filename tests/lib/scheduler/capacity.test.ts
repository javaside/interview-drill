import { binIntermediates, prefixCheck } from '../../../src/lib/scheduler/capacity.js'
import type { DayLoad } from '../../../src/lib/scheduler/capacity.js'

function load(entries: Array<[number, number]>): DayLoad {
  return new Map(entries)
}

test('空负载时中间次直接落位，末尾追加末次日', () => {
  const l = load([])
  const r = binIntermediates([1, 2, 3], 6, 'c1', l, 45)
  expect(r.plan).toEqual([1, 2, 3, 6])
  expect(r.dropped).toEqual([])
  expect(l.get(1)).toBe(1)
  expect(l.get(6)).toBeUndefined()   // 末次占位是调用方的职责，这里不动它
})

test('当天已满则往后推一天', () => {
  const l = load([[2, 1]])
  const r = binIntermediates([1, 2, 3], 6, 'c1', l, 1)
  // target 2 被占 → 推到 3；下一个 target 3 又被自己占 → 推到 4
  expect(r.plan).toEqual([1, 3, 4, 6])
  expect(r.dropped).toEqual([])
})

test('自己已占用的日子也要跳过（I2）', () => {
  const l = load([])
  const r = binIntermediates([3, 3], 9, 'c1', l, 45)
  // 第二个 target 3 已被自己的首个中间次占住（usedDays）→ 推到 4
  expect(r.plan).toEqual([3, 4, 9])
  expect(r.dropped).toEqual([])
})

test('推到末次前一天为止，无处可去则丢弃并记录目标日', () => {
  const l = load([[4, 1], [5, 1]])
  const r = binIntermediates([4], 6, 'c1', l, 1)
  expect(r.plan).toEqual([6])
  expect(r.dropped).toEqual([{ cardId: 'c1', reviewIndex: 0, plannedDay: 4 }])
})

test('目标日就是末次日时直接丢弃（中间次永不与末次同天）', () => {
  const l = load([])
  const r = binIntermediates([6], 6, 'c1', l, 45)
  expect(r.plan).toEqual([6])
  expect(r.dropped[0]!.plannedDay).toBe(6)
})

test('被推到极限的整条链：中间次全部挤在末次前', () => {
  // 容量 1，day 0..2 都被占，末次 4：中间 [0,1] 只能挤 3，另一条丢弃
  const l = load([[0, 1], [1, 1], [2, 1]])
  const r = binIntermediates([0, 1], 4, 'c1', l, 1)
  expect(r.plan).toEqual([3, 4])
  expect(r.dropped).toEqual([{ cardId: 'c1', reviewIndex: 1, plannedDay: 1 }])
})

test('前缀和：铺得开则不告警', () => {
  expect(prefixCheck(load([[0, 45], [1, 45]]), 45, 1)).toBeUndefined()
})

test('前缀和：首日就超 → 报 0', () => {
  expect(prefixCheck(load([[0, 50]]), 45, 5)).toBe(0)
})

test('前缀和：总量可行但前缀卡死 —— 报最早违反的 t', () => {
  // 评审 F3 反例的形状：总量 390 ≤ 29×30，但 day0 就有 90
  const l = load([[0, 90], [28, 300]])
  expect(prefixCheck(l, 30, 28)).toBe(0)
})

test('前缀和：违反发生在中段', () => {
  const l = load([[0, 45], [1, 46]])
  expect(prefixCheck(l, 45, 3)).toBe(1)
})

test('前缀和：恰好等于容量的边界不告警', () => {
  expect(prefixCheck(load([[0, 45], [1, 45], [2, 45]]), 45, 2)).toBeUndefined()
})
