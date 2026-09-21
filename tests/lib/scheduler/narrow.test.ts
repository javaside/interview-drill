import { schedule, reservedLoadOf } from '../../../src/lib/scheduler/schedule.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'

function cards(n: number): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(4, '0')}`, frequency: 'mid' as const,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}

test('reservedLoadOf：存量计划的每日占用被汇总', () => {
  const sts = [
    newState('a', { phase: 'learning', plan: [0, 3] }),
    newState('b', { phase: 'learning', plan: [3, 7] }),
  ]
  expect(reservedLoadOf(sts)).toEqual(new Map([[0, 1], [3, 2], [7, 1]]))
})

test('reservedLoadOf：paused 的计划不占容量，负偏移（逾期）不计入', () => {
  const sts = [
    newState('a', { phase: 'paused', plan: [1, 4] }),
    newState('b', { phase: 'learning', plan: [-3, 5] }),
  ]
  expect(reservedLoadOf(sts)).toEqual(new Map([[5, 1]]))
})

test('1200 张 / 3 周 / 容量 45：前缀和告警 + 收窄建议（§11 边界）', () => {
  const cs = cards(1200)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeDefined()
  const n = r.overloadWarning.narrowTo!.length
  // spec §5.6 的 157 是槽位上界（945÷6）；阶梯结构（day18 末次挤占
  // offset-3 队列的末条中间次）使实际可行前缀低于上界。设计推导确认
  // k=120 干净可行，故下界 100 是安全的。
  expect(n).toBeGreaterThanOrEqual(100)
  expect(n).toBeLessThanOrEqual(170)
  expect(r.overloadWarning.suggestedCount).toBe(n)
})

test('收窄建议执行后重跑：真的可行，不再告警（§11 边界）', () => {
  const cs = cards(1200)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  const narrowed = r.overloadWarning.narrowTo!
  const r2 = schedule([...narrowed], narrowed.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r2.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r2.overloadWarning.dropped).toEqual([])
  expect(r2.overloadWarning.narrowTo).toBeUndefined()
})

test('不超载时没有收窄建议', () => {
  const cs = cards(20)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r.overloadWarning.narrowTo).toBeUndefined()
})

test('窗口被 reservedLoad 全占满：收窄只能为空，且告警不静默', () => {
  const reserved = new Map(Array.from({ length: 21 }, (_, t) => [t, 45]))
  const cs = cards(5)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY, reserved)
  expect(r.overloadWarning.earliestOverloadDay).toBeDefined()
  expect(r.overloadWarning.narrowTo).toEqual([])
})
