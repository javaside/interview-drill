import type { SqlRunner } from './db/adapters.js'
import { loadSettings, loadCardSnapshots, entitlementOf } from './db/adapters.js'
import { isEntitled } from '../lib/entitlement/entitlement.js'
import { localDateOf } from './time.js'
import {
  sanitizeHistory, sanitizeOptions, sanitizeAttempt, buildQaMessages, selectProvider, QA_DAILY_QUOTA,
  type QaMessage, type ChatMessage, type ProviderSelection, type QaProviderRuntime, type QaStreamEvent,
} from '../lib/ai/qa.js'
import { parseSseChunks, encodeSseFrame, sseDeltaOf, sseReasoningOf, chatAnswerOf } from '../lib/ai/sse.js'

/**
 * AI 问答编排层：纯核（lib/ai）注入 IO——DB 读卡、entitlement 校验、
 * OpenAI 兼容 chat/completions 流式调用、内存限流。SQL 走 adapters，本层零 SQL。
 *
 * 分两段，边界就是「错误怎么回」：
 * - prepareQa：鉴权之后的全部业务校验。抛错时**流还没开始**，路由照旧回 400 + 中文。
 * - qaStreamHandler：连 provider（fetch 只在收到响应头时 resolve，故「连不上 / provider
 *   非 2xx」仍属准备段，照样回 400），之后把 provider 的 SSE 转成我们自己的事件流。
 *   流开始之后的故障只能带内上报（error 事件）——此时 HTTP 状态已发出，改不了了。
 *
 * 供应商：每家一组独立环境变量（ZHIPU_API_KEY / DEEPSEEK_API_KEY ……），配哪家用哪家。
 * 免费墙：未解锁块的卡不给问（题面/题解不下发，AI 也不能当旁路泄漏）。
 * 上下文只含目标一卡（纯核保证）；历史由客户端按卡携带，服务端不落库。
 */

// ---- 内存限流（单进程 systemd 部署够用；按 userId 滑动窗口） ----
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const hitsByUser = new Map<string, number[]>()

function rateLimited(userId: string, nowMs: number): boolean {
  const past = (hitsByUser.get(userId) ?? []).filter(t => nowMs - t < RATE_WINDOW_MS)
  if (past.length >= RATE_MAX) {
    hitsByUser.set(userId, past)
    return true
  }
  past.push(nowMs)
  hitsByUser.set(userId, past)
  return false
}

/** 测试专用：清空限流窗口（模块级状态会跨用例串味） */
export function resetQaRateLimiterForTest(): void {
  hitsByUser.clear()
}

// ---- 每日配额（防单账号刷量；按用户本地自然日重置） ----
// 与每分钟限流同样放内存：单进程 systemd 部署够用。代价是重启/发版会重置当天计数——
// 可接受的松弛（用户无法触发重启），换来零 DB 写入与零迁移。
const usageByUser = new Map<string, { date: string; count: number }>()

/**
 * 记账式判定：未超限则**消费一次**并返回 false。
 * 只在「即将真正调用 provider」时调用，这样参数错误/未解锁的请求不白扣次数。
 */
function quotaExceeded(
  userId: string, plan: 'free' | 'paid', timezone: string, nowMs: number,
): boolean {
  const date = localDateOf(nowMs, timezone)
  const limit = QA_DAILY_QUOTA[plan]
  const used = usageByUser.get(userId)
  const count = used !== undefined && used.date === date ? used.count : 0
  if (count >= limit) {
    usageByUser.set(userId, { date, count })
    return true
  }
  usageByUser.set(userId, { date, count: count + 1 })
  return false
}

/** 测试专用：清空每日配额计数 */
export function resetQaQuotaForTest(): void {
  usageByUser.clear()
}

export type QaDeps = {
  db: SqlRunner
  userId: string
  cardId: string
  /** 该卡的对话历史（含本轮提问，末位须为 user）；服务端只清洗不持久化 */
  history: unknown
  /**
   * 用户在界面上看到的选项原文（刷题页才有）。**由客户端提供**——服务端重算变体
   * 会依赖 userId/reviewIndex 的 seed，算错就变成「AI 聊的选项和用户屏幕上的不是一份」，
   * 违背本项目「判分与展示同卷」的口径。服务端只清洗（条数/长度上限），题型另取自 DB。
   */
  options?: unknown
  /**
   * 用户的作答与判分结果（仅屏②提供）。屏① 用户还没作答，客户端传 null——
   * 那正是「不剧透答案」的结构保证，服务端不需要额外判断。
   */
  attempt?: unknown
  /** 注入测试；缺省 selectProvider(process.env)（各家独立环境变量） */
  selection?: ProviderSelection
  /** 注入测试；缺省全局 fetch */
  fetchImpl?: typeof fetch
  now?: () => number
}

