import { layLadder, bufferOf } from './plan.js'
import { binIntermediates, prefixCheck } from './capacity.js'
import type { DayLoad, DroppedReview } from './capacity.js'
import { addDays, diffDays } from './date.js'
import type { LocalDate } from './date.js'
import { cmpRat, compareCardId, FREQ_ORDER, rat } from './types.js'
import type { CardState, Rational, SchedulableCard } from './types.js'
import { generateFreshPlans } from './schedule.js'

/**
 * 答错判定（§5.5 第 1 条）：得分比例 < 1/2 → 起始档退回 0 重新生成。
 * 分数比较：2·num < den，禁止浮点。
 */
export function failed(score: Rational): boolean {
  return 2 * score.num < score.den
}

export type RegenContext = {
  /** 末次复习目标日（相对 today 的偏移） */
  E: number
  /**
   * 现有占用图：其他卡的计划 + reservedLoad，**不含本卡旧计划**
   * （调用方先把本卡旧计划从占用图里减掉）。函数会原地累加新占位。
   */
  load: DayLoad
  capacity: number
}

/**
 * 答错重排（§5.5）：只重排这一张卡，起始档退回 0，**从明天起**。
 *
 * 为什么不是"当天稍后"：它与"每次提交重跑 schedule()"叠加会构成同日
 * 死循环——R≤1 时全部卡排今天，刷完重跑还是今天，无限循环，且发生在
 * 面试前一天这个产品最重要的日子。
 *
 * E=0 时窗口里没有明天：返回空计划（本周期收口），绝不当天回队。
 */
export function regenerateAfterFailure(
  card: SchedulableCard,
  state: CardState,
  ctx: RegenContext,
): { plan: number[]; dropped: DroppedReview[] } {
  if (ctx.E <= 0) return { plan: [], dropped: [] }
  const ladder = layLadder(1, 0, ctx.E)
  const intermediates = ladder.slice(0, -1)
  const target = ladder[ladder.length - 1]!
  return binIntermediates(intermediates, target, card.id, ctx.load, ctx.capacity)
}

/** 维持模式间隔表（§5.7）。到表尾后停在 120 天不再增长 */
export const MAINTAIN_INTERVALS = [1, 3, 7, 15, 30, 60, 120] as const

/**
 * 维持模式档位进退（§5.7）：得分比例 ≥ 1/2 → 进档；< 1/2 → 退回 0。
 * 返回新档位与下次复习距今天的天数。
 */
export function maintenanceStep(k: number, ratio: Rational): { k: number; nextInDays: number } {
  const passed = 2 * ratio.num >= ratio.den
  const nextK = passed ? Math.min(k + 1, MAINTAIN_INTERVALS.length - 1) : 0
  return { k: nextK, nextInDays: MAINTAIN_INTERVALS[nextK]! }
}

/**
 * 减块（§5.5）：被取消块的卡置 phase = paused，plan[] 保留但不进
 * todayQueue。重新勾选时按剩余窗口续上，不从头再来——续上是调用方的
 * 职责（把保留的 plan 换算到新 today），这里只提供纯状态变换。
 */
export function pauseCards(states: CardState[], cardIds: readonly string[]): CardState[] {
  const ids = new Set(cardIds)
  return states.map(st => (ids.has(st.cardId) ? { ...st, phase: 'paused' as const } : st))
}

/**
 * 面试临时加密（§5.8）：用户真约到一场面试时（提前 2-5 天），
 * 对选中块里 s 最低的卡，在剩余窗口内按 §5.2 重新铺一遍。
 *
 * - readyByDate = 面试前一天（此时用户确实知道日期）
 * - 排序 (s 升序, frequency 降序, cardId 升序)：最薄弱的先救
 * - 二分取最大可行前缀（可行 = 无 drop 且前缀和通过，含 reservedLoad，
 *   直接满足 §11 "重排后每天总负载仍 ≤ 容量"）
 * - reservedLoad 含**其他块**的占用，但**不含本选中块的旧计划**——调用方先把
 *   它扣掉（与 regenerateAfterFailure 的 RegenContext 同一契约），否则本块
 *   容量被双计，正好踩中 §5.1 点名的静默超载
 * - excluded 的计划不出现在返回里——其余块逐字节不变是构造性保证
 * - E < 1（面试就在明后天）：没有可排的窗口，全部排除、原计划不动
 */
export function cramForInterview(
  selected: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  examDate: LocalDate,
  today: LocalDate,
  capacity: number,
  reservedLoad: ReadonlyMap<number, number>,
): { plans: ReadonlyMap<string, number[]>; excluded: SchedulableCard[] } {
  const readyBy = addDays(examDate, -1)
  const R = diffDays(readyBy, today)
  const E = Math.max(0, R - bufferOf(R))
  if (E < 1) return { plans: new Map(), excluded: [...selected] }

  const ordered = [...selected].sort((a, b) => {
    const sa = states.get(a.id)?.s ?? rat(0, 1)
    const sb = states.get(b.id)?.s ?? rat(0, 1)
    return (
      cmpRat(sa, sb) ||
      FREQ_ORDER[b.frequency] - FREQ_ORDER[a.frequency] ||
      compareCardId(a.id, b.id)
    )
  })

  const feasible = (k: number): boolean => {
    const gen = generateFreshPlans(ordered.slice(0, k), states, capacity, E, reservedLoad)
    return gen.dropped.length === 0 && prefixCheck(gen.load, capacity, E) === undefined
  }
  let lo = 0
  let hi = ordered.length
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (feasible(mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  // 注意用新的 load 副本生成最终结果（feasible 探针改过 load）
  const gen = generateFreshPlans(ordered.slice(0, best), states, capacity, E, new Map(reservedLoad))
  return { plans: gen.plans, excluded: ordered.slice(best) }
}
