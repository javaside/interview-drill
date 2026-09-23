'use client'

import type { CardView } from '../../server/queue.js'
import type { Submission } from '../../server/types.js'
import type { ReviewResult } from '../../server/review.js'
import type { PreparedVariant } from '../../lib/options/prepare.js'

export type DrillFeedbackProps = {
  card: CardView
  variant: PreparedVariant
  submission: Submission
  result: ReviewResult
  /** true = 断网本地判分：圆点用缓存剩余计划、错勾归属降级、提示「计划将在联网后更新」 */
  offline: boolean
}

/** 逐条染色三态（§6 屏②）+ 中性 */
type OptionState = 'correct' | 'missed' | 'wrong' | 'neutral'

const STATE_CLASS: Record<OptionState, string> = {
  correct: 'border-green-500 bg-green-50 text-green-800',
  missed: 'border-yellow-500 bg-yellow-50 text-yellow-800',
  wrong: 'border-red-500 bg-red-50 text-red-800',
  neutral: 'border-gray-200 text-gray-700',
}

/** 从提交里取出「被勾集合」——只有 selection/judgment/atomic 有勾选语义 */
function checkedSetOf(submission: Submission): Set<number> {
  if (submission.kind === 'selection' || submission.kind === 'judgment') {
    return new Set(submission.selected)
  }
  if (submission.kind === 'atomic') {
    return new Set([submission.selected])
  }
  return new Set()   // sequence 无勾选染色语义
}

/** 错勾归属提示：完整归属映射（distractorKeyPointIds → 归属块/题）为 4b 内衔接项，此处占位 */
const WRONG_ATTRIBUTION = '属于本大类的另一道题'

/**
 * 屏② 判分反馈（§6）。渲染得分、漏/错勾计数、逐条染色（勾对绿/漏选黄/错勾红）、
 * 错勾归属提示、圆点序列（result.remainingPlan 绝对日期 + 末尾面试日红点）。
 *
 * 离线纪律（§8.3）：客户端只消费计划、永不生成——offline 时不重排，仅提示
 * 「计划将在联网后更新」，圆点用本地缓存的剩余计划。答错触发重排（replanned=true）
 * 时必须显式明说「计划已重排」，不得默默换一排圆点。
 */
export function DrillFeedback({ card, variant, submission, result, offline }: DrillFeedbackProps) {
  const correct = new Set(variant.correctIndices)
  const checked = checkedSetOf(submission)
  const plan = result.remainingPlan
  const lastIdx = plan.length - 1

  const stateOf = (i: number): OptionState => {
    const isCorrect = correct.has(i)
    const isChecked = checked.has(i)
    if (isCorrect && isChecked) return 'correct'
    if (isCorrect && !isChecked) return 'missed'
    if (!isCorrect && isChecked) return 'wrong'
    return 'neutral'
  }

  return (
    <section className="mx-auto max-w-2xl p-4">
      <header className="mb-4">
        <div className="text-sm text-gray-500">{card.blockName}</div>
        <div className="mt-1 text-2xl font-semibold">
          得分 {result.score.num}/{result.score.den}
        </div>
        <div className="mt-1 text-sm text-gray-600">
          <span>漏选 {result.feedback.missed} 条</span>
          <span aria-hidden="true"> · </span>
          <span>错勾 {result.feedback.wrongChecked} 条</span>
        </div>
      </header>

      <ul className="space-y-2">
        {variant.optionTexts.map((text, i) => {
          const state = stateOf(i)
          return (
            <li
              key={i}
              data-testid="option"
              data-state={state}
              className={`rounded border p-2 ${STATE_CLASS[state]}`}
            >
              <span>{text}</span>
              {state === 'wrong' && (
                <span className="ml-2 text-xs text-gray-500">{WRONG_ATTRIBUTION}</span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          {plan.map((date, i) => {
            const isFinal = i === lastIdx
            return (
              <span
                key={`${date}-${i}`}
                data-testid="plan-dot"
                title={date}
                className={`inline-block h-3 w-3 rounded-full ${isFinal ? 'bg-red-500' : 'bg-blue-400'}`}
              >
                {isFinal && (
                  <span data-testid="plan-dot-final" className="sr-only">
                    面试日
                  </span>
                )}
              </span>
            )
          })}
        </div>
        {result.replanned && (
          <p className="mt-2 text-sm text-orange-600">计划已重排</p>
        )}
        {offline && (
          <p className="mt-2 text-sm text-gray-500">计划将在联网后更新</p>
        )}
      </div>
    </section>
  )
}