export type PreparedQa = { provider: QaProviderRuntime; messages: ChatMessage[] }

/**
 * 准备段：选供应商 → 限流 → 读卡 + 免费墙 → 纯核装配消息。
 * 任何业务拒绝都在这句 throw（中文消息），此时尚未向 provider 发请求、更未开流。
 */
export async function prepareQa(deps: QaDeps): Promise<PreparedQa> {
  const sel = deps.selection ?? selectProvider(process.env)
  if (sel.status !== 'ready') throw new Error(sel.message)
  const { provider } = sel

  const now = deps.now ?? Date.now
  const nowMs = now()
  if (rateLimited(deps.userId, nowMs)) throw new Error('提问太快了，歇一分钟再问')

  const settings = await loadSettings(deps.db, deps.userId, nowMs)

  const history: QaMessage[] = sanitizeHistory(deps.history)
  const card = (await loadCardSnapshots(deps.db, [deps.cardId])).get(deps.cardId)
  if (card === undefined) throw new Error('题目不存在或已下线')

  const ent = entitlementOf(settings, nowMs)
  if (!isEntitled(ent, card.blockId)) throw new Error('这个块还没有解锁，先去解锁才能提问')

  const messages = buildQaMessages(
    {
      cardId: card.cardId,
      question: card.question ?? '',
      detail: card.detail ?? '',
      options: sanitizeOptions(deps.options),
      cardType: card.cardType,   // 服务端权威（cards 表），不取自客户端
      attempt: sanitizeAttempt(deps.attempt),
    },
    history,
  )

  // 配额放最后：只有真要打 provider 的请求才扣次数（参数错/未解锁不白扣）
  if (quotaExceeded(deps.userId, settings.plan, settings.timezone, nowMs)) {
    throw new Error(
      `今天的 ${QA_DAILY_QUOTA[settings.plan]} 次提问已用完——明天恢复。` +
      '想深入某道题，可以先看题解或加入学习页复习。',
    )
  }
  return { provider, messages }
}

/**
 * 流式问答：准备（可抛 400 级错误）→ 连接 provider（校验响应头）→ 返回可读流。
 * 返回后的一切故障都走带内 error 事件。
 */
export async function qaStreamHandler(deps: QaDeps): Promise<ReadableStream<Uint8Array>> {
  const { provider, messages } = await prepareQa(deps)

  const fetchImpl = deps.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.apiKey}`,
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: true,
        // 成本闸门：不限的话 DeepSeek 思考模式默认可生成 64K tokens
        max_tokens: provider.maxTokens,
        // 家特有参数（如 DeepSeek 的 reasoning_effort）——不能全局下发，见 ProviderSpec
        ...provider.extraBody,
      }),
    })
  } catch {
    throw new Error(`${provider.label} 连不上，请稍后再试`)
  }
  if (!res.ok) throw new Error(`${provider.label} 暂时不可用（HTTP ${res.status}），请稍后再试`)

  return pumpProviderStream(res, provider.label)
}

/** 把 provider 的 SSE 转成我们自己的事件流（delta → done，故障 → error） */
function pumpProviderStream(res: Response, label: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = res.body?.getReader()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: QaStreamEvent): void => {
        controller.enqueue(encoder.encode(encodeSseFrame(JSON.stringify(event))))
      }
      let buffer = ''   // 未凑满一帧的尾巴
      let raw = ''      // 原始字节全文（provider 忽略 stream 时的兜底解析用）
      let answer = ''

      const handleText = (text: string): void => {
        raw += text
        buffer += text
        const { frames, rest } = parseSseChunks(buffer)
        buffer = rest
        for (const frame of frames) {
          // 思考型模型先吐 reasoning、后吐正文：两者各自转发（同一帧也可能都带）
          const reasoning = sseReasoningOf(frame.data)
          if (reasoning !== null) send({ type: 'reasoning', text: reasoning })
          const delta = sseDeltaOf(frame.data)
          if (delta !== null) {
            answer += delta
            send({ type: 'delta', text: delta })
          }
        }
      }

      try {
        if (reader === undefined) {
          send({ type: 'error', message: 'AI 没有返回内容，换个问法试试' })
          return
        }
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          handleText(decoder.decode(value, { stream: true }))
        }
        handleText(decoder.decode())   // 冲掉解码器里残留的多字节尾部

        if (answer === '') {
          // provider 无视了 stream：整包 JSON 兜底，一次补齐
          const whole = chatAnswerOf(raw)
          if (whole === null) {
            send({ type: 'error', message: 'AI 没有返回内容，换个问法试试' })
            return
          }
          send({ type: 'delta', text: whole })
        }
        send({ type: 'done' })
      } catch {
        send({ type: 'error', message: `${label} 连接中断，请重试` })
      } finally {
        controller.close()
      }
    },
    cancel() {
      void reader?.cancel()
    },
  })
}
