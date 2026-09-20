import matter from 'gray-matter'
import { cardSchema } from './schema.js'
import { checkKeyPointText } from './rules.js'
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

  return { ok: true, card }
}
