import { prepareOptions } from '../lib/options/prepare.js'
import type { PreparedVariant } from '../lib/options/prepare.js'
import type { DistractorPools } from '../lib/options/types.js'
import { scoreSelection, scoreSequence, scoreJudgment, scoreAtomic } from '../lib/mastery/score.js'
import { failed, regenerateAfterFailure, maintenanceStep, shouldMarkDone } from '../lib/scheduler/regenerate.js'
import { weightedS } from '../lib/scheduler/types.js'
import type { Rational, CardState } from '../lib/scheduler/types.js'
import type { CardSnapshot, Settings, Submission } from './types.js'

/**
 * 确定性重算（§4.3）：服务端按 (userId, cardId, reviewIndex) 重建当时下发的变体。
 *
 * sAtServe 语义（复现契约）：prepareOptions 用**单一 s** 生成全部 K 份变体，
 * 即客户端拿到的整套变体基于**取队列时**的 s。因此重算必须用批首快照的 s，
 * 绝不能用回放中已演化的 state.s——s 跨 layerCounts 档位会改变分层配额，
 * 抽中不同干扰项，变体就对不上了。
 */
export function variantAt(
  card: CardSnapshot, pools: DistractorPools, sAtServe: Rational,
  userId: string, reviewIndex: number,
): PreparedVariant {
  return prepareOptions(card as never, pools, sAtServe, userId, reviewIndex, 1).variants[0]!
}

export type Scored = { score: Rational; correctChecked: number; wrongChecked: number }

/**
 * 四型判分（§4.4，按 cardType 分派 mastery）。correctChecked/wrongChecked 以
 * "能配 keyPointsTotal 解释历史"为准记录：selection/judgment 记勾选数，
 * sequence/atomic 记换算值（score × n 四舍五入 / 1|0）。
 */
export function scoreSubmission(
  card: CardSnapshot, variant: PreparedVariant, submission: Submission,
): Scored {
  if (submission.kind === 'selection') {
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    return {
      score: scoreSelection(correct, wrong, variant.correctIndices.length),
      correctChecked: correct, wrongChecked: wrong,
    }
  }
  if (submission.kind === 'sequence') {
    const presented = variant.optionTexts
    const userOrder = submission.order.map(i => presented[i]!)
    const canonical = variant.correctIndices.map(i => presented[i]!)   // 计划 3 修复后的语义
    const score = scoreSequence(userOrder, canonical)
    const n = variant.correctIndices.length
    const correct = Math.round((score.num * n) / score.den)
    return { score, correctChecked: correct, wrongChecked: n - correct }
  }
  if (submission.kind === 'judgment') {
    const want = { yes: 0, no: 1, depends: 2 }[card.conclusion!]!
    const conclusionCorrect = submission.conclusion === want
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    const points = scoreSelection(correct, wrong, variant.correctIndices.length)
    return {
      score: scoreJudgment(conclusionCorrect, points),
      correctChecked: conclusionCorrect ? correct : 0,
      wrongChecked: conclusionCorrect ? wrong : variant.correctIndices.length,
    }
  }
  const hit = variant.correctIndices.includes(submission.selected)
  return { score: scoreAtomic(hit), correctChecked: hit ? 1 : 0, wrongChecked: hit ? 0 : 1 }
}

export type TransitionCtx = {
  /** 相对今天的天偏移域（DB 绝对日期的转换在 adapters） */
  today: number
  mode: 'sprint' | 'maintenance'
  /** 偏移域末次目标日：调用方换算 E = max(0, diffDays(readyByDate, todayAbs) - bufferOf(R)) */
  E: number
  settings: Settings
  /** 其他卡的占用图（不含本卡）——regenerateAfterFailure 的 RegenContext 契约 */
  loadOf: (cardId: string) => Map<number, number>
  /** 本卡快照（答错重排只需要 SchedulableCard 形状） */
  card: { id: string; frequency: 'high' | 'mid' | 'low' }
}

export type ReviewOutcome = {
  newS: Rational
  nextReviewOffset: number | null
  remainingReviews: number
  /** sprint 答错触发了 regenerateAfterFailure（§6 UI 必须明说"计划已重排"） */
  replanned: boolean
  /** 维持模式例行推进（与 replanned 互斥——UI 文案不同） */
  maintenanceAdvanced: boolean
}

/**
 * 状态迁移（§8.1 刷一张卡）：消费计划当前项 → s 加权 →
 * sprint 答错走 regenerateAfterFailure（从明天起）；
 * maintenance 走 maintenanceStep；plan 空 → done。
 * 纯偏移域运算，recent 由调用方从 review_log 带入（最近 2 次得分，新→旧）。
 */
export function transitionCard(
  state: CardState,
  score: Rational,
  ctx: TransitionCtx,
  recent: Rational[] = [],
): { state: CardState; outcome: ReviewOutcome } {
  // 1. 消费 ≤ today 的最早一项；无（意外提交）也消费最早项，防御
  const consumeIdx = state.plan.length > 0
    ? Math.max(0, state.plan.findIndex(d => d <= ctx.today))
    : -1
  const plan = consumeIdx >= 0
    ? state.plan.filter((_, i) => i !== consumeIdx)
    : state.plan   // 空计划提交：维持现状不崩（调用方不该传，纯核防御）

  // 2. s ← 最近 3 次 3:2:1 加权（新 → 旧）
  const newS = weightedS([score, ...recent.slice(0, 2)])

  // 3. 重排 / 维持
  let nextPlan = plan
  let replanned = false
  let maintenanceAdvanced = false
  let phase = state.phase
  let phaseIndex = state.phaseIndex
  if (ctx.mode === 'sprint' && failed(score)) {
    const r = regenerateAfterFailure(ctx.card, { ...state, s: newS, plan }, {
      E: ctx.E, load: ctx.loadOf(state.cardId), capacity: ctx.settings.dailyCapacity,
    })
    nextPlan = r.plan
    replanned = true
  } else if (ctx.mode === 'maintenance') {
    const step = maintenanceStep(phaseIndex, score)
    phaseIndex = step.k
    nextPlan = [ctx.today + step.nextInDays]
    maintenanceAdvanced = true
  }

  // 4. 终止
  if (shouldMarkDone(nextPlan)) phase = 'done'

  const nextState: CardState = {
    ...state, s: newS, plan: nextPlan, phase, phaseIndex, reviewCount: state.reviewCount + 1,
  }
  return {
    state: nextState,
    outcome: {
      newS, nextReviewOffset: nextPlan[0] ?? null, remainingReviews: nextPlan.length,
      replanned, maintenanceAdvanced,
    },
  }
}
