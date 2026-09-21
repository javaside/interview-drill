import { schedule } from '../../../src/lib/scheduler/schedule.js'
import { addDays } from '../../../src/lib/scheduler/date.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'

function mixed(n: number): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(3, '0')}`,
    frequency: (['high', 'mid', 'low'] as const)[i % 3]!,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
const statesOf = (cs: SchedulableCard[]) => cs.map(c => newState(c.id))

test.each([0, 1, 2, 3])('边界 R=%i：不崩、不空队列、末次落在 E（§11）', R => {
  const cs = mixed(12)
  const readyBy = addDays(TODAY, R)
  const r = schedule(cs, statesOf(cs), readyBy, 45, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.todayQueue.length).toBeGreaterThan(0)
  const E = R <= 1 ? 0 : R - 1
  expect(r.plans.size).toBe(12)
  for (const plan of r.plans.values()) {
    expect(plan[plan.length - 1]).toBeLessThanOrEqual(E)
    // E=0 是豁免路径；E≥1 时 fw=1（12 张 ≤ 45），末次严格落在 E
    if (E >= 1) expect(plan[plan.length - 1]).toBe(E)
  }
})

test('I1：末次落在末端窗口内，高频卡最贴近 E（§11）', () => {
  const cs = mixed(100)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)  // E=20
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  const byId = new Map(cs.map(c => [c.id, c]))
  for (const [id, plan] of r.plans) {
    const last = plan[plan.length - 1]!
    expect(last).toBeGreaterThanOrEqual(18)   // fw = ceil(100/45) = 3
    expect(last).toBeLessThanOrEqual(20)
    if (byId.get(id)!.frequency === 'high') expect(last).toBe(20)
  }
})

test('I2 + I5：严格递增，同卡不同天；每天负载 ≤ 容量（§11）', () => {
  const cs = mixed(100)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)
  const perDay = new Map<number, number>()
  for (const plan of r.plans.values()) {
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]! - plan[i - 1]!).toBeGreaterThan(0)
    }
    for (const d of plan) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(45)
})

test('一张卡连续通过到面试：复习次数 = 计划长度，不发散（§11）', () => {
  const cs = mixed(30)
  const readyBy = addDays(TODAY, 21)
  const r0 = schedule(cs, statesOf(cs), readyBy, 45, TODAY)
  const live = [...r0.plans].map(([id, plan]) => ({ id, plan: [...plan] }))
  const initialTotal = live.reduce((a, p) => a + p.plan.length, 0)

  let consumed = 0
  for (let day = 0; day <= 20; day++) {
    const today = addDays(TODAY, day)
    const states = live.map(p => newState(p.id, {
      // 全部按时刷完：空计划即 done，防止被当成 fresh 重新生成
      phase: p.plan.length > 0 ? ('learning' as const) : ('done' as const),
      plan: p.plan.map(d => d - day),
    }))
    const r = schedule(cs, states, readyBy, 45, today)
    expect(r.plans.size).toBe(0)          // I4：通过从不触发重排
    for (const p of live) {
      consumed += p.plan.filter(d => d <= day).length
      p.plan = p.plan.filter(d => d > day)
    }
  }
  expect(consumed).toBe(initialTotal)     // 承诺几遍就刷几遍
})

test('只选 1 个块（20 题）：不告警，正常排满窗口（§11）', () => {
  const cs = mixed(20)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r.overloadWarning.dropped).toEqual([])
  // 新卡在 3 周窗口里至少铺出 5 次复习（[0,1,3,7,15,20]）
  expect([...r.plans.values()].every(p => p.length >= 5)).toBe(true)
})
