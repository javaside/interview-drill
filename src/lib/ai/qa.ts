import { splitDetail } from '../content/split.js'

/**
 * AI 问答纯核（learn 页每题一个问答框）：只做消息装配与历史清洗，零 IO。
 *
 * 上下文隔离铁律：`buildQaMessages` 的入参**只有一张卡**（题面 + 题解），
 * 结构上不可能混入其他卡——每道题的问答上下文独立，互不污染。
 * 多轮历史由客户端按卡持有、随请求携带，服务端不落库（刷新即清）。
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
