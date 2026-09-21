import { layLadder } from './plan.js'
import { binIntermediates } from './capacity.js'
import type { DayLoad, DroppedReview } from './capacity.js'
import type { CardState, Rational, SchedulableCard } from './types.js'

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

/**
 * 终止状态判定（§5.5）：计划项全部消费完（plan 为空）→ phase = done，退出队列。
 * 两条边界都不能提前置 done：
 * - 含今天（0）的项：今天还要刷（spec 原文「已无 > today 的项」按字面会把 [0]
 *   也判成 done，这是取更严的读法）；
 * - 只含逾期项（负数）：逾期卡必须并入 todayQueue（§5.5），done 会把它挡在
 *   队列外，那次逾期复习就永久丢了。
 */
export function shouldMarkDone(plan: number[]): boolean {
  return plan.length === 0
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
