import matter from 'gray-matter'
import { cardSchema } from './schema.js'
import { checkKeyPointText, checkSequenceKeyPointText } from './rules.js'
import { MATTER_OPTS } from './yaml.js'
import type { Card } from './types.js'

export type ParseResult =
  | { ok: true; card: Card }
  | { ok: false; issues: string[] }

/**
 * 解析单个内容源文件。接收字符串而非路径 —— lib/content 保持零 IO，
 * 读盘只发生在 tools/ 和 CI 脚本里。`path` 仅用于错误信息。
 */
export function parseCard(raw: string, path: string): ParseResult {
  let data: unknown
  let body: string
  try {
    const fm = matter(raw, MATTER_OPTS)
    data = fm.data
    body = fm.content
  } catch (e) {
    return { ok: false, issues: [`${path}: frontmatter 解析失败 —— ${String(e)}`] }
  }

  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return { ok: false, issues: [`${path}: 缺少 YAML frontmatter`] }
  }

  if ('detail' in (data as object)) {
    return { ok: false, issues: [`${path}: detail 应写在正文里，不要放进 frontmatter`] }
  }

  const parsed = cardSchema.safeParse({ ...(data as object), detail: body })
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(i => `${path}: ${i.path.join('.')} —— ${i.message}`),
    }
  }

  const card: Card = parsed.data
  const textIssues = card.keyPoints.flatMap(kp =>
    checkKeyPointText(kp.text).map(msg => `${path}: 要点 ${kp.id} —— ${msg}`),
  )
  if (textIssues.length > 0) return { ok: false, issues: textIssues }

  if (card.cardType === 'sequence') {
    const seqIssues = card.keyPoints.flatMap(kp =>
      checkSequenceKeyPointText(kp.text).map(msg => `${path}: 要点 ${kp.id} —— ${msg}`),
    )
    if (seqIssues.length > 0) return { ok: false, issues: seqIssues }
  }

  // 正文标记配对校验：** / ` 奇数个 = 未配对，粗体会整体错位、反引号裸显在页面
  const boldPairs = (card.detail.match(/\*\*/g) ?? []).length
  if (boldPairs % 2 === 1) {
    return { ok: false, issues: [`${path}: 正文 ** 未配对（共 ${boldPairs} 组）——渲染会错位，请修正正文标记`] }
  }
  const tickCount = (card.detail.match(/`/g) ?? []).length
  if (tickCount % 2 === 1) {
    return { ok: false, issues: [`${path}: 正文 \` 未配对（共 ${tickCount} 个）——会裸显在页面上，请删除或补全`] }
  }

  return { ok: true, card }
}
