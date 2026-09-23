import { scoreSelection, scoreSequence, scoreJudgment, scoreAtomic } from '../lib/mastery/score.js'
import type { Rational } from '../lib/scheduler/types.js'
import type { PreparedVariant } from '../lib/options/prepare.js'
import type { Submission } from '../server/types.js'   // 仅类型，无运行时依赖

/**
 * 客户端离线判分结果（§6 屏② 即时反馈）。
 * score/correctChecked/wrongChecked 与服务端 replay.scoreSubmission 同口径（§11 同构守卫）；
 * missed 是客户端额外投影——屏② 要显示"漏了几条"，= 正确要点总数 − 勾中正确数。
 */
export type LocalScore = { score: Rational; correctChecked: number; wrongChecked: number; missed: number }

/**
 * 客户端判分核（§4.3/§8.3）：断网时用下发的 prepared.correctIndices 本地判分渲染屏②。
 * 四型分派逻辑必须与 server/replay.scoreSubmission 逐字节一致——只 import lib/mastery
 * 运行时 + lib/server 类型，绝不 import drizzle/pg 或任何 server 运行时。
 *
 * missed = variant.correctIndices.length − correctChecked：
 *   selection/atomic 型直接反映漏勾数；judgment 结论错时 correctChecked 已归零，
 *   故 missed 自然等于全部正确项（计划语义："结论错 → missed 记全部正确项"）。
 */
export function scoreLocal(
  card: { cardType: 'enumeration' | 'comparison' | 'sequence' | 'judgment' | 'atomic'; conclusion?: 'yes' | 'no' | 'depends' },
  variant: PreparedVariant,
  submission: Submission,
): LocalScore {
  const total = variant.correctIndices.length
  const withMissed = (s: { score: Rational; correctChecked: number; wrongChecked: number }): LocalScore =>
    ({ ...s, missed: total - s.correctChecked })

  if (submission.kind === 'selection') {
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    return withMissed({
      score: scoreSelection(correct, wrong, variant.correctIndices.length),
      correctChecked: correct, wrongChecked: wrong,
    })
  }
  if (submission.kind === 'sequence') {
    const presented = variant.optionTexts
    const userOrder = submission.order.map(i => presented[i]!)
    const canonical = variant.correctIndices.map(i => presented[i]!)
    const score = scoreSequence(userOrder, canonical)
    const n = variant.correctIndices.length
    const correct = Math.round((score.num * n) / score.den)
    return withMissed({ score, correctChecked: correct, wrongChecked: n - correct })
  }
  if (submission.kind === 'judgment') {
    const want = { yes: 0, no: 1, depends: 2 }[card.conclusion!]!
    const conclusionCorrect = submission.conclusion === want
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    const points = scoreSelection(correct, wrong, variant.correctIndices.length)
    return withMissed({
      score: scoreJudgment(conclusionCorrect, points),
      correctChecked: conclusionCorrect ? correct : 0,
      wrongChecked: conclusionCorrect ? wrong : variant.correctIndices.length,
    })
  }
  const hit = variant.correctIndices.includes(submission.selected)
  return withMissed({ score: scoreAtomic(hit), correctChecked: hit ? 1 : 0, wrongChecked: hit ? 0 : 1 })
}
