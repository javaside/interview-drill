import { splitDetail } from '../content/split.js'
import type { ChatMessage, QaMessage } from './qa.js'

/**
 * 管理员审题问答纯核（learn 页管理员视角的第二个问答框）：与用户版 qa.ts 共用
 * 供应商注册表与 SSE 协议，但**上下文口径相反**——用户版刻意不发答案（防剧透），
 * 审题版必须全量：题面、题解、卡型、该卡全部要点（= 答案清单）、demo 代码、
 * content 源文件路径。审题审的就是答案本身，藏着答案就没法审。
 *
 * 同文件还承载「问题报告」的纯核部分：讨论记录清洗 + 题面快照装配 + 导出 Markdown
 * 渲染。闭环：线上发现（管理员与 AI 讨论）→ DB 记录（card_reports）→ 线下修复
 * （report:pull 导出本文件渲染的 Markdown → 开发者照着改 content/ → report:resolve 销单）。
 */

/** 审题上下文（CardSnapshot 的投影，比用户版 QaCard 多答案与路径） */
export type AdminQaCard = {
  cardId: string
  /** 含大类的块 id（如 java/generics）——content 源文件路径与 demo 加载都用它 */
  blockId: string
  blockName?: string
  question: string
  detail: string
  /** 题型（cards 表权威值）：审要点归属时 AI 需要知道考法 */
  cardType?: string
  /** 该卡要点（含退役墓碑时先 activeKeyPointsOf 过滤）——答案清单，审题版必发 */
  keyPoints?: ReadonlyArray<{ id: string; text: string; retiredAt?: string; order?: number }>
  /** 该卡专属错误选项（活/退役均透传，消费侧过滤退役）——审题对象之一，可选与 CardSnapshot 口径一致 */
  misconceptions?: ReadonlyArray<{ id: string; text: string; why: string; retiredAt?: string }>
  /** 剥头后的可运行示例（server 侧 loadDemoCode，已剥答案口径头注释） */
  demoCode?: string
}

/**
 * 在役要点（剔除退役墓碑，sequence 按 order 升序，其余保持内容原序）。
 * 与 LearnView.syllabusOf 同口径，但那是 app 层组件导出，server 不能反向依赖
 * （依赖单向 app→server→lib），故在 lib 侧独立一份。
 */
export function activeKeyPointsOf(
  kps: ReadonlyArray<{ id: string; text: string; retiredAt?: string; order?: number }>,
): Array<{ id: string; text: string }> {
  return kps
    .filter(kp => kp.retiredAt === undefined)
    .map(kp => ({ id: kp.id, text: kp.text, order: kp.order }))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map(({ id, text }) => ({ id, text }))
}

// ---- 管理员问答：历史窗口比用户版宽（审题常贴长段批评/引用原文） ----

/** 单条消息上限：用户版 300，管理员放宽到 1500（贴题干原文/长批评不憋屈） */
export const ADMIN_MAX_MESSAGE_CHARS = 1500
/** 携带历史条数上限（最近 N 条）= 8 轮追问；管理员用量低，窗口宽成本低 */
export const ADMIN_MAX_HISTORY_MESSAGES = 16

/** 清洗管理员对话历史：与 sanitizeHistory 同规则（丢畸形、截长、留最近 N 条），仅上限不同 */
export function sanitizeAdminHistory(history: unknown): QaMessage[] {
  if (!Array.isArray(history)) return []
  const cleaned: QaMessage[] = []
  for (const raw of history) {
    if (typeof raw !== 'object' || raw === null) continue
    const { role, content } = raw as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string' || content.trim() === '') continue
    cleaned.push({ role, content: content.slice(0, ADMIN_MAX_MESSAGE_CHARS) })
  }
  return cleaned.slice(-ADMIN_MAX_HISTORY_MESSAGES)
}

/**
 * 装配审题消息序列：[系统提示（全量材料，含答案）, ...历史]。
 * 历史末位必须是 user（本轮提问），否则视作没有问题——与用户版同约定。
 */
