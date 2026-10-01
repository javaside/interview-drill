import { splitDetail } from '../content/split.js'

/**
 * AI 问答纯核（learn 页每题一个问答框）：供应商选择 + 消息装配 + 历史清洗，零 IO。
 *
 * 上下文隔离铁律：`buildQaMessages` 的入参**只有一张卡**（题面 + 题解），
 * 结构上不可能混入其他卡——每道题的问答上下文独立，互不污染。
 * 多轮历史由客户端按卡持有、随请求携带，服务端不落库（刷新即清）。
 *
 * 供应商选择：每家一组独立环境变量（各自的 key/base/model），配哪家用哪家——
 * 没有公用 key。加供应商 = 往 PROVIDERS 表加一行，错误提示自动跟随。
 */

export type QaRole = 'user' | 'assistant'
export type QaMessage = { role: QaRole; content: string }

/** 揄取给 AI 的单卡上下文（cards 表 question + detail 的投影） */
export type QaCard = {
  cardId: string
  question: string
  detail: string
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * `/api/qa` 的流式事件协议（服务端与客户端共用一份定义）。
 * 业务拒绝（未配置/未解锁/限流/题目不存在）**发生在流开始之前**，仍走既有的
 * 400 + { error } 中文协议；只有流**开始之后**的故障才用 error 事件在带内上报。
 */
export type QaStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// ---- 供应商注册表（表驱动：加家 = 加一行） ----

/** 一家供应商的变量约定与默认值（base/model 均可被同名环境变量覆盖） */
export type ProviderSpec = {
  id: string
  /** 中文名，用于错误提示（如「DeepSeek 连不上」） */
  label: string
  apiKeyEnv: string
  baseUrlEnv: string
  modelEnv: string
  defaultBaseUrl: string
  defaultModel: string
}

export const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'zhipu', label: '智谱',
    apiKeyEnv: 'ZHIPU_API_KEY', baseUrlEnv: 'ZHIPU_BASE_URL', modelEnv: 'ZHIPU_MODEL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4.7-flash',
  },
  {
    id: 'deepseek', label: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY', baseUrlEnv: 'DEEPSEEK_BASE_URL', modelEnv: 'DEEPSEEK_MODEL',
    defaultBaseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-flash',
  },
]

/** 选中后的运行时配置（baseUrl 已去尾斜杠，可直接拼 /chat/completions） */
export type QaProviderRuntime = {
  id: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
}

/** 选择结果：ready=可用；off/misconfigured 带 server 直接抛给用户的中文消息 */
export type ProviderSelection =
  | { status: 'ready'; provider: QaProviderRuntime }
  | { status: 'off' | 'misconfigured'; message: string }

/** 各家 key 变量名清单，供「怎么配」提示自动跟随注册表 */
export function providerKeyHints(): string {
  return PROVIDERS.map(p => p.apiKeyEnv).join(' 或 ')
}

function resolve(spec: ProviderSpec, env: Record<string, string | undefined>): QaProviderRuntime {
  return {
    id: spec.id,
    label: spec.label,
    baseUrl: ((env[spec.baseUrlEnv] ?? '').trim().replace(/\/+$/, '')) || spec.defaultBaseUrl,
    apiKey: env[spec.apiKeyEnv] ?? '',
    model: (env[spec.modelEnv] ?? '').trim() || spec.defaultModel,
  }
}

/**
 * 供应商选择（纯函数）：配哪家用哪家。
 * - 显式 `AI_PROVIDER` → 用指定家（key 没配/名字不认识 = 配置错误，给针对性提示）；
 * - 未指定 → 按注册表顺序取第一家有 key 的；一家都没有 = 功能下线（off）。
 */
export function selectProvider(env: Record<string, string | undefined>): ProviderSelection {
  const wanted = (env.AI_PROVIDER ?? '').trim()
  if (wanted !== '') {
    const spec = PROVIDERS.find(p => p.id === wanted)
    if (spec === undefined) {
      return { status: 'misconfigured', message: `AI_PROVIDER=${wanted} 不认识（可选：${PROVIDERS.map(p => p.id).join(' / ')}）` }
    }
    if ((env[spec.apiKeyEnv] ?? '') === '') {
      return { status: 'misconfigured', message: `AI_PROVIDER 指定了 ${spec.id}，但还没有配 ${spec.apiKeyEnv}` }
    }
    return { status: 'ready', provider: resolve(spec, env) }
  }
  for (const spec of PROVIDERS) {
    if ((env[spec.apiKeyEnv] ?? '') !== '') return { status: 'ready', provider: resolve(spec, env) }
  }
  return { status: 'off', message: `AI 问答还没有配置（在环境变量里配 ${providerKeyHints()} 即可启用）` }
}

/** 单条消息长度上限：防把 provider 请求撑爆，也防用户粘贴整篇文章当问题 */
export const MAX_MESSAGE_CHARS = 2000
/** 携带历史条数上限（最近 N 条，含本次提问）——够多轮追问，又不让上下文无限膨胀 */
export const MAX_HISTORY_MESSAGES = 12

/**
 * 清洗客户端传来的历史：丢弃畸形条目（role 非法 / content 非字符串 / 超长截断），
 * 只保留最近 MAX_HISTORY_MESSAGES 条。任何输入都不会抛错——坏数据按无历史处理。
 */
export function sanitizeHistory(history: unknown): QaMessage[] {
  if (!Array.isArray(history)) return []
  const cleaned: QaMessage[] = []
  for (const raw of history) {
    if (typeof raw !== 'object' || raw === null) continue
    const { role, content } = raw as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string' || content.trim() === '') continue
    const text = content.slice(0, MAX_MESSAGE_CHARS)
    cleaned.push({ role, content: text })
  }
  return cleaned.slice(-MAX_HISTORY_MESSAGES)
}

/**
 * 装配 provider 消息序列：[系统提示（仅含这一道卡）, ...历史]。
 * 系统提示让 AI 扮演面试辅导老师、只围绕这道题作答；题解按入门/进阶分层标注。
 * 历史最后一条必须是 user（本轮提问），否则视作没有问题。
 */
export function buildQaMessages(card: QaCard, history: QaMessage[]): ChatMessage[] {
  const { intro, advanced } = splitDetail(card.detail)
  const sections = [
    '你是后端面试辅导老师。用户正在学习下面这道面试题，会针对它提问。',
    '只依据这道题的材料回答；材料没覆盖的细节可以补充常识，但要标注「材料之外」。',
    '用户问到其他题目时，简短说明这里只聊这一道题，并把回答拉回本题。',
    '回答用中文、Markdown，控制在必要长度——优先讲清「为什么」，再给「怎么记」。',
    '',
    `# 题面\n${card.question}`,
    '',
    `# 题解（入门版）\n${intro}`,
  ]
  if (advanced !== '') sections.push('', `# 题解（进阶版）\n${advanced}`)

  const trimmed = sanitizeHistory(history)
  const last = trimmed[trimmed.length - 1]
  if (last?.role !== 'user') {
    throw new Error('没有可回答的问题')
  }
  return [
    { role: 'system', content: sections.join('\n') },
    ...trimmed.map(m => ({ role: m.role, content: m.content })),
  ]
}
