import type { SqlRunner } from './db/adapters.js'
import { loadCardSnapshots } from './db/adapters.js'
import { selectProvider, type ProviderSelection } from '../lib/ai/qa.js'
import { sanitizeAdminHistory, buildAdminQaMessages } from '../lib/ai/admin-qa.js'
import { loadDemoCode } from './demo-code.js'
import { pumpProviderStream } from './qa.js'

/**
 * 管理员审题问答编排层：与用户版 server/qa.ts 同构（纯核装配 → 连 provider →
 * 复用同一个流泵），差异全在「审题」口径上：
 * - 上下文全量（含要点答案、demo、源文件路径——lib/ai/admin-qa 纯核保证）；
 * - **无免费墙**：审题是运维动作，不该取决于付费状态（未解锁块也要能审）；
 * - **无每日配额**：管理员自己人，20/天 挡审题是自缚手脚；保留每分钟限流防手滑。
 *
 * 错误分界与用户版一致：准备段（含连不上/provider 非 2xx）抛中文消息 → 路由回
 * 400 + { error }；流开始后的故障走带内 error 事件（改不了已发出的状态码）。
 */

// ---- 每分钟限流（与用户版各自独立计数：审题不该被同账号的刷题问答挤占额度） ----
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const hitsByAdmin = new Map<string, number[]>()

function rateLimited(userId: string, nowMs: number): boolean {
  const past = (hitsByAdmin.get(userId) ?? []).filter(t => nowMs - t < RATE_WINDOW_MS)
  if (past.length >= RATE_MAX) {
    hitsByAdmin.set(userId, past)
    return true
  }
  past.push(nowMs)
  hitsByAdmin.set(userId, past)
  return false
}

/** 测试专用：清空审题限流窗口（模块级状态会跨用例串味） */
export function resetAdminQaRateLimiterForTest(): void {
  hitsByAdmin.clear()
}

export type AdminQaDeps = {
  db: SqlRunner
  userId: string
  cardId: string
  /** 讨论历史（含本轮提问，末位须为 user）；服务端只清洗不持久化 */
  history: unknown
  /** 注入测试；缺省 selectProvider(process.env)（与用户问答共用供应商配置） */
  selection?: ProviderSelection
  /** 注入测试；缺省全局 fetch */
  fetchImpl?: typeof fetch
  /** 注入测试；缺省真实 demo loader（content/<块>/<卡>.java，已剥头） */
  loadDemoCode?: (blockId: string, cardId: string) => string | null
}

/**
 * 审题流式问答：选供应商 → 限流 → 读卡（全量装配，含答案）→ 连 provider → 流泵。
 * 管理员鉴权在路由层（requireAdminUserId），被调到即视为已过闸。
 */
export async function adminQaStreamHandler(deps: AdminQaDeps): Promise<ReadableStream<Uint8Array>> {
  const sel = deps.selection ?? selectProvider(process.env)
  if (sel.status !== 'ready') throw new Error(sel.message)
  const { provider } = sel

  if (rateLimited(deps.userId, Date.now())) throw new Error('提问太快了，歇一分钟再问')

  const history = sanitizeAdminHistory(deps.history)
  const card = (await loadCardSnapshots(deps.db, [deps.cardId])).get(deps.cardId)
  if (card === undefined) throw new Error('题目不存在或已下线')

  const demoCode = (deps.loadDemoCode ?? loadDemoCode)(card.blockId, card.cardId)
  const messages = buildAdminQaMessages(
    {
      cardId: card.cardId,
      blockId: card.blockId,
      question: card.question ?? '',
      detail: card.detail ?? '',
      cardType: card.cardType,
      keyPoints: card.keyPoints,
      ...(card.blockName ? { blockName: card.blockName } : {}),
      ...(demoCode === null ? {} : { demoCode }),
    },
    history,
  )

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
        max_tokens: provider.maxTokens,
        ...provider.extraBody,
      }),
    })
  } catch {
    throw new Error(`${provider.label} 连不上，请稍后再试`)
  }
  if (!res.ok) throw new Error(`${provider.label} 暂时不可用（HTTP ${res.status}），请稍后再试`)

  return pumpProviderStream(res, provider.label)
}