export function buildAdminQaMessages(card: AdminQaCard, history: QaMessage[]): ChatMessage[] {
  const { intro, advanced } = splitDetail(card.detail)
  const kps = activeKeyPointsOf(card.keyPoints ?? [])
  const sections = [
    '你是这套后端面试题库的审校搭档，正在和管理员一起审查下面这道题。',
    '用户侧的问答要防剧透，这里正相反：材料全量给你，包括答案（要点清单）——审题审的就是它。',
    '',
    '可以讨论什么：',
    '1. 技术正确性：题面、题解、要点、示例代码里有没有事实错误或过时表述。',
    '2. 表述质量：题干是否有歧义、要点措辞是否会被误读、判断题题干与「会/不会/取决于」句式是否搭。',
    '3. 要点归属：某条要点是否真的属于这道题（该不该是答案）、有没有该有而漏写的要点。',
    '4. 出题质量：干扰项区分度、多选/单选/排序的考法与内容是否匹配。',
    '',
    '回答要求：',
    '- 直接给判断和依据，该指出问题就指出；没问题也明确说为什么没问题，别和稀泥。',
    '- 认为要改时给出具体改法：改后的题干/要点文本直接写出来，而不是只说「建议优化」。',
    '- 管理员问到相关技术事实（版本差异、边界行为、标准演变）如实回答——那是审题的依据。',
    '- 中文、Markdown。不承担与这道题审查无关的委托（写代码、翻译、闲聊）。',
    '',
    `# 块\n${card.blockName ?? card.blockId}（${card.blockId}）`,
    `# 题面\n${card.question}`,
    `# 题型\n${card.cardType ?? '未知'}`,
  ]

  // 要点清单 = 答案。带 id 是因为管理员/AI 讨论时说「kp-xxx 第 3 条」两边对得上，
  // 报告里引用的要点 id 也能直接到 key_points 表里对号。
  if (kps.length > 0) {
    sections.push(
      '',
      '# 该卡要点清单（这就是答案，审题的核心对象）',
      ...kps.map((kp, i) => `${i + 1}. [${kp.id}] ${kp.text}`),
    )
  }

  sections.push('', `# 题解（入门版）\n${intro}`)
  if (advanced !== '') sections.push('', `# 题解（进阶版）\n${advanced}`)

  const demoCode = card.demoCode ?? ''
  if (demoCode !== '') {
    sections.push('', '# 可运行示例（演示类，审查其正确性与讲解一致性时用）', demoCode)
  }

  sections.push('', `# 源文件\ncontent/${card.blockId}/${card.cardId}.md`)

  const trimmed = sanitizeAdminHistory(history)
  const last = trimmed[trimmed.length - 1]
  if (last?.role !== 'user') {
    throw new Error('没有可回答的问题')
  }
  return [
    { role: 'system', content: sections.join('\n') },
    ...trimmed.map(m => ({ role: m.role, content: m.content })),
  ]
}

// ---- 问题报告：清洗 + 快照 + Markdown 渲染 ----

/** 讨论记录的一轮（与用户版 QaMessage 同形；reasoning 不入库——那是思考噪声不是结论） */
export type ReportTurn = QaMessage

/** 一句话结论的上限：报告台账与导出文件的「标题行」，长不了才有用 */
export const REPORT_CONCLUSION_MAX_CHARS = 140
/** 讨论记录轮数上限（一对 user+assistant 算 2 条）：超出保留最近的——结论在尾部 */
export const REPORT_MAX_TURNS = 24
/** 单轮内容上限（AI 回答可达数千字，8000 与 QA_MAX_OUTPUT_TOKENS 的正文量级匹配） */
export const REPORT_TURN_MAX_CHARS = 8000
/** 整份讨论记录的字符总预算（防灌水撑爆 jsonb 与导出文件） */
export const REPORT_TRANSCRIPT_MAX_CHARS = 64_000

/**
 * 清洗客户端提交的讨论记录：丢畸形条目、截长、超轮数保留最近、总量超预算即止。
 * 任何输入都不抛错——空结果由 server 层判定为业务拒绝（「没有可提交的讨论」）。
 */
export function sanitizeReportTurns(raw: unknown): ReportTurn[] {
  if (!Array.isArray(raw)) return []
  const cleaned: ReportTurn[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { role, content } = item as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string' || content.trim() === '') continue
    cleaned.push({ role, content: content.slice(0, REPORT_TURN_MAX_CHARS) })
  }
  const windowed = cleaned.slice(-REPORT_MAX_TURNS)
  const out: ReportTurn[] = []
  let used = 0
  for (const turn of windowed) {
    if (used + turn.content.length > REPORT_TRANSCRIPT_MAX_CHARS) break
    out.push(turn)
    used += turn.content.length
  }
  return out
}

/** 结论清洗：去首尾空白 + 截长。空串合法返回（是否必填由 server 判） */
export function sanitizeReportConclusion(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, REPORT_CONCLUSION_MAX_CHARS)
}

/**
 * 报告时的题面快照：报告发出后 content/ 可能已修改，快照让导出报告永远自带
 * 「当时在讨论什么」的语境，开发者不必对着变样的题面反推讨论。
 */
