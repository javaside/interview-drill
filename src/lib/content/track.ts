import { z } from 'zod'
import { YAML_ENGINE } from './yaml.js'

/**
 * 岗位包（track）：块的有序引用集合——岗位与技术领域（category）正交，
 * 岗位是「打包视图」不改变块归属。category 仍是干扰项池分组键，entitlement
 * 仍只认 blockId（免费 2 块/付费全部）——track 是纯导航与预选层，不进计费边界。
 */
export type Track = {
  id: string
  name: string
  tagline: string
  /** 有序 = 建议学习顺序；元素是块 id（category/slug） */
  blocks: string[]
}

const trackSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'track id 用小写字母与连字符（如 java-backend）'),
  name: z.string().min(1),
  tagline: z.string().min(1),
  blocks: z.array(z.string().regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/, '块引用形如 category/slug')).min(1),
}).strict()

export type ParseTrackResult =
  | { ok: true; track: Track }
  | { ok: false; issues: string[] }

/** 解析 tracks/*.yml（与 block.yml 同构的纯 YAML，无 front matter 包装） */
export function parseTrack(raw: string, path: string): ParseTrackResult {
  let data: unknown
  try {
    data = YAML_ENGINE.parse(raw)
  } catch (e) {
    return { ok: false, issues: [`${path}: YAML 解析失败 —— ${String(e)}`] }
  }

  const parsed = trackSchema.safeParse(data)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(i => `${path}: ${i.path.join('.')} —— ${i.message}`),
    }
  }
  return { ok: true, track: parsed.data }
}
