import { schedule, DEFAULT_CAPACITY } from '../../../src/lib/scheduler/schedule.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'   // R=21 → buffer 1 → E=20

function cards(n: number, freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(3, '0')}`, frequency: freq,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
function states(cs: SchedulableCard[], over?: (id: string) => Partial<CardState>): CardState[] {
  return cs.map(c => newState(c.id, over?.(c.id)))
}

test('默认容量 45（§5.4）', () => {
  expect(DEFAULT_CAPACITY).toBe(45)
})

test('I3：R≥0 且有新卡时 todayQueue 非空，首日量 = 新卡配额', () => {
  const cs = cards(30)
  const r = schedule(cs, states(cs), READY_R21, 45, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.todayQueue).toHaveLength(15)          // newPerDay = floor(45×0.35)
  expect(r.todayQueue.every(q => q.reason === 'due')).toBe(true)
})

test('30 张 / R=21：不告警，无丢弃', () => {
  const cs = cards(30)
  const r = schedule(cs, states(cs), READY_R21, 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r.overloadWarning.dropped).toEqual([])
})

test('R < 0：走维持模式并提示更新日期', () => {
  const cs = cards(3)
  const st = states(cs, () => ({ phase: 'learning', plan: [-2, 4] }))
  const r = schedule(cs, st, '2026-09-20', 45, TODAY)
  expect(r.mode).toBe('maintenance')
  expect(r.needsDateUpdate).toBe(true)
  // 三张卡都逾期 2 天，按 (最早逾期, cardId) 排
  expect(r.todayQueue).toEqual([
    { cardId: 'c000', reason: 'overdue' },
    { cardId: 'c001', reason: 'overdue' },
    { cardId: 'c002', reason: 'overdue' },
  ])
  expect(r.plans.size).toBe(0)
})

test('未设就绪日：维持模式，不提示更新', () => {
  const cs = cards(3)
  const r = schedule(cs, states(cs, () => ({ phase: 'new', plan: [] })), null, 45, TODAY)
  expect(r.mode).toBe('maintenance')
  expect(r.needsDateUpdate).toBe(false)
  // 无计划的新卡首次曝光就是今天（I3 在维持模式同样成立）
  expect(r.todayQueue).toHaveLength(3)
})

test('E=0（就绪日就在明天）：全部排今天，唯一容量豁免且必告警', () => {
  const cs = cards(10)
  const r = schedule(cs, states(cs), '2026-09-22', 3, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.plans.size).toBe(10)
  for (const plan of r.plans.values()) expect(plan).toEqual([0])
  expect(r.todayQueue).toHaveLength(10)
  expect(r.overloadWarning.earliestOverloadDay).toBe(0)
})

test('I4：已有计划的卡不被重算，plans 里没有它们', () => {
  const cs = cards(5)
  const st = states(cs, () => ({ phase: 'learning', s: rat(1, 2), plan: [1, 5] }))
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.plans.size).toBe(0)
  expect(r.todayQueue).toEqual([])   // plan [1,5]：无今天、无逾期
})

test('逾期卡排在队首且剩余计划不变', () => {
  const cs = cards(3)
  const st = [
    newState('c000', { phase: 'learning', plan: [-5, 3] }),
    newState('c001', { phase: 'learning', plan: [-1, 2] }),
    newState('c002', { phase: 'learning', plan: [0, 4] }),
  ]
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['c000', 'c001', 'c002'])
  expect(r.todayQueue.map(q => q.reason)).toEqual(['overdue', 'overdue', 'due'])
  expect(r.plans.size).toBe(0)      // 逾期不触发重排（§5.5）
})

test('paused 卡不进队列也不重排，plan 保留', () => {
  const cs = cards(2)
  const st = [
    newState('c000', { phase: 'paused', plan: [0, 3] }),
    newState('c001', { phase: 'learning', plan: [0, 3] }),
  ]
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['c001'])
})

test('超载：100 张 / R=3 / 容量 10 → 前缀和告警报出最早违反日', () => {
  const cs = cards(100)
  const r = schedule(cs, states(cs), '2026-09-24', 10, TODAY)   // R=3 → E=2
  expect(r.overloadWarning.earliestOverloadDay).toBe(0)
})

test('输入确定则输出确定', () => {
  const cs = cards(40, 'high').map((c, i) =>
    i % 3 === 0 ? c : { ...c, frequency: i % 3 === 1 ? 'mid' as const : 'low' as const })
  const st = states(cs)
  const a = schedule(cs, st, READY_R21, 45, TODAY)
  const b = schedule(cs, st, READY_R21, 45, TODAY)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  // JSON.stringify 把 Map 序列化成 {}——plans 内容必须单独比，否则确定性测试名不副实
  expect([...a.plans.entries()]).toEqual([...b.plans.entries()])
})
