import { z } from 'zod'
import { YAML_ENGINE } from './yaml.js'
import { checkBlockName } from './rules.js'

export type Block = {
  id: string
  name: string
  category: string
  /** wip = 在建，不参与干扰项池容量校验；ready = 已完善，全部校验生效 */
  status: 'wip' | 'ready'
}

const blockSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(['wip', 'ready']).default('wip'),
}).strict()

export type ParseBlockResult =
  | { ok: true; block: Block }
  | { ok: false; issues: string[] }

/**
 * 解析 block.yml。直接用共享引擎读纯 YAML —— 早期版本把内容包进 `---` 再交给
 * gray-matter，那是个 hack：raw 里只要出现 `---`（YAML 文档分隔符）或首行缩进，
 * 包装就会错位。
 */
export function parseBlock(raw: string, path: string): ParseBlockResult {
  let data: unknown
  try {
    data = YAML_ENGINE.parse(raw)
  } catch (e) {
    return { ok: false, issues: [`${path}: YAML 解析失败 —— ${String(e)}`] }
  }

  const parsed = blockSchema.safeParse(data)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(i => `${path}: ${i.path.join('.')} —— ${i.message}`),
    }
  }

  const nameIssues = checkBlockName(parsed.data.name).map(m => `${path}: ${m}`)
  if (nameIssues.length > 0) return { ok: false, issues: nameIssues }

  return { ok: true, block: parsed.data }
}
