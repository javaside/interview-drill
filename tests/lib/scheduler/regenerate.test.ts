import {
  failed, regenerateAfterFailure, maintenanceStep, MAINTAIN_INTERVALS,
} from '../../../src/lib/scheduler/regenerate.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const CARD: SchedulableCard = { id: 'c1', frequency: 'high' }
function state(over: Partial<CardState> = {}): CardState {
  return {
    cardId: 'c1', phase: 'learning', s: rat(1, 3), plan: [0, 5, 12],
    phaseIndex: 2, reviewCount: 6, ...over,
  }
}

test('failed：< 1/2 用交叉相乘判定', () => {
  expect(failed(rat(1, 2))).toBe(false)   // 恰好 1/2 不算失败
  expect(failed(rat(2, 5))).toBe(true)
  expect(failed(rat(1, 3))).toBe(true)
  expect(failed(rat(0, 1))).toBe(true)
  expect(failed(rat(5, 6))).toBe(false)
})

test('答错重排从明天起：plan 不含今天，首项是 1（§5.5 / 评审 F5）', () => {
  const load = new Map<number, number>()
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  expect(r.plan[0]).toBe(1)
  expect(r.plan).not.toContain(0)
  expect(r.plan).toEqual([1, 2, 4, 8, 16, 20])   // tier 退回 0
  expect(r.dropped).toEqual([])
})

test('新阶梯装进现有占用图：被占的天往后推（§5.5 只重排这一张）', () => {
  const load = new Map<number, number>([[1, 45]])   // 明天已满
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  expect(r.plan[0]).toBe(2)                          // 推到后天
  expect(r.dropped).toEqual([])
})

test('E=0（就绪日就是明天）：没有"明天"可排，返回空计划——绝不当天回队', () => {
  const r = regenerateAfterFailure(CARD, state(), { E: 0, load: new Map(), capacity: 45 })
  expect(r.plan).toEqual([])
})

test('E=1：重排就是明天（= 末次目标日）一次', () => {
  const r = regenerateAfterFailure(CARD, state(), { E: 1, load: new Map(), capacity: 45 })
  expect(r.plan).toEqual([1])
})

test('重排结果保持 I2 严格递增', () => {
  const load = new Map<number, number>([[2, 45], [3, 45], [4, 45]])
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  for (let i = 1; i < r.plan.length; i++) {
    expect(r.plan[i]! - r.plan[i - 1]!).toBeGreaterThan(0)
  }
})

test('计划耗尽语义（v2）：shouldMarkDone 已删除——计划耗尽由 transitionCard 兜底转维持滚动', () => {
  // 自动 done 废除（v2）：原 shouldMarkDone 的边界语义（逾期卡不得被 done 挡在队列外）
  // 由兜底机制天然满足——耗尽即得 [today+interval]，永不为空、永不 done。
  expect(MAINTAIN_INTERVALS).toEqual([1, 3, 7, 15, 30, 60, 120])
  expect(maintenanceStep(0, rat(0, 1)).nextInDays).toBe(1)   // 答错 → 明天
})

test('维持间隔表：到 120 天封顶不再增长（§5.7）', () => {
  expect(MAINTAIN_INTERVALS).toEqual([1, 3, 7, 15, 30, 60, 120])
})

test('maintenanceStep：≥1/2 进档，间隔取新档的值', () => {
  expect(maintenanceStep(0, rat(1, 2))).toEqual({ k: 1, nextInDays: 3 })
  expect(maintenanceStep(3, rat(5, 6))).toEqual({ k: 4, nextInDays: 30 })
})

test('maintenanceStep：<1/2 退回第 0 档，次日再刷', () => {
  expect(maintenanceStep(5, rat(2, 5))).toEqual({ k: 0, nextInDays: 1 })
})

test('maintenanceStep：表尾满分也停在 120 天（§5.7 封顶）', () => {
  expect(maintenanceStep(6, rat(1, 1))).toEqual({ k: 6, nextInDays: 120 })
})