export type CardReportSnapshot = {
  blockId: string
  blockName: string
  cardType: string
  question: string
  /** 在役要点（= 答案清单），id 供与 key_points 表对号 */
  keyPoints: Array<{ id: string; text: string }>
  /**
   * 在役专属错误选项（= 错误答案清单，退役墓碑已剔）。mc 必须进快照：
   * mc 的「确实错」验证正压在审题闭环上（spec §5.3/§9.1）——审题兜底通道
   * 对 mc 不能是盲的，快照缺 mc，线下复盘（report:pull 导出）就无从核对
   * 某条 mc 是不是真的错了。spec §6.6「零改动面」清单的遗漏，终审补充修复。
   * 可选 = 无 mc 的存量卡不携带该字段（与 CardSnapshot 同约定）。
   */
  misconceptions?: Array<{ id: string; text: string; why: string; retiredAt?: string }>
  /** 题解全文（含 <!--advanced--> 分隔符，导出时再分层标注） */
  detail: string
  /** content 源文件相对路径——开发者照此直达要改的文件 */
  contentPath: string
}

/** 审题卡 → 快照（纯投影，server 层装配后随报告一并落库） */
export function reportSnapshotOf(card: AdminQaCard): CardReportSnapshot {
  // 活 mc（对齐 keyPoints 的装配：退役墓碑不进快照，留给 misconceptions 表存档）
  const liveMc = (card.misconceptions ?? [])
    .filter(m => m.retiredAt === undefined)
    .map(({ id, text, why }) => ({ id, text, why }))
  return {
    blockId: card.blockId,
    blockName: card.blockName ?? card.blockId,
    cardType: card.cardType ?? '',
    question: card.question,
    keyPoints: activeKeyPointsOf(card.keyPoints ?? []),
    ...(liveMc.length > 0 ? { misconceptions: liveMc } : {}),
    detail: card.detail,
    contentPath: `content/${card.blockId}/${card.cardId}.md`,
  }
}

/** 导出报告的入参（DB 行的投影；渲染纯函数，CLI 与测试共用） */
export type ReportMarkdownInput = {
  id: string
  cardId: string
  /** 提交时刻（ISO 字符串原样输出，时区换算是读报告人的本地事） */
  createdAt: string
  conclusion: string
  turns: ReadonlyArray<ReportTurn>
  snapshot: CardReportSnapshot
}

/** 讨论轮 → Markdown 段落标签 */
const TURN_LABEL: Record<ReportTurn['role'], string> = { user: '管理员', assistant: 'AI' }

/**
 * 报告 → 导出 Markdown（docs/card-reports/<id>.md 的文件内容）。
 * 自包含四件套：元信息（卡号/源文件路径/时间）、管理员结论、题面快照（分层题解）、
 * 完整讨论记录；结尾带处理指引——拿到文件的人照着走完就是一次完整销单。
 */
export function renderReportMarkdown(input: ReportMarkdownInput): string {
  const s = input.snapshot
  const { intro, advanced } = splitDetail(s.detail)
  const lines: string[] = [
    `# 题卡问题报告 \`${input.id}\``,
    '',
    `- 卡：${s.blockName}（\`${s.blockId}\`）`,
    `- 卡号：\`${input.cardId}\``,
    `- 源文件：\`${s.contentPath}\``,
    `- 提交：${input.createdAt}`,
    '',
    '## 管理员结论',
    '',
    `> ${input.conclusion}`,
    '',
    '## 报告时的题面快照',
    '',
    `**题面**：${s.question}`,
    '',
    `**卡型**：${s.cardType}`,
    '',
  ]
  if (s.keyPoints.length > 0) {
    lines.push('**要点清单（= 答案）**：', '')
    s.keyPoints.forEach((kp, i) => lines.push(`${i + 1}. [${kp.id}] ${kp.text}`))
    lines.push('')
  }
  // mc 清单必须随快照导出：线下复盘核对「某条 mc 是否确实错」就看这里（spec §5.3/§9.1）
  if (s.misconceptions !== undefined && s.misconceptions.length > 0) {
    lines.push('**专属错误选项（= 错误答案；why = 误解缘由）**：', '')
    s.misconceptions.forEach((m, i) => lines.push(`${i + 1}. [${m.id}] ${m.text} —— ${m.why}`))
    lines.push('')
  }
  lines.push('**题解（入门版）**', '', intro, '')
  if (advanced !== '') lines.push('**题解（进阶版）**', '', advanced, '')

  lines.push('## 讨论记录', '')
  for (const turn of input.turns) {
    lines.push(`**${TURN_LABEL[turn.role]}**：${turn.content}`, '')
  }

  lines.push(
    '## 处理指引（开发者）',
    '',
    '1. 对照上方快照与讨论，判断是否修改题卡；不改也要销单（说明理由后 resolve）。',
    `2. 修改 \`${s.contentPath}\` 后走扩产流水线：\`pnpm content:audit\` →（要点/题干变了）\`pnpm content:exclusion --judge && pnpm content:exclusion --apply\`。`,
    '3. \`DATABASE_URL=... pnpm content:upsert\` —— 本地库与生产库都要跑。',
    `4. \`pnpm report:resolve ${input.id}\` 销单（DB 置 resolved，并删除本文件）。`,
    '',
  )
  return lines.join('\n')
}
