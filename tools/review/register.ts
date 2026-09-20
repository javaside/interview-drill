import matter from 'gray-matter'
import { MATTER_OPTS, detachedData } from '../../src/lib/content/yaml.js'

type RawKeyPoint = {
  id?: unknown
  excludeAsDistractorFor?: unknown
  confirmedIndependentOf?: unknown
}

export type Decision = 'exclude' | 'independent'

/**
 * 把一条人工判定写回源文件内容。字符串进、字符串出，不碰文件系统。
 *
 * 两个**必须**的细节，少一个就出事：
 *
 * 1. `MATTER_OPTS` —— 默认引擎会把 `verifiedAt: 2026-09-18` 读成 Date、
 *    写回成 `2026-09-18T00:00:00.000Z`，还顺手给 `url:` 加引号。
 *    计划早期版本声称的"diff 稳定"在实测里是假的：每登记一条互斥就污染一批无关字段。
 * 2. `detachedData` —— gray-matter 按输入字符串缓存，`fm.data` 是缓存里的**引用**。
 *    直接改它会污染缓存：实测同一输入第二次调用会带出第一次的修改结果，
 *    函数根本不纯。而本文件三条测试里有两条会"通过"，掩盖这个 bug。
 */
export function registerDecision(
  raw: string,
  keyPointId: string,
  targetCardId: string,
  decision: Decision,
): string {
  const fm = matter(raw, MATTER_OPTS)
  const data = detachedData(fm.data) as { keyPoints?: RawKeyPoint[] }
  const kps = data.keyPoints
  if (!Array.isArray(kps)) throw new Error('frontmatter 缺少 keyPoints 数组')

  const kp = kps.find(k => k.id === keyPointId)
  if (!kp) throw new Error(`要点 id 不存在：${keyPointId}`)

  const field = decision === 'exclude' ? 'excludeAsDistractorFor' : 'confirmedIndependentOf'
  const cur = Array.isArray(kp[field]) ? (kp[field] as string[]) : []
  // 排序后写回，保证 diff 只显示真正新增的那一项
  kp[field] = Array.from(new Set([...cur, targetCardId])).sort()

  return matter.stringify(fm.content, data, MATTER_OPTS)
}
