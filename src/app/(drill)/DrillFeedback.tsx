'use client'

import { useState } from 'react'
import type { CardView } from '../../server/queue.js'
import type { Submission } from '../../server/types.js'
import type { ReviewResult } from '../../server/review.js'
import type { PreparedVariant } from '../../lib/options/prepare.js'
import { splitDetail } from '../../lib/content/split.js'
import { RichText } from '../RichText.js'
import { DemoCodeBlock } from '../DemoCodeBlock.js'

/** judgment 结论三选（与 DrillQuestion 的 CONCLUSION_OPTIONS 同映射：0=会 1=不会 2=取决于） */
const CONCLUSION_LABELS = ['会', '不会', '取决于'] as const
const CONCLUSION_OF = { yes: 0, no: 1, depends: 2 } as const

export type DrillFeedbackProps = {
  card: CardView
  variant: PreparedVariant
  submission: Submission
  result: ReviewResult
  /** true = 断网本地判分：圆点用缓存剩余计划、错勾归属降级、提示「计划将在联网后更新」 */
  offline: boolean
}

/** 逐条染色三态（§6 屏②）+ 中性——纸面批注色 + 文字徽标（不依赖颜色也能区分） */
type OptionState = 'correct' | 'missed' | 'wrong' | 'neutral'

const STATE_CLASS: Record<OptionState, string> = {
  correct: 'border-mark-good bg-mark-good-soft text-mark-good',
  missed: 'border-mark-miss bg-mark-miss-soft text-mark-miss',
  wrong: 'border-mark-bad bg-mark-bad-soft text-mark-bad',
  neutral: 'border-paper-line bg-paper-card text-paper-ink',
}

