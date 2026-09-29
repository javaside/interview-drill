'use client'

import { useState } from 'react'
import type { CardView } from '../../server/queue.js'
import type { ConclusionChoice } from '../../server/types.js'
import type { PreparedVariant } from '../../lib/options/prepare.js'
import { splitDetail } from '../../lib/content/split.js'
import { RichText } from '../RichText.js'

/** Submission 去掉 submissionId/cardId/reviewedAtMs 的作答负载（屏① 只产出作答意图） */
export type SubmissionPayload =
  | { kind: 'selection'; selected: number[] }
  | { kind: 'sequence'; order: number[] }
  | { kind: 'judgment'; conclusion: ConclusionChoice; selected: number[] }
  | { kind: 'atomic'; selected: number }

export type DrillQuestionProps = {
  card: CardView
  variant: PreparedVariant
  onSubmit: (payload: SubmissionPayload) => void
}

const FREQUENCY_LABEL: Record<CardView['frequency'], string> = {
  high: '高频', mid: '中频', low: '低频',
}

/** judgment 顶部三选：radio 下标 → conclusion 0/1/2（0=会 1=不会 2=取决于），与 ConclusionChoice 对齐 */
const CONCLUSION_OPTIONS: ReadonlyArray<{ value: ConclusionChoice; label: string }> = [
  { value: 0, label: '会' },
  { value: 1, label: '不会' },
  { value: 2, label: '取决于' },
]

const HINT = '勾出所有属于这道题的要点'

/**
 * 屏① 题目+选项。按 cardType 四型分派：
 * - enumeration/comparison：多选 checkbox → {kind:'selection', selected}
 * - judgment：顶部三选 radio（结论）+ 多选 checkbox → {kind:'judgment', conclusion, selected}
 * - atomic：单选 radio → {kind:'atomic', selected}
 * - sequence：可上下移的列表 → {kind:'sequence', order}
 *
 * 约束：提示语固定文案，不渲染答案条数；空勾选/无结论时禁用提交（前端拦截空提交）。
 * 选项数由 variant.optionTexts.length 决定（enum 型恒 9，atomic 恒 4）。
 */
export function DrillQuestion({ card, variant, onSubmit }: DrillQuestionProps) {
  const n = variant.optionTexts.length
  const [checked, setChecked] = useState<boolean[]>(() => Array(n).fill(false))
  const [conclusion, setConclusion] = useState<ConclusionChoice | null>(null)
  const [atomicSel, setAtomicSel] = useState<number | null>(null)
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: n }, (_, i) => i))
  const [showDetail, setShowDetail] = useState(false)

  const cardType = card.cardType
  const selected = checked.flatMap((c, i) => (c ? [i] : []))

  const toggle = (i: number) =>
    setChecked(prev => prev.map((c, j) => (j === i ? !c : c)))

  const move = (from: number, to: number) =>
    setOrder(prev => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const tmp = next[from]!
      next[from] = next[to]!
      next[to] = tmp
      return next
    })

  const disabled =
    cardType === 'atomic'
      ? atomicSel === null
      : cardType === 'judgment'
        ? conclusion === null
        : cardType === 'sequence'
          ? false
          : selected.length === 0

  const submit = () => {
    if (cardType === 'atomic') {
      if (atomicSel === null) return
      onSubmit({ kind: 'atomic', selected: atomicSel })
    } else if (cardType === 'judgment') {
      if (conclusion === null) return
      onSubmit({ kind: 'judgment', conclusion, selected })
    } else if (cardType === 'sequence') {
      onSubmit({ kind: 'sequence', order })
    } else {
      if (selected.length === 0) return
      onSubmit({ kind: 'selection', selected })
    }
  }

  return (
    <section className="rise relative mx-auto max-w-2xl px-5 py-8">
      {/* 背景淡墨大字：章节氛围（纯装饰） */}
      <span aria-hidden="true" className="ghost-display absolute -top-4 right-2 text-[9rem]">
        问
      </span>
      <header className="relative mb-6">
        <div className="eyebrow flex items-center gap-2">
          <span>{card.blockName}</span>
          <span aria-hidden="true">·</span>
          <span>{FREQUENCY_LABEL[card.frequency]}</span>
        </div>
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
              {showDetail ? '收起讲解' : '不会？先看讲解'}
            </button>
            {showDetail && (
              <div className="mt-3 rounded-r-md border border-l-2 border-l-accent border-paper-line bg-paper-wash px-4 py-3 text-[15px] leading-relaxed text-paper-ink">
                <p className="whitespace-pre-line"><RichText text={splitDetail(card.detail).intro} /></p>
                {splitDetail(card.detail).advanced !== '' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-paper-muted">进阶（面试深度）</summary>
                    <p className="mt-2 whitespace-pre-line"><RichText text={splitDetail(card.detail).advanced} /></p>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {cardType === 'judgment' && (
        <fieldset className="mb-6">
          <legend className="mb-2 text-xs tracking-[0.2em] text-paper-muted">你的结论</legend>
          <div className="flex gap-2">
            {CONCLUSION_OPTIONS.map(o => (
              <label
                key={o.value}
                className="choice flex-1 justify-center px-3 py-2.5 text-sm has-[:checked]:font-medium"
              >
                <input
                  type="radio"
                  name="conclusion"
                  checked={conclusion === o.value}
                  onChange={() => setConclusion(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mb-3 text-sm text-paper-muted">{HINT}</p>

      {cardType === 'sequence' ? (
        <ol className="space-y-2">
          {order.map((optIdx, pos) => (
            <li
              key={optIdx}
              className="choice py-3"
            >
              <span className="tnum w-5 shrink-0 text-right text-sm text-paper-muted">{pos + 1}</span>
              <span className="flex-1 text-[15px] leading-relaxed">{variant.optionTexts[optIdx]}</span>
              <button
                type="button"
                aria-label="上移"
                disabled={pos === 0}
                onClick={() => move(pos, pos - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-paper-line text-paper-muted transition-all duration-200 hover:border-paper-ink hover:bg-paper-ink hover:text-paper disabled:pointer-events-none disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="下移"
                disabled={pos === order.length - 1}
                onClick={() => move(pos, pos + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-paper-line text-paper-muted transition-all duration-200 hover:border-paper-ink hover:bg-paper-ink hover:text-paper disabled:pointer-events-none disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      ) : cardType === 'atomic' ? (
        <ul className="space-y-2">
          {variant.optionTexts.map((text, i) => (
            <li key={i}>
              <label className="choice">
                <input
                  type="radio"
                  name="atomic"
                  checked={atomicSel === i}
                  onChange={() => setAtomicSel(i)}
                />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {variant.optionTexts.map((text, i) => (
            <li key={i}>
              <label className="choice">
                <input type="checkbox" checked={checked[i] ?? false} onChange={() => toggle(i)} />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="btn-primary mt-8 w-full text-base sm:w-auto"
      >
        提交
      </button>
    </section>
  )
}
