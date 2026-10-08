/**
 * Demo 快照域纯函数（零 IO）：头 Javadoc 解析、剥头、audit 判定。
 * 快照约定见 docs/superpowers/specs/2026-10-08-demo-code-link-design.md §3——
 * 头注释三行「题目/题卡/块」是 interview-code 的既定 Javadoc 约定。
 *
 * 「题卡标记」指注释块内含 `题卡：<26 位 ULID>` 行；剥头规则剥的是
 * **含该标记的那个块**（不是第一个块——将来加 license 头也不会剥错对象）。
 */

/** Crockford base32 ULID 字符集（无 I L O U）。内联进「题卡：」行匹配——不能带 ^$ 锚 */
const ULID_SRC = '[0-9A-HJKMNP-TV-Z]{26}'
const BLOCK_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/

export type DemoHeader = { ulid: string; block: string }

/** 找到含「题卡：」标记的块注释；没有则 null（非题卡文件） */
function demoCommentBlock(source: string): { start: number; end: number; text: string } | null {
  for (const m of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
    if (m[0].includes('题卡：')) {
      return { start: m.index!, end: m.index! + m[0].length, text: m[0] }
    }
  }
  return null
}

/** 头注释 → { ulid, block }；无标记或块行非法 → null */
export function parseDemoHeader(source: string): DemoHeader | null {
  const b = demoCommentBlock(source)
  if (b === null) return null
  const ulid = b.text.match(new RegExp(`题卡：(${ULID_SRC})`))
  const block = b.text.match(/块：([^\s*]+)/)
  if (ulid === null || block === null) return null
  if (!BLOCK_RE.test(block[1]!)) return null
  return { ulid: ulid[1]!, block: block[1]! }
}

/** 剥掉含「题卡：」标记的注释块（头 Javadoc 里有全部要点口径，展示层不得出现） */
export function stripDemoHeader(
  source: string,
): { ok: true; code: string } | { ok: false; reason: string } {
  const b = demoCommentBlock(source)
  if (b === null) return { ok: false, reason: '未找到带「题卡：」标记的注释块（快照异常）' }
  const before = source.slice(0, b.start).replace(/[ \t]*\n+$/, '')
  const after = source.slice(b.end).replace(/^\n+/, '')
  return { ok: true, code: `${before}\n\n${after}` }
}

export type DemoSnapshotFact = {
  /** 相对 content/ 的 posix 路径，如 'java/generics/01M....java' */
  file: string
  /** 头注释「题卡：」ULID；缺失为 '' */
  headerUlid: string
  /** 头注释「块：」标记；缺失为 '' */
  headerBlock: string
}

/** 示例代码仓（spec §8：GitHub 公开托管，外链指向 blob/main） */
export const DEMO_REPO_URL = 'https://github.com/javaside/interview-code'

/** 源相对路径 → GitHub 文件页 URL */
export function demoSourceUrl(relPath: string): string {
  return `${DEMO_REPO_URL}/blob/main/${relPath}`
}

/**
 * audit 闸门（spec §6）：三条规则 + manifest 对账（第四条），返回中文错误信息（空数组 = 通过）。
 * knownCardPaths = 全库卡的 `<blockId>/<cardId>` 路径集合——孤儿判定按**同目录**
 * 同名 .md 查（spec 原文），全库存在 ULID 不算数：块标记写错/题卡挪块的漂移必须在这抓住。
 * manifestKeys = content/demo-manifest.json 的键集（文件缺失传 undefined）——
 * 有快照必查 manifest 一一对应；两者皆空（无 demo 的仓库状态）静默通过。
 */
export function auditDemoSnapshots(
  facts: DemoSnapshotFact[], knownCardPaths: ReadonlySet<string>,
  manifestKeys: ReadonlySet<string> | undefined,
): string[] {
  const issues: string[] = []
  for (const f of facts) {
    const stem = f.file.split('/').pop()!.replace(/\.java$/, '')
    if (f.headerUlid !== stem) {
      issues.push(`demo 快照 ${f.file}：头注释 ULID 与文件名不一致（${f.headerUlid || '(缺失)'} ≠ ${stem}）`)
      continue   // 后两条以 headerUlid 为准，先失即无从判
    }
    const dir = f.file.split('/').slice(0, -1).join('/')
    if (!knownCardPaths.has(`${dir}/${f.headerUlid}`)) {
      issues.push(`demo 快照 ${f.file}：孤儿——同目录没有同名片 ${dir}/${f.headerUlid}.md（题卡被删/改名/挪块？重跑 demo:sync 前先核对）`)
    }
    if (f.headerBlock !== dir) {
      issues.push(`demo 快照 ${f.file}：头块标记 ${f.headerBlock || '(缺失)'} 与目录 ${dir} 不一致`)
    }
  }
  // 规则 4：manifest 对账（GitHub 外链的数据源，spec §8）
  const snapshotUlids = new Set(facts.map(f => f.headerUlid).filter(u => u !== ''))
  if (facts.length > 0 && manifestKeys === undefined) {
    issues.push(`demo 快照 ${facts.length} 个但 content/demo-manifest.json 缺失——重跑 pnpm demo:sync`)
  } else if (manifestKeys !== undefined) {
    const extra = [...manifestKeys].filter(k => !snapshotUlids.has(k))
    const missing = [...snapshotUlids].filter(u => !manifestKeys.has(u))
    if (extra.length > 0 || missing.length > 0) {
      issues.push(`demo manifest 与快照不一致：多余键 ${extra.slice(0, 3).join('、') || '无'}；缺失键 ${missing.slice(0, 3).join('、') || '无'}——重跑 pnpm demo:sync`)
    }
  }
  return issues
}