const STATE_LABEL: Record<OptionState, string> = {
  correct: '✓ 勾对',
  missed: '漏选',
  wrong: '✗ 错勾',
  neutral: '',
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
  const [showDetail, setShowDetail] = useState(false)
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
    <section className="rise pb-2 pt-2">
      <header className="mb-6">
        <div className="eyebrow">{card.blockName}</div>
        <h1 className="mt-3 font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-paper-ink text-balance md:text-3xl">
          {card.question}
        </h1>
        {card.detail !== '' && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDetail(v => !v)}
              aria-expanded={showDetail}
              className="text-sm text-accent underline underline-offset-4 transition-opacity hover:opacity-80"
            >
              {showDetail ? '收起讲解' : '看不懂术语？看讲解'}
            </button>
            {showDetail && (
              <div className="mt-3 rounded-r-md border border-l-2 border-l-accent border-paper-line bg-paper-wash px-4 py-3 text-[15px] leading-relaxed text-paper-ink">
                <div className="space-y-2"><RichText text={splitDetail(card.detail).intro} /></div>
                {splitDetail(card.detail).advanced !== '' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-paper-muted">进阶（面试深度）</summary>
                    <div className="mt-2 space-y-2"><RichText text={splitDetail(card.detail).advanced} /></div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
        <div className="tnum mt-4 font-serif text-4xl font-semibold tracking-tight text-paper-ink">
          得分 {result.score.num}/{result.score.den}
        </div>
        <div className="tnum mt-1.5 text-sm text-paper-muted">
          {card.cardType === 'sequence' ? (
            <>
              <span>位置正确 {result.feedback.correctChecked} 项</span>
              <span aria-hidden="true"> · </span>
              <span>错位 {result.feedback.wrongChecked} 项</span>
            </>
          ) : (
            <>
              <span>漏选 {result.feedback.missed} 条</span>
              <span aria-hidden="true"> · </span>
              <span>错勾 {result.feedback.wrongChecked} 条</span>
            </>
          )}
        </div>
        {card.demoCode !== undefined && (
          <div className="mt-6">
            <DemoCodeBlock code={card.demoCode} sourceUrl={card.demoSourceUrl} />
          </div>
        )}
      </header>

      {card.cardType === 'judgment' && card.conclusion !== undefined && submission.kind === 'judgment' && (
        <fieldset className="mb-6">
          <legend className="mb-2 text-xs tracking-[0.2em] text-paper-muted">你的结论（批改）</legend>
          <div className="flex gap-2">
            {CONCLUSION_LABELS.map((label, value) => {
              const isRight = CONCLUSION_OF[card.conclusion!] === value
              const isMine = submission.conclusion === value
              const tone = isRight
                ? 'border-mark-good bg-mark-good-soft text-mark-good'
                : isMine
                  ? 'border-mark-bad bg-mark-bad-soft text-mark-bad'
                  : 'border-paper-line bg-paper-card text-paper-muted'
              return (
                <div
                  key={value}
                  data-testid="conclusion-row"
                  data-correct={isRight || undefined}
                  data-mine={isMine || undefined}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm ${tone}`}
                >
                  <span className={isMine ? 'font-semibold' : ''}>
                    {isMine ? '◉' : '○'} {label}
                  </span>
                  {isRight && <span className="text-xs font-medium">✓ 正确答案</span>}
                  {isMine && !isRight && <span className="text-xs font-medium">✗ 你的选择</span>}
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      {card.cardType === 'sequence' && submission.kind === 'sequence' ? (
        <div>
          <p className="mb-3 text-xs tracking-[0.2em] text-paper-muted">你的排序（批改）</p>
          <ul className="space-y-2">
            {submission.order.map((presentedIdx, pos) => {
              const rightAt = variant.correctIndices.indexOf(presentedIdx)!
              const inPlace = rightAt === pos
              return (
                <li
                  key={presentedIdx}
                  data-testid="seq-row"
                  data-in-place={inPlace || undefined}
                  className={`flex items-baseline gap-3 rounded-md border px-4 py-3 text-[15px] leading-relaxed ${
                    inPlace
                      ? 'border-mark-good bg-mark-good-soft text-mark-good'
                      : 'border-mark-miss bg-mark-miss-soft text-mark-miss'
                  }`}
                >
                  <span className="tnum w-5 shrink-0 text-right font-mono text-sm opacity-70">{pos + 1}</span>
                  <span className="flex-1">{variant.optionTexts[presentedIdx]}</span>
                  <span className="shrink-0 text-xs font-medium tracking-wide opacity-80">
                    {inPlace ? '✓ 位置正确' : `应在第 ${rightAt + 1} 位`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-paper-muted">
            {card.cardType === 'atomic' ? '你的选择（批改）' : '勾出所有属于这道题的要点（批改）'}
          </p>

          <ul className="space-y-2">
            {variant.optionTexts.map((text, i) => {
              const state = stateOf(i)
              const wasChecked = checked.has(i)
              return (
                <li
                  key={i}
                  data-testid="option"
                  data-state={state}
                  className={`flex items-baseline gap-3 rounded-md border px-4 py-3 text-[15px] leading-relaxed ${STATE_CLASS[state]}`}
                >
                  <span
                    aria-label={wasChecked ? '作答时已勾选' : '作答时未勾选'}
                    className="shrink-0 select-none"
                  >
                    {wasChecked ? '☑' : '☐'}
                  </span>
                  <span className="flex-1">{text}</span>
                  {state !== 'neutral' && (
                    <span className="shrink-0 text-xs font-medium tracking-wide opacity-80">
                      {STATE_LABEL[state]}
                      {state === 'wrong' && ` · ${WRONG_ATTRIBUTION}`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-2">
          {plan.map((date, i) => {
            const isFinal = i === lastIdx
            return (
              <span
                key={`${date}-${i}`}
                data-testid="plan-dot"
                title={date}
                className={`inline-block h-3 w-3 rounded-full transition-colors ${isFinal ? 'bg-accent' : 'bg-paper-muted/40'}`}
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
          <p className="mt-2 text-sm text-mark-miss">计划已重排</p>
        )}
        {offline && (
          <p className="mt-2 text-sm text-paper-muted">计划将在联网后更新</p>
        )}
      </div>
    </section>
  )
}
