import type { SqlRunner } from './db/adapters.js'
import { loadSettings, loadCardSnapshots, entitlementOf } from './db/adapters.js'
import { isEntitled } from '../lib/entitlement/entitlement.js'
import { sanitizeHistory, buildQaMessages, type QaMessage } from '../lib/ai/qa.js'

/**
 * AI 问答编排层：纯核（lib/ai/qa）注入 IO——DB 读卡、entitlement 校验、
 * OpenAI 兼容 chat/completions 调用、内存限流。SQL 走 adapters，本层零 SQL。
 *
 * 免费墙：未解锁块的卡不给问（题面/题解不下发，AI 也不能当旁路泄漏）。
 * 上下文只含目标一卡（纯核保证）；历史由客户端按卡携带，服务端不落库。
 */

export type QaConfig = { baseUrl: string; apiKey: string; model: string }

/** 从环境变量读 provider 配置；缺 API key → null（功能未配置，路由给中文提示） */
export function qaConfigOf(env: Record<string, string | undefined>): QaConfig | null {
  const apiKey = env.AI_API_KEY ?? ''
  if (apiKey === '') return null
  return {
    baseUrl: (env.AI_BASE_URL ?? '').replace(/\/+$/, '') || 'https://open.bigmodel.cn/api/paas/v4',
    apiKey,
    model: env.AI_MODEL ?? 'glm-4.7-flash',
  }
}

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

export type QaDeps = {
  db: SqlRunner
  userId: string
  cardId: string
  /** 该卡的对话历史（含本轮提问，末位须为 user）；服务端只清洗不持久化 */
  history: unknown
  /** 注入测试；缺省读 process.env（qaConfigOf） */
  config?: QaConfig | null
  /** 注入测试；缺省全局 fetch */
  fetchImpl?: typeof fetch
  now?: () => number
}

/**
 * 问答主流程：校验配置 → 限流 → 读卡 + 免费墙 → 纯核装配消息 → 调 provider。
 * 返回 { answer }；业务拒绝直接 throw new Error('中文消息')，路由薄壳转 400。
 */
export async function qaHandler(deps: QaDeps): Promise<{ answer: string }> {
  const config = deps.config !== undefined ? deps.config : qaConfigOf(process.env)
  if (config === null) throw new Error('AI 问答还没有配置（缺 AI_API_KEY 环境变量）')

  const now = deps.now ?? Date.now
  if (rateLimited(deps.userId, now())) {
    throw new Error('提问太快了，歇一分钟再问')
  }

  const history: QaMessage[] = sanitizeHistory(deps.history)
  const card = (await loadCardSnapshots(deps.db, [deps.cardId])).get(deps.cardId)
  if (card === undefined) throw new Error('题目不存在或已下线')

  const ent = entitlementOf(await loadSettings(deps.db, deps.userId))
  if (!isEntitled(ent, card.blockId)) throw new Error('这个块还没有解锁，先去解锁才能提问')

  const messages = buildQaMessages(
    { cardId: card.cardId, question: card.question ?? '', detail: card.detail ?? '' },
    history,
  )

  const fetchImpl = deps.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages }),
    })
  } catch {
    throw new Error('AI 服务连不上，请稍后再试')
  }
  if (!res.ok) throw new Error(`AI 服务暂时不可用（HTTP ${res.status}），请稍后再试`)

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>
  } | null
  const answer = data?.choices?.[0]?.message?.content
  if (typeof answer !== 'string' || answer.trim() === '') {
    throw new Error('AI 没有返回内容，换个问法试试')
  }
  return { answer }
}
