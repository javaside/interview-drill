'use client'

import { useEffect, useRef, useState } from 'react'
import { browserApi } from '../client/api.js'
import type { Api } from '../client/api.js'
import type { QaMessage } from '../lib/ai/qa.js'
import { RichText } from './RichText.js'

/**
 * 管理员审题问答框（learn 页每题一个，仅管理员视角渲染——page 判定后传入）：
 * 与 CardQA 同一套流式交互（正文增量 + 思考过程折叠），但打 /api/admin/qa
 * （上下文全量含答案），讨论完多一个「确认有问题 → 提交报告」的收口动作：
 * 结论 + 整段对话 POST /api/admin/reports 落库，线下 report:pull 导出、修完销单。
 *
 * 提交的报告只带 role/content（reasoning 是思考噪声不入库）。api 可注入便于单测。
 */

type Turn = QaMessage & { reasoning?: string }

export function AdminCardQA(
  { cardId, openReports = 0, api }: {
    cardId: string
    /** 该卡已有的未处理报告数（page 装配；防重复提交的提示） */
    openReports?: number
    /** 注入测试；缺省 browserApi() */
    api?: Pick<Api, 'postAdminQaStream' | 'postCardReport'>,
  },
): React.JSX.Element {
  const a = api ?? browserApi()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [reportError, setReportError] = useState('')
  const [openCount, setOpenCount] = useState(openReports)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  /** 增量追加到末条 assistant 轮次（没有就起一条）；field 决定写正文还是思考 */
  function append(field: 'content' | 'reasoning', text: string): void {
    setTurns(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        const merged: Turn = { ...last, [field]: (last[field] ?? '') + text }
        return [...prev.slice(0, -1), merged]
      }
      return [...prev, { role: 'assistant', content: '', [field]: text }]
    })
  }

  async function ask(): Promise<void> {
    const question = input.trim()
    if (question === '' || busy) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('现在没有网络——恢复联网后再问')
      return
    }
    setError('')
    setBusy(true)
    // 发给服务端的 history 只带 role/content；展示列表保留每轮的思考。
    const before = turns
    const next: Turn[] = [...turns, { role: 'user', content: question }]
    const history: QaMessage[] = next.map(({ role, content }) => ({ role, content }))
    setTurns(next)
    setInput('')

    let gotContent = false
    let gotReasoning = false
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await a.postAdminQaStream(cardId, history, {
        onDelta: text => {
          gotContent = true
          if (aliveRef.current) append('content', text)
        },
        onReasoning: text => {
          gotReasoning = true
          if (aliveRef.current) append('reasoning', text)
        },
      }, controller.signal)
    } catch (e) {
      if (!aliveRef.current) return
      setError(e instanceof Error ? e.message : '提问失败，请重试')
      // 一个字都没拿到：把这轮提问撤回输入框；已吐内容的留在屏上不消失（同 CardQA）
      if (!gotContent && !gotReasoning) {
        setTurns(before)
        setInput(question)
      }
    } finally {
      if (aliveRef.current) {
        setBusy(false)
        inputRef.current?.focus()
      }
    }
  }

  /** 收口：确认有问题 → 结论 + 对话（剥 reasoning）落库 */
  async function submitReport(): Promise<void> {
    const text = conclusion.trim()
    if (text === '' || submitting) return
    setSubmitting(true)
    setReportError('')
    try {
      const { id } = await a.postCardReport(
        cardId, text, turns.map(({ role, content }) => ({ role, content })))
      if (!aliveRef.current) return
      setSubmittedId(id)
      setConclusion('')
      setOpenCount(n => n + 1)
    } catch (e) {
      if (aliveRef.current) setReportError(e instanceof Error ? e.message : '提交失败，请重试')
    } finally {
      if (aliveRef.current) setSubmitting(false)
    }
  }

  function close(): void {
    setOpen(false)
    abortRef.current?.abort()
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="btn-ghost mt-2 py-1.5 text-[13px]"
        data-testid={`admin-qa-trigger-${cardId}`}
      >
        审题（管理员）{openCount > 0 && <span className="tnum ml-1.5 rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">{openCount} 条未处理</span>}
      </button>
    )
  }

  const last = turns[turns.length - 1]
  const streaming = busy && last?.role === 'assistant'
  const thinkingLive = streaming && last.reasoning !== undefined && last.content === ''
  const spinnerOnly = busy && !thinkingLive && !(streaming && last.content !== '')
  // 至少一轮完整问答才可提交——报告的价值在「讨论过的结论」，不在随手记
  const canReport = !busy && !submitting && turns.length >= 2 && turns.some(t => t.role === 'assistant' && t.content !== '')

  return (
    <div className="mt-3 rounded-md border border-accent/40 bg-paper-wash px-4 py-3" data-testid={`admin-qa-${cardId}`}>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">审题 · 和 AI 一起挑这道题的毛病</p>
        <button
          type="button"
          onClick={close}
          className="text-[12px] text-paper-muted transition-colors hover:text-paper-ink"
          aria-label="收起审题"
        >
          收起
        </button>
      </div>
      {openCount > 0 && (
        <p className="mt-2 text-[12px] text-paper-muted">
          这道题已有 <span className="tnum font-semibold text-accent">{openCount}</span> 条未处理报告——先看看是否同一个问题，别重复报。
        </p>
      )}

      {turns.length > 0 && (
        <div className="mt-3 space-y-3">
          {turns.map((m, i) => {
            if (m.role === 'user') {
              return (
                <p key={i} className="rounded-lg bg-white/[0.05] px-3 py-2 text-[14px] leading-relaxed text-paper-ink">
                  {m.content}
                </p>
              )
            }
            const isLast = i === turns.length - 1
            const live = isLast && thinkingLive
            return (
              <div key={i} className="space-y-2 text-[14px] leading-relaxed text-paper-ink">
                {m.reasoning !== undefined && m.reasoning !== '' && (
                  live ? (
                    <div className="rounded-lg border border-paper-line/60 bg-black/10 px-3 py-2">
                      <p className="text-[12px] text-paper-muted">思考中…</p>
                      <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-paper-muted">
                        {m.reasoning}
                      </p>
                    </div>
                  ) : (
                    <details className="rounded-lg border border-paper-line/60 px-3 py-1.5">
                      <summary className="cursor-pointer text-[12px] text-paper-muted">思考过程</summary>
                      <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-paper-muted">
                        {m.reasoning}
                      </p>
                    </details>
                  )
                )}
                {m.content !== '' && <RichText text={m.content} />}
                {isLast && streaming && m.content !== '' && (
                  <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse text-accent">▍</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {spinnerOnly && <p className="mt-3 text-[13px] text-paper-muted">AI 正在想……</p>}
      {error !== '' && (
        <p role="alert" className="mt-3 text-[13px] text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void ask() }}
          disabled={busy}
          placeholder="这道题哪里可疑？直接说"
          aria-label="就这道题向 AI 提审题意见"
          className="min-w-0 flex-1 rounded-lg border border-paper-line bg-transparent px-3 py-2 text-[14px] text-paper-ink placeholder:text-paper-muted/70 focus:border-accent/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || input.trim() === ''}
          className="btn-primary px-4 py-2 text-[13px] disabled:opacity-40"
        >
          提问
        </button>
      </div>

      {/* ===== 收口：确认有问题 → 提交报告 ===== */}
      {submittedId !== '' ? (
        <p className="mt-4 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-[13px] text-paper-ink" data-testid="report-submitted">
          已记录报告 <code className="font-mono text-[12px]">{submittedId}</code>——开发者 <code className="font-mono text-[12px]">pnpm report:pull</code> 会拿到完整讨论。
        </p>
      ) : (
        <div className="mt-4 border-t border-paper-line pt-3">
          {canReport && (
            <div className="flex gap-2">
              <input
                type="text"
                value={conclusion}
                onChange={e => setConclusion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void submitReport() }}
                disabled={submitting}
                placeholder="一句话结论，如：第 2 条要点不属于这道题"
                aria-label="问题报告的结论"
                className="min-w-0 flex-1 rounded-lg border border-paper-line bg-transparent px-3 py-2 text-[14px] text-paper-ink placeholder:text-paper-muted/70 focus:border-accent/60 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={submitting || conclusion.trim() === ''}
                className="btn-primary px-4 py-2 text-[13px] disabled:opacity-40"
              >
                {submitting ? '提交中…' : '确认有问题，提交报告'}
              </button>
            </div>
          )}
          {reportError !== '' && (
            <p role="alert" className="mt-2 text-[13px] text-red-400">{reportError}</p>
          )}
          {!canReport && turns.length > 0 && (
            <p className="text-[12px] text-paper-muted">聊出结论后，这里可以把它连同讨论一并记录给开发者。</p>
          )}
        </div>
      )}
    </div>
  )
}
