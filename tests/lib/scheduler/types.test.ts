import {
  rat, cmpRat, weightedS, sortForScheduling, FREQ_ORDER,
} from '../../../src/lib/scheduler/types.js'
import type { SchedulableCard } from '../../../src/lib/scheduler/types.js'

test('有理数约分到最简', () => {
  expect(rat(6, 9)).toEqual({ num: 2, den: 3 })
  expect(rat(0, 5)).toEqual({ num: 0, den: 1 })
})

test('分母为 0 或负数直接抛错', () => {
  expect(() => rat(1, 0)).toThrow()
  expect(() => rat(1, -3)).toThrow()
})

test('交叉相乘比较：没有浮点陷阱', () => {
  expect(cmpRat(rat(1, 2), rat(2, 3))).toBeLessThan(0)
  expect(cmpRat(rat(2, 3), rat(2, 3))).toBe(0)
  expect(cmpRat(rat(1, 1), rat(5, 6))).toBeGreaterThan(0)
})

test('weightedS：空历史为 0', () => {
  expect(weightedS([])).toEqual({ num: 0, den: 1 })
})

test('weightedS：单次即自身', () => {
  expect(weightedS([rat(2, 3)])).toEqual({ num: 2, den: 3 })
})

test('weightedS：三次满分 = 1', () => {
  expect(weightedS([rat(1, 1), rat(1, 1), rat(1, 1)])).toEqual({ num: 1, den: 1 })
})

test('weightedS：3:2:1 加权且顺序敏感（最新一次权重最大）', () => {
  // [新→旧] = [满分, 0, 0] → (3·1)/(3+2+1) = 1/2
  expect(weightedS([rat(1, 1), rat(0, 1), rat(0, 1)])).toEqual(rat(1, 2))
  // [新→旧] = [0, 满分, 0] → 2/6 = 1/3 —— 同样一次满分，位置不同结果不同
  expect(weightedS([rat(0, 1), rat(1, 1), rat(0, 1)])).toEqual(rat(1, 3))
})

test('weightedS：不足 3 次按已有次数归一', () => {
  // 两次各 1/2 → (3·1/2 + 2·1/2)/(3+2) = (3/2+1)/5 = 5/2 / 5 = 1/2
  expect(weightedS([rat(1, 2), rat(1, 2)])).toEqual(rat(1, 2))
})

test('排序：frequency 降序，同频 cardId 升序', () => {
  const cards: SchedulableCard[] = [
    { id: 'b', frequency: 'mid' },
    { id: 'a', frequency: 'low' },
    { id: 'd', frequency: 'high' },
    { id: 'c', frequency: 'high' },
  ]
  expect(sortForScheduling(cards).map(c => c.id)).toEqual(['c', 'd', 'b', 'a'])
})

test('排序不修改输入数组', () => {
  const cards: SchedulableCard[] = [
    { id: 'x2', frequency: 'low' },
    { id: 'x1', frequency: 'high' },
  ]
  sortForScheduling(cards)
  expect(cards.map(c => c.id)).toEqual(['x2', 'x1'])
})

test('FREQ_ORDER 权重：high=3 mid=2 low=1', () => {
  expect(FREQ_ORDER).toEqual({ high: 3, mid: 2, low: 1 })
})
