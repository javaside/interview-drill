import { localDateOf, clampReviewedAt, MAX_CLOCK_SKEW_MS } from '../../src/server/time.js'
import { ALGO_VERSION } from '../../src/server/version.js'

test('ALGO_VERSION 钉死 v2（计划 6 常备模式：耗尽转维持滚动）', () => expect(ALGO_VERSION).toBe('v2'))

test('localDateOf：按用户时区判日历日——同一瞬时不同时区可差一天', () => {
  const instant = Date.UTC(2026, 8, 21, 17, 0)   // 2026-09-21T17:00Z
  expect(localDateOf(instant, 'Asia/Shanghai')).toBe('2026-09-22')   // +8 → 次日 01:00
  expect(localDateOf(instant, 'UTC')).toBe('2026-09-21')
  expect(localDateOf(instant, 'America/New_York')).toBe('2026-09-21')
})

test('localDateOf：跨 DST 也按当地日历日（@date-fns/tz，不经 Intl）', () => {
  // 美 DST 2026-11-01 结束（2:00 回拨）；当日 06:30Z 在纽约仍是 10-31 深夜？不——06:30Z=02:30 EDT=01:30 EST
  const t = Date.UTC(2026, 10, 1, 6, 30)
  expect(localDateOf(t, 'America/New_York')).toBe('2026-11-01')
})

test('localDateOf：非法时区抛错', () => {
  expect(() => localDateOf(0, 'Mars/Olympus')).toThrow()
})

test('clampReviewedAt：三条路径', () => {
  const now = 1_000_000
  expect(clampReviewedAt(now - 10, null, now)).toEqual({ ms: now - 10, clamped: null })
  expect(clampReviewedAt(5, 10, now)).toEqual({ ms: 11, clamped: 'past' })          // 早于上一条 → last+1ms
  expect(clampReviewedAt(now + MAX_CLOCK_SKEW_MS + 1, null, now)).toEqual({ ms: now, clamped: 'future' })
  expect(clampReviewedAt(now + 1000, null, now)).toEqual({ ms: now + 1000, clamped: null })  // 容差内
  expect(MAX_CLOCK_SKEW_MS).toBe(300_000)
})
