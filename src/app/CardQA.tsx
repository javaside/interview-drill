'use client'

import { useEffect, useRef, useState } from 'react'
import { browserApi } from '../client/api.js'
import type { QaMessage } from '../lib/ai/qa.js'
import { RichText } from './RichText.js'

/**
 * 单卡 AI 问答框（learn 页每题一个、刷题页当前题一个）：状态全在组件实例内——
 * 每道题的对话历史天然独立，请求只携带本卡历史，服务端上下文只含本卡。
 * 折叠起步（教材/答题优先，问答按需展开）；错误走 role=alert（项目错误协议）。
 *
 * 流式：正文逐段增量渲染。思考型模型（DeepSeek）会先吐几秒推理内容——
 * 这段时间显示「思考中」并实时铺开推理原文（实测 594ms 就有字，而正文要等约 5s），
 * 正文一开始就把它收进可展开的「思考过程」，不干扰阅读。
 *
 * 卸载/收起时中断在途请求，废弃的流不再写状态。
 */

/** 一轮对话：正文 +（思考型模型）该轮的推理内容，两者同生同灭 */
type Turn = QaMessage & { reasoning?: string }

export function CardQA(
  { cardId, options }: {
    cardId: string
    /** 当前题在界面上展示的选项（刷题页传、learn 页无）——AI 靠它回答「这个选项为什么不对」 */
    options?: readonly string[]
  },
): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    // 离线直接说清楚，不让用户干等一次网络超时（刷题常在弱网）
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('现在没有网络——恢复联网后再问')
      return
    }
    setError('')
    setBusy(true)
    // 展示用列表保留每轮的思考（reasoning）；发给服务端的 history 只带 role/content。
    // 注意别用 map(({role, content}) => ...) 重建列表——那会把历史轮次的思考抹掉。
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
      await browserApi().postQaStream(cardId, history, {
        onDelta: text => {
          gotContent = true
          if (aliveRef.current) append('content', text)
        },
        onReasoning: text => {
          gotReasoning = true
          if (aliveRef.current) append('reasoning', text)
        },
      }, options, controller.signal)
    } catch (e) {
      if (!aliveRef.current) return
      setError(e instanceof Error ? e.message : '提问失败，请重试')
      // 一个字都没拿到（拒绝/断连）：把这轮提问撤回输入框，改完直接重发。
      // 已经吐出内容的（正文或思考都算）：留在屏上，别让用户看着已有信息凭空消失。
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
        className="btn-ghost mt-4 py-1.5 text-[13px]"
      >
        有疑问？问 AI
      </button>
    )
  }

  const last = turns[turns.length - 1]
  const streaming = busy && last?.role === 'assistant'
  // 正文还没开始、但思考已经来了：正在「想」的实况
  const thinkingLive = streaming && last.reasoning !== undefined && last.content === ''
  const spinnerOnly = busy && !thinkingLive && !(streaming && last.content !== '')

  return (
    <div className="mt-4 rounded-md border border-paper-line bg-paper-wash px-4 py-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">问 AI · 只聊这道题</p>
        <button
          type="button"
          onClick={close}
          className="text-[12px] text-paper-muted transition-colors hover:text-paper-ink"
          aria-label="收起问答"
        >
          收起
        </button>
      </div>

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
                {/* 思考：正在想 → 实时铺开；正文开始后 → 收进可展开的「思考过程」 */}
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
          placeholder="这道题哪里没看懂，直接问"
          aria-label="就这道题向 AI 提问"
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
    </div>
  )
}
