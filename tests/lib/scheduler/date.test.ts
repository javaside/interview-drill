import { diffDays, addDays } from '../../../src/lib/scheduler/date.js'

test('同日差为 0', () => {
  expect(diffDays('2026-09-21', '2026-09-21')).toBe(0)
})

test('日差按日历天，跨月正确', () => {
  expect(diffDays('2026-10-01', '2026-09-21')).toBe(10)
  expect(diffDays('2026-09-21', '2026-10-01')).toBe(-10)
})

test('闰年二月：2024-02-28 → 2024-03-01 是 2 天', () => {
  expect(diffDays('2024-03-01', '2024-02-28')).toBe(2)
})

test('addDays 跨月与回退', () => {
  expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  expect(addDays('2026-09-21', -5)).toBe('2026-09-16')
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
})

test('日期字符串全程走 UTC 午夜——DST 切换日也是整数天', () => {
  // 美 DST 2026-03-08 切换。禁令（§5.1）针对的是「本地时区构造再取毫秒差」——
  // 那才会在 23/25 小时日得到 0.96/1.04。本实现两端都走 Date.UTC 午夜，
  // 毫秒差恒为 86400000 的整数倍，Math.round 是精确的。这条测试锁住
  // 「全程 UTC 构造」，跨 DST 日的 diff 仍是精确整数天。
  expect(diffDays('2026-03-10', '2026-03-08')).toBe(2)
})

test('非法格式被拒', () => {
  expect(() => diffDays('2026-9-1', '2026-09-01')).toThrow()
  expect(() => addDays('2026/09/21', 1)).toThrow()
})

test('不存在的日历日被拒（2026-02-30）', () => {
  expect(() => addDays('2026-02-30', 1)).toThrow()
})
