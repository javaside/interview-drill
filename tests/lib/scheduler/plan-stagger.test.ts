import { newPerDayOf, firstExposureOffset, assignFinalDays } from '../../../src/lib/scheduler/plan.js'
import type { SchedulableCard } from '../../../src/lib/scheduler/types.js'

function cards(ids: string[], freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return ids.map(id => ({ id, frequency: freq }))
}

test('新卡配额 = max(1, floor(容量×0.35))', () => {
  expect(newPerDayOf(45)).toBe(15)
  expect(newPerDayOf(100)).toBe(35)
  expect(newPerDayOf(2)).toBe(1)    // 极小容量也至少 1，保证 I3
})

test('首次曝光按排位错峰：容量 45 → 每 15 张一天', () => {
  expect(firstExposureOffset(0, 45, 20)).toBe(0)
  expect(firstExposureOffset(14, 45, 20)).toBe(0)
  expect(firstExposureOffset(15, 45, 20)).toBe(1)
  expect(firstExposureOffset(45, 45, 20)).toBe(3)
})

test('offset 永不超过 E —— 短窗口时不把首次曝光排到窗口外', () => {
  expect(firstExposureOffset(1000, 45, 5)).toBe(5)
})

test('末次窗口：高频最靠近 E，从 E 往前按容量贪心填', () => {
  const cs = [
    ...cards(['h1', 'h2'], 'high'),
    ...cards(['m1', 'm2'], 'mid'),
    ...cards(['l1'], 'low'),
  ]
  const finals = assignFinalDays(cs, 2, 6)
  expect(finals.get('h1')).toBe(6)
  expect(finals.get('h2')).toBe(6)
  expect(finals.get('m1')).toBe(5)
  expect(finals.get('m2')).toBe(5)
  expect(finals.get('l1')).toBe(4)
})

test('同频内按 cardId 升序占位 —— 输出确定', () => {
  const cs = cards(['b', 'a', 'c'], 'high')
  const finals = assignFinalDays(cs, 1, 6)
  expect(finals.get('a')).toBe(6)
  expect(finals.get('b')).toBe(5)
  expect(finals.get('c')).toBe(4)
})

test('100 张 / 容量 45：末次摊到 4 天，每天 ≤ 45', () => {
  const cs = cards(Array.from({ length: 100 }, (_, i) => `c${String(i).padStart(3, '0')}`))
  const finals = assignFinalDays(cs, 45, 20)
  const perDay = new Map<number, number>()
  for (const day of finals.values()) perDay.set(day, (perDay.get(day) ?? 0) + 1)
  expect(perDay.get(20)).toBe(45)
  expect(perDay.get(19)).toBe(45)
  expect(perDay.get(18)).toBe(10)
  expect(Math.max(...perDay.values())).toBeLessThanOrEqual(45)
})

test('E = 0：全部末次落在今天（唯一容量豁免路径的构造）', () => {
  const finals = assignFinalDays(cards(['a', 'b', 'c'], 'high'), 1, 0)
  expect([...finals.values()]).toEqual([0, 0, 0])
})

test('fw 起始 = ceil(n/C)：n 张卡恰好摊满窗口', () => {
  // 91 张 / 容量 45 → fw=3 → 最早末次日在 E-2
  const cs = cards(Array.from({ length: 91 }, (_, i) => `c${i}`))
  const finals = assignFinalDays(cs, 45, 20)
  expect(Math.min(...finals.values())).toBe(18)   // 20-3+1
})
