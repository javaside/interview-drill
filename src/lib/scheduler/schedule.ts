import { diffDays } from './date.js'
import type { LocalDate } from './date.js'
import { bufferOf, startTier, layLadder, firstExposureOffset, assignFinalDays } from './plan.js'
import { binIntermediates, prefixCheck } from './capacity.js'
import type { DayLoad, DroppedReview } from './capacity.js'
import { rat, sortForScheduling, compareCardId } from './types.js'
import type { CardState, SchedulableCard } from './types.js'

export const DEFAULT_CAPACITY = 45

export type QueueItem = { cardId: string; reason: 'overdue' | 'due' }

export type OverloadWarning = {
  /** 前缀和判据最早违反的天；E=0 豁免路径恒为 0 */
  earliestOverloadDay?: number
  dropped: DroppedReview[]
  /** 收窄建议（§5.4/§5.6）：按 (frequency 降序, cardId 升序) 的最大可行前缀 */
  narrowTo?: readonly SchedulableCard[]
  /** §5.6 口径文案的数字："这三周你能刷透约 N 道" */
  suggestedCount?: number
}

export type ScheduleResult = {
  mode: 'sprint' | 'maintenance'
  /** R<0 时为 true，调用方应提示用户更新就绪日 */
  needsDateUpdate: boolean
  todayQueue: QueueItem[]
  /** 只含本次新生成的计划（plan-once：已有计划的卡不出现、不被改动） */
  plans: ReadonlyMap<string, number[]>
  overloadWarning: OverloadWarning
}

/**
 * 为"无计划的卡"生成计划：错峰 → 末端窗口 → 装箱。
 * reservedLoad 先进 load（§5.1：不在 cards[] 里但已有计划的卡仍占容量）。
 */
export function generateFreshPlans(
  fresh: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  capacity: number,
  E: number,
  reservedLoad: ReadonlyMap<number, number>,
): { plans: Map<string, number[]>; load: DayLoad; dropped: DroppedReview[] } {
  const load: DayLoad = new Map(reservedLoad)
  const ordered = sortForScheduling(fresh)
  const finals = assignFinalDays(ordered, capacity, E)
  for (const day of finals.values()) load.set(day, (load.get(day) ?? 0) + 1)

  const plans = new Map<string, number[]>()
  const dropped: DroppedReview[] = []
  let newRank = 0
  for (const c of ordered) {
    const st = states.get(c.id)
    const phase = st?.phase ?? 'new'
    const s = st?.s ?? rat(0, 1)
    // 错峰配额只属于 new 卡（§5.2 ④）；learning 且无计划的卡是调用方
    // 重排路径的兜底，offset 0。已知取舍：维持模式批量转冲刺（§5.7"从空变为
    // 有值"）时这类卡全堆 day0——由 §5.4 告警与收窄兜底，不在引擎里特判。
    const offset = phase === 'new' ? firstExposureOffset(newRank++, capacity, E) : 0
    const target = finals.get(c.id)!
    const ladder = layLadder(offset, startTier(phase, s), target)
    const r = binIntermediates(ladder.slice(0, -1), target, c.id, load, capacity)
    plans.set(c.id, r.plan)
    dropped.push(...r.dropped)
  }
  return { plans, load, dropped }
}

/**
 * 组装今日队列：逾期卡在前（§5.5，最早逾期者最先），当天卡按
 * (frequency 降序, cardId 升序)。计划来源：新生成的 plans 优先，否则用存量。
 */
function buildQueue(
  cards: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  plans: ReadonlyMap<string, number[]>,
): QueueItem[] {
  const overdue: Array<{ key: number; cardId: string }> = []
  const due: SchedulableCard[] = []
  for (const c of cards) {
    const st = states.get(c.id)
    if (st && (st.phase === 'paused' || st.phase === 'done')) continue
    const plan = plans.get(c.id) ?? st?.plan ?? []
    const past = plan.filter(d => d < 0)
    if (past.length > 0) {
      overdue.push({ key: Math.min(...past), cardId: c.id })
    } else if (plan.includes(0)) {
      due.push(c)
    } else if (plan.length === 0 && (!st || st.phase === 'new')) {
      due.push(c)   // 维持模式下的无计划新卡：首次曝光就是今天
    }
  }
  overdue.sort((a, b) => a.key - b.key || compareCardId(a.cardId, b.cardId))
  return [
    ...overdue.map(o => ({ cardId: o.cardId, reason: 'overdue' as const })),
    ...sortForScheduling(due).map(c => ({ cardId: c.id, reason: 'due' as const })),
  ]
}

/**
 * 主入口（§5.1）。纯函数：无 IO、不读时钟，today 由参数传入。
 */
