import { schedule, reservedLoadOf, generateFreshPlans } from '../../../src/lib/scheduler/schedule.js'
import { pauseCards, cramForInterview } from '../../../src/lib/scheduler/regenerate.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'

function mkCards(prefix: string, n: number, freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${String(i).padStart(2, '0')}`, frequency: freq }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
function statesOf(cs: SchedulableCard[], over?: (c: SchedulableCard) => Partial<CardState>): CardState[] {
  return cs.map(c => newState(c.id, over?.(c)))
}

test('加块：已有卡的计划不在新 plans 里（逐字节不变由调用方保留），新卡进队列', () => {
  const a = mkCards('a', 2)
  const aStates = statesOf(a, () => ({ phase: 'learning', plan: [0, 3, 7] }))
  const b = mkCards('b', 10)
  const r = schedule(b, statesOf(b), READY_R21, 45, TODAY, reservedLoadOf(aStates))
  expect(r.plans.has('a00')).toBe(false)
  expect(r.todayQueue.some(q => q.cardId.startsWith('b'))).toBe(true)
  // 新卡装箱时看得见 A 块的占用：day0 已有 2 张，新卡配额仍照常错峰
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
})

test('加块撞容量：告警不静默（§5.5）', () => {
  const aStates = Array.from({ length: 21 }, (_, t) =>
    newState(`a${t}`, { phase: 'learning', plan: [t] }))
  const b = mkCards('b', 5)
  const r = schedule(b, statesOf(b), READY_R21, 45, TODAY, reservedLoadOf(aStates))
  // reservedLoad 每天恰好 1 张并非超载——构造真撞车：把容量调到 1
  const r2 = schedule(b, statesOf(b), READY_R21, 1, TODAY, reservedLoadOf(aStates))
  expect(r2.overloadWarning.earliestOverloadDay).toBeDefined()
})

test('减块：置 paused，不进 todayQueue，plan 原样保留（§5.5）', () => {
  const b = mkCards('b', 2)
  const st = [
    newState('b00', { phase: 'learning', plan: [0, 4] }),
    newState('b01', { phase: 'learning', plan: [0, 4] }),
    newState('a00', { phase: 'learning', plan: [0, 4] }),
  ]
  const paused = pauseCards(st, ['b00', 'b01'])
  expect(paused[0]).toMatchObject({ phase: 'paused' })
  expect(paused[0]!.plan).toEqual([0, 4])      // plan 保留
  const all = [...b, { id: 'a00', frequency: 'mid' as const }]
  const r = schedule(all, paused, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['a00'])
})

test('加→减→加 往返：计划与只加一次的结果一致（§11）', () => {
  const b = mkCards('b', 8)
  const r1 = schedule(b, statesOf(b), READY_R21, 45, TODAY)
  const persisted = [...r1.plans].map(([id, plan]) =>
    newState(id, { phase: 'learning', plan }))       // 调用方落盘
  // 减块
  const paused = pauseCards(persisted, b.map(c => c.id))
  // 重新勾选：续上保留的计划（不重排——I4），只是 phase 回到 learning
  const resumed = paused.map(st => ({ ...st, phase: 'learning' as const }))
  const r2 = schedule(b, resumed, READY_R21, 45, TODAY)
  expect(r2.plans.size).toBe(0)                       // 计划保留，未重新生成
  // todayQueue 来自保留下来的同一份计划 → 与只加一次时的语义一致
  expect(r2.todayQueue.map(q => q.cardId))
    .toEqual(r1.todayQueue.map(q => q.cardId))
})

test('临时加密：s 最低的卡被重排，其余不动，每天总负载 ≤ 容量（§5.8 / §11）', () => {
  const sValues = [rat(0, 1), rat(1, 6), rat(1, 3), rat(1, 2), rat(2, 3), rat(5, 6), rat(1, 1), rat(1, 1)]
  const cs = mkCards('c', 8)
  const stateMap = new Map(cs.map((c, i) => [c.id, newState(c.id, {
    phase: 'learning', s: sValues[i]!, plan: [3],
  })]))
  // 面试 2026-09-25 → readyBy 09-24 → R=3 → E=2；容量 2
  const r = cramForInterview(cs, stateMap, '2026-09-25', TODAY, 2, new Map())
  // 推演：k=3 时 c02 的末次落在 day1，c00 的中间次占掉 day1 最后一个槽，
  // c01 的中间次推到 day2=自己的末次 → drop → 不可行。k=2 干净：
  // 两张 [0,1,2]，负载 2/2/2。故可行前缀是 s 最低的两张。
  expect([...r.plans.keys()].sort()).toEqual(['c00', 'c01'])
  expect(r.excluded.map(c => c.id)).toEqual(['c02', 'c03', 'c04', 'c05', 'c06', 'c07'])
  const perDay = new Map<number, number>()
  for (const plan of r.plans.values()) {
    for (const d of plan) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(2)
})

test('临时加密的次日面试（E=0）：没有可排的窗口，全部保持原计划', () => {
  const cs = mkCards('c', 2)
  const stateMap = new Map(cs.map(c => [c.id, newState(c.id, { phase: 'learning', plan: [3] })]))
  const r = cramForInterview(cs, stateMap, '2026-09-22', TODAY, 45, new Map())
  expect(r.plans.size).toBe(0)
  expect(r.excluded).toHaveLength(2)   // 原计划由调用方保留，未被触碰
})

test('generateFreshPlans 已导出（cram 的依赖契约）', () => {
  expect(typeof generateFreshPlans).toBe('function')
})
