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
 * 流式：回答逐段增量渲染，首字几百毫秒就可见。卸载（换题/收起）时中断请求，
 * 不让废弃的流继续写状态。
 */
export function CardQA({ cardId }: { cardId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<QaMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aliveRef = useRef(true)

  // 卸载：中断在途的流（换题时组件被 key 重建，旧流不该继续跑）
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  /** 把增量追加到末条 assistant 消息（没有就起一条） */
  function appendDelta(text: string): void {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { role: 'assistant', content: last.content + text }]
      }
      return [...prev, { role: 'assistant', content: text }]
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
    // 先把本轮提问上屏（乐观渲染），历史副本随请求发出
    const history = [...messages, { role: 'user', content: question }] as QaMessage[]
    setMessages(history)
    setInput('')

    let gotDelta = false
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await browserApi().postQaStream(
        cardId, history,
        text => {
          gotDelta = true
          if (aliveRef.current) appendDelta(text)
        },
        controller.signal,
      )
    } catch (e) {
      if (!aliveRef.current) return
      setError(e instanceof Error ? e.message : '提问失败，请重试')
      // 一个字都没拿到（拒绝/断连）：把这轮提问撤回输入框，改完直接重发。
      // 已经吐出部分回答的：保留在屏上，别让用户看着答案凭空消失。
      if (!gotDelta) {
        setMessages(messages)
        setInput(question)
      }
    } finally {
      if (aliveRef.current) {
        setBusy(false)
        inputRef.current?.focus()
      }
    }
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

  // 已开始吐字就别再显示「正在想」——生长中的文字本身就是进度
  const streaming = busy && messages[messages.length - 1]?.role === 'assistant'

  return (
    <div className="mt-4 rounded-md border border-paper-line bg-paper-wash px-4 py-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">问 AI · 只聊这道题</p>
        <button
          type="button"
          onClick={() => { setOpen(false); abortRef.current?.abort(); setBusy(false) }}
          className="text-[12px] text-paper-muted transition-colors hover:text-paper-ink"
          aria-label="收起问答"
        >
          收起
        </button>
      </div>

      {messages.length > 0 && (
        <div className="mt-3 space-y-3">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <p key={i} className="rounded-lg bg-white/[0.05] px-3 py-2 text-[14px] leading-relaxed text-paper-ink">
                {m.content}
              </p>
            ) : (
              <div key={i} className="space-y-2 text-[14px] leading-relaxed text-paper-ink">
                <RichText text={m.content} />
                {streaming && i === messages.length - 1 && (
                  <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse text-accent">▍</span>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {busy && !streaming && <p className="mt-3 text-[13px] text-paper-muted">AI 正在想……</p>}
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