export function schedule(
  cards: SchedulableCard[],
  cardStates: CardState[],
  readyByDate: LocalDate | null,
  dailyCapacity: number,
  today: LocalDate,
  reservedLoad: ReadonlyMap<number, number> = new Map(),
): ScheduleResult {
  const stateMap = new Map(cardStates.map(s => [s.cardId, s] as const))

  // §5.7：readyByDate 为空或已过期 → 日常维持模式。R<0 必须提示更新（§5.2 ①）
  if (readyByDate === null || diffDays(readyByDate, today) < 0) {
    return {
      mode: 'maintenance',
      needsDateUpdate: readyByDate !== null,
      todayQueue: buildQueue(cards, stateMap, new Map()),
      plans: new Map(),
      overloadWarning: { dropped: [] },
    }
  }

  const R = diffDays(readyByDate, today)
  const E = Math.max(0, R - bufferOf(R))

  // plan-once：只为"没有计划的卡"生成；已有计划的一律不动（I4）
  const fresh = cards.filter(c => {
    const st = stateMap.get(c.id)
    if (st && (st.phase === 'paused' || st.phase === 'done')) return false
    return !st || st.phase === 'new' || st.plan.length === 0
  })

  const plans = new Map<string, number[]>()
  let warning: OverloadWarning = { dropped: [] }

  if (fresh.length > 0) {
    const gen = generateFreshPlans(fresh, stateMap, dailyCapacity, E, reservedLoad)
    if (E === 0) {
      // §5.4：E=0 是唯一允许突破容量的情况——所有卡排今天并告警
      warning = { earliestOverloadDay: 0, dropped: [] }
    } else {
      const violation = prefixCheck(gen.load, dailyCapacity, E)
      if (violation !== undefined || gen.dropped.length > 0) {
        // §5.4：收窄建议必须重跑判据验证——narrowSuggestion 的可行性定义
        // 就是"生成后无 drop 且前缀和通过"，建议即验证
        const narrowTo = narrowSuggestion(
          fresh, stateMap, readyByDate, dailyCapacity, today, reservedLoad,
        )
        warning = {
          earliestOverloadDay: violation,
          dropped: gen.dropped,
          narrowTo,
          suggestedCount: narrowTo.length,
        }
      }
    }
    for (const [id, plan] of gen.plans) plans.set(id, plan)
  }

  return {
    mode: 'sprint',
    needsDateUpdate: false,
    todayQueue: buildQueue(cards, stateMap, plans),
    plans,
    overloadWarning: warning,
  }
}

/**
 * 把存量计划的每日占用汇总成 reservedLoad（§5.1 的调用方职责，这里给出
 * 纯函数实现）。paused 卡的计划保留但不消费，不再占容量；负偏移是逾期，
 * 属于过去，不占未来容量。
 */
export function reservedLoadOf(cardStates: CardState[]): Map<number, number> {
  const load = new Map<number, number>()
  for (const st of cardStates) {
    if (st.phase === 'paused') continue
    for (const day of st.plan) {
      if (day < 0) continue
      load.set(day, (load.get(day) ?? 0) + 1)
    }
  }
  return load
}

/**
 * 收窄建议（§5.4/§5.6）：这不是异常兜底，是核心交互——它回答产品最有
 * 价值的问题："从 1200 道里，我这三周该刷哪些"。
 *
 * 按 (frequency 降序, cardId 升序) 取最大前缀 k，使前 k 张重新生成后
 * 无 drop 且前缀和通过。负载随 k 单调不减，二分查找。
 *
 * 单调性说明：前 k 张的末次分配与错峰排位在增大 k 后不变（贪心从 E 往前、
 * 排位按前缀），新增卡只添负载，贪心右推只会更挤——这是结构性质而非构造性
 * 证明，「收窄建议执行后重跑」测试是它的直接守卫。
 */
export function narrowSuggestion(
  cards: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  readyByDate: LocalDate,
  dailyCapacity: number,
  today: LocalDate,
  reservedLoad: ReadonlyMap<number, number>,
): SchedulableCard[] {
  const ordered = sortForScheduling(cards)
  const R = diffDays(readyByDate, today)
  const E = Math.max(0, R - bufferOf(R))
  if (E < 1) return []

  const feasible = (k: number): boolean => {
    const gen = generateFreshPlans(ordered.slice(0, k), states, dailyCapacity, E, reservedLoad)
    return gen.dropped.length === 0 && prefixCheck(gen.load, dailyCapacity, E) === undefined
  }

  let lo = 0
  let hi = ordered.length
  let best: SchedulableCard[] = []
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (feasible(mid)) {
      best = ordered.slice(0, mid)
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}
