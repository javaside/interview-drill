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

/**
 * 批处理变体：把整张卡的 `excludeAsDistractorFor` **置为**账本投影给出的集合。
 *
 * 与逐条登记（`registerDecision`，只做并集）的区别是**权威方向相反**：这里账本是
 * 单一来源，卡文件是它的投影 —— 投影里没有的必须被清掉，否则账本删掉一条判定后
 * 卡文件残留登记，闸门的「卡文件 == 账本投影」检查会一直红。
 *
 * 幂等：同样的投影重复跑输出逐字节相同（变更只在真正不同时才落到文件上，由调用方
 * 比对字符串决定是否写盘）。`verifiedAt` 不 Date 化、`url` 不加引号这些坑同
 * `registerDecision`（共用 MATTER_OPTS + detachedData）。
 */
export function applyExclusionsToRaw(
  raw: string,
  byKeyPointId: ReadonlyMap<string, readonly string[]>,
): string {
  const fm = matter(raw, MATTER_OPTS)
  const data = detachedData(fm.data) as { keyPoints?: RawKeyPoint[] }
  const kps = data.keyPoints
  if (!Array.isArray(kps)) throw new Error('frontmatter 缺少 keyPoints 数组')

  for (const kp of kps) {
    if (typeof kp.id !== 'string') continue
    const next = Array.from(new Set(byKeyPointId.get(kp.id) ?? [])).sort()
    kp.excludeAsDistractorFor = next
  }

  return matter.stringify(fm.content, data, MATTER_OPTS)
}
