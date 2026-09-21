import { INTERVALS, bufferOf, startTier, layLadder } from '../../../src/lib/scheduler/plan.js'
import { rat } from '../../../src/lib/scheduler/types.js'

test('绝对间隔阶梯', () => {
  expect(INTERVALS).toEqual([1, 2, 4, 8, 16, 32, 64])
})

test('buffer 是查表：主场景恒 1，长窗口最多 3', () => {
  expect(bufferOf(0)).toBe(1)
  expect(bufferOf(7)).toBe(1)
  expect(bufferOf(29)).toBe(1)
  expect(bufferOf(30)).toBe(2)
  expect(bufferOf(49)).toBe(2)
  expect(bufferOf(50)).toBe(3)
  expect(bufferOf(120)).toBe(3)
})

test('起始档：new 是独立状态，直接第 0 档', () => {
  expect(startTier('new', rat(1, 1))).toBe(0)
})

test('起始档：分数比较，2/3 必须落在第 2 档（旧浮点 0.67 的回归守卫）', () => {
  expect(startTier('learning', rat(0, 1))).toBe(0)
  expect(startTier('learning', rat(1, 3))).toBe(1)
  expect(startTier('learning', rat(1, 2))).toBe(1)
  expect(startTier('learning', rat(2, 3))).toBe(2)   // 0.6667 < 0.67 曾把它挤去下一档
  expect(startTier('learning', rat(5, 6))).toBe(2)
  expect(startTier('learning', rat(1, 1))).toBe(3)
})

test('spec §5.2 的实测样例逐一对上（offset=0，新卡）', () => {
  expect(layLadder(0, 0, 20)).toEqual([0, 1, 3, 7, 15, 20])
  expect(layLadder(0, 0, 6)).toEqual([0, 1, 3, 6])
  expect(layLadder(0, 0, 4)).toEqual([0, 1, 3, 4])
  expect(layLadder(0, 0, 2)).toEqual([0, 1, 2])
  expect(layLadder(0, 0, 0)).toEqual([0])
})

test('起始档越高，铺出的复习越少', () => {
  // 同样 E=20：tier 1 有 +2/+4/+8 三跳；tier 3 只有一跳 8 天
  //（下一跳 8+16=24 已越窗，被截断——末项由 target 补上）
  expect(layLadder(0, 1, 20)).toEqual([0, 2, 6, 14, 20])
  expect(layLadder(0, 3, 20)).toEqual([0, 8, 20])
})

test('错峰起点：offset 平移整条阶梯', () => {
  expect(layLadder(3, 0, 10)).toEqual([3, 4, 6, 10])
  expect(layLadder(1, 0, 6)).toEqual([1, 2, 4, 6])
})

test('target ≤ offset 时只有一次复习', () => {
  expect(layLadder(5, 0, 5)).toEqual([5])
})

test('结果永远严格递增（I2 的构造性保证）', () => {
  for (let offset = 0; offset <= 8; offset++) {
    for (let tier = 0; tier <= 3; tier++) {
      for (let target = offset; target <= 25; target++) {
        const p = layLadder(offset, tier, target)
        expect(p[0]).toBe(Math.min(offset, target))
        expect(p[p.length - 1]).toBe(target)
        for (let i = 1; i < p.length; i++) {
          expect(p[i]! - p[i - 1]!).toBeGreaterThan(0)
        }
      }
    }
  }
})
