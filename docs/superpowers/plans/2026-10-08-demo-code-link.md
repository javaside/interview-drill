# 题卡 ↔ 示例代码关联 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 interview-code 的 50 个 Java Demo 类快照进 `content/`，在 App 内（刷题复盘 + 学习页）内嵌展示，公开题页只放「在 App 内查看」提示。

**Architecture:** 同步脚本（`pnpm demo:sync`）按头 Javadoc 的 ULID 把源仓 `.java` 逐字节快照为 `content/<块Id>/<ULID>.java`；server 层 loader（fs + memo + 剥头注释）供三处页面消费；代码不进 DB、不需要迁移、不重跑 content:upsert。

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict + vitest（node/jsdom 双 project）+ tsx（CLI）。

**Spec:** `docs/superpowers/specs/2026-10-08-demo-code-link-design.md`（本计划从 spec 出发，执行者应同时读 spec）

## Global Constraints

- 依赖铁律：SQL 与 fs 只在 `src/server/`，`src/lib/` 零 IO；`src/app/` 是薄壳。
- server/lib 内相对导入带 `.js` 后缀（ESM 风格，next.config.ts extensionAlias 映射）。
- **代码永不上公开题页** `/q/[cardId]`：该页只放提示行（spec §1，用户拍板——Demo 代码体复述非 public 要点）。
- 剥头注释规则：剥「包含 `题卡：` 标记的那个 `/** ... */` 块」，未匹配 loud 失败（spec §4）。
- ULID 校验正则：`/^[0-9A-HJKMNP-TV-Z]{26}$/`（Crockford base32，无 I L O U）。
- 验收：每个 Task 以 `pnpm typecheck && pnpm test` 相关子集全绿 + commit 收尾；最终全量见 Task 9。
- Conventional commits 中文描述；不主动 push。
- 测试落点：lib 纯函数 → `tests/lib/content/*.test.ts`、tools 纯逻辑 → `tests/tools/*.test.ts`、server → `tests/server/*.test.ts`（以上 node project，`tests/**/*.test.ts`）；组件 → `tests/app/*.test.tsx`（jsdom project）。放错 project 不会被跑到。

---

### Task 1: lib 纯函数域（parseDemoHeader / stripDemoHeader / auditDemoSnapshots）

**Files:**
- Create: `src/lib/content/demo-code.ts`
- Test: `tests/lib/content/demo-code.test.ts`

**Interfaces:**
- Consumes: 无（零依赖纯函数）。
- Produces（后续 Task 2/3/8 依赖，签名逐字一致）:
  - `parseDemoHeader(source: string): { ulid: string; block: string } | null`
  - `stripDemoHeader(source: string): { ok: true; code: string } | { ok: false; reason: string }`
  - `type DemoSnapshotFact = { file: string; headerUlid: string; headerBlock: string }`
  - `auditDemoSnapshots(facts: DemoSnapshotFact[], knownCardIds: ReadonlySet<string>): string[]`

- [ ] **Step 1: 写失败测试**

`tests/lib/content/demo-code.test.ts`：

```ts
import {
  parseDemoHeader, stripDemoHeader, auditDemoSnapshots,
} from '../../src/lib/content/demo-code.js'

const DEMO = `package com.interview.java.generics;

import java.util.List;

/**
 * 题目：什么是桥方法？
 * 题卡：01M3M39N0Z840CFBC8RWQ0R8FV
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - 擦除让父/子方法签名对不上
 */
public class BridgeMethodDemo {
    /** 方法注释：不是头，不能被剥 */
    void run() { }
}
`

test('parseDemoHeader：提取 ULID 与块', () => {
  expect(parseDemoHeader(DEMO)).toEqual({
    ulid: '01M3M39N0Z840CFBC8RWQ0R8FV', block: 'java/generics',
  })
})

test('parseDemoHeader：无题卡标记返回 null（非题卡辅助类）', () => {
  expect(parseDemoHeader('/** 普通注释 */\nclass A {}')).toBeNull()
})

test('parseDemoHeader：license 头在前，仍取含题卡标记的块', () => {
  const src = `/*\n * MIT License\n */\n${DEMO}`
  expect(parseDemoHeader(src)?.ulid).toBe('01M3M39N0Z840CFBC8RWQ0R8FV')
})

test('stripDemoHeader：剥含题卡标记的块，保留方法注释，拼接处空行归一', () => {
  const r = stripDemoHeader(DEMO)
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.code).not.toContain('题卡：')
    expect(r.code).not.toContain('要点口径')
    expect(r.code).toContain('package com.interview.java.generics;')
    expect(r.code).toContain('public class BridgeMethodDemo {')
    expect(r.code).toContain('方法注释：不是头，不能被剥')
    expect(r.code.startsWith('package com.interview.java.generics;\n\npublic class')).toBe(true)
  }
})

test('stripDemoHeader：无题卡标记 → loud 失败', () => {
  const r = stripDemoHeader('/** 普通注释 */\nclass A {}')
  expect(r.ok).toBe(false)
})

test('auditDemoSnapshots：三条规则（ULID≠文件名 / 孤儿 / 块标记≠目录）', () => {
  const ids = new Set(['01M3M39N0Z840CFBC8RWQ0R8FV'])
  const facts = [
    // 正常：全过
    { file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FV.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
    // 头 ULID 与文件名不一致
    { file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FX.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
    // 孤儿：头 ULID 没有同名片
    { file: 'java/string/01M3M39N0X12RYG621PWMWKSR4.java', headerUlid: '01M3M39N0X12RYG621PWMWKSR4', headerBlock: 'java/string' },
    // 块标记与目录不一致
    { file: 'java/hashmap/01M3M39N0Z840CFBC8RWQ0R8FV.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
  ]
  const issues = auditDemoSnapshots(facts, ids)
  expect(issues).toHaveLength(3)
  expect(issues.some(s => s.includes('ULID 与文件名不一致'))).toBe(true)
  expect(issues.some(s => s.includes('孤儿'))).toBe(true)
  expect(issues.some(s => s.includes('块标记') && s.includes('不一致'))).toBe(true)
})

test('auditDemoSnapshots：空入参零问题', () => {
  expect(auditDemoSnapshots([], new Set())).toEqual([])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/lib/content/demo-code.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/lib/content/demo-code.ts`**

```ts
/**
 * Demo 快照域纯函数（零 IO）：头 Javadoc 解析、剥头、audit 判定。
 * 快照约定见 docs/superpowers/specs/2026-10-08-demo-code-link-design.md §3——
 * 头注释三行「题目/题卡/块」是 interview-code 的既定 Javadoc 约定。
 *
 * 「题卡标记」指注释块内含 `题卡：<26 位 ULID>` 行；剥头规则剥的是
 * **含该标记的那个块**（不是第一个块——将来加 license 头也不会剥错对象）。
 */

/** Crockford base32 ULID（无 I L O U） */
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/
const BLOCK_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/

export type DemoHeader = { ulid: string; block: string }

/** 找到含「题卡：」标记的 /** ... */ 块；没有则 null（非题卡文件） */
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
  const ulid = b.text.match(new RegExp(`题卡：(${ULID_RE.source})`))
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

/** audit 闸门（spec §6）：三条规则，返回中文错误信息（空数组 = 通过） */
export function auditDemoSnapshots(facts: DemoSnapshotFact[], knownCardIds: ReadonlySet<string>): string[] {
  const issues: string[] = []
  for (const f of facts) {
    const stem = f.file.split('/').pop()!.replace(/\.java$/, '')
    if (f.headerUlid !== stem) {
      issues.push(`demo 快照 ${f.file}：头注释 ULID 与文件名不一致（${f.headerUlid || '(缺失)'} ≠ ${stem}）`)
      continue   // 后两条以 headerUlid 为准，先失即无从判
    }
    if (!knownCardIds.has(f.headerUlid)) {
      issues.push(`demo 快照 ${f.file}：孤儿——没有同名片 ${f.headerUlid}.md（题卡被删/改名？重跑 demo:sync 前先核对）`)
    }
    const dir = f.file.split('/').slice(0, -1).join('/')
    if (f.headerBlock !== dir) {
      issues.push(`demo 快照 ${f.file}：头块标记 ${f.headerBlock || '(缺失)'} 与目录 ${dir} 不一致`)
    }
  }
  return issues
}
```

注意：上面 `demoCommentBlock` 的正则 `//\*[\s\S]*?\*\//g` 在源码里写作 `/\/\*[\s\S]*?\*\//g`（转义斜杠）——`/**` 开头也匹配 `/*`，覆盖 license 块；只要块内含 `题卡：` 即命中。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/lib/content/demo-code.test.ts`
Expected: PASS（7 条全绿）

- [ ] **Step 5: typecheck + commit**

```bash
pnpm typecheck
git add src/lib/content/demo-code.ts tests/lib/content/demo-code.test.ts
git commit -m "feat(demo): Demo 快照 lib 纯函数——头解析/剥头/audit 三规则"
```

---

### Task 2: 同步脚本 `pnpm demo:sync`（computeSyncPlan 纯函数 + CLI 壳）

**Files:**
- Create: `tools/demo-sync/plan.ts`
- Create: `tools/demo-sync/index.ts`
- Modify: `package.json`（scripts）
- Test: `tests/tools/demo-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `parseDemoHeader`。
- Produces:
  - `type DemoSource = { ulid: string; block: string; source: string }`
  - `type ExistingSnapshot = { file: string; source: string }`（`file` 为相对 `content/` 的 posix 路径）
  - `type SyncPlan = { write: Array<{ file: string; source: string }>; skip: string[]; remove: string[] }`
  - `computeSyncPlan(sources: DemoSource[], existing: ExistingSnapshot[]): SyncPlan`
  - CLI：`pnpm demo:sync [--allow-empty]`，env `DEMO_REPO`（默认 `../interview-code`）

- [ ] **Step 1: 写失败测试**

`tests/tools/demo-sync.test.ts`：

```ts
import { computeSyncPlan } from '../../tools/demo-sync/plan.js'

const S = (ulid: string, block: string, source = `// ${ulid}`) => ({ ulid, block, source })
const E = (file: string, source = '') => ({ file, source })

test('全新快照：全部写入', () => {
  const plan = computeSyncPlan([S('A', 'java/string')], [])
  expect(plan.write).toEqual([{ file: 'java/string/A.java', source: '// A' }])
  expect(plan.remove).toEqual([])
})

test('内容一致：跳过；内容变化：重写', () => {
  const existing = [E('java/string/A.java', '// A'), E('java/string/B.java', '旧内容')]
  const plan = computeSyncPlan(
    [S('A', 'java/string'), S('B', 'java/string', '新内容')], existing)
  expect(plan.skip).toEqual(['java/string/A.java'])
  expect(plan.write).toEqual([{ file: 'java/string/B.java', source: '新内容' }])
})

test('源仓删除 → 孤儿清理；手挪错位 → 归位（旧路径删 + 新路径写）', () => {
  const existing = [
    E('java/string/GONE.java'),                       // 源仓已删 → remove
    E('java/wrongplace/A.java', '// A'),              // 手挪错位 → 旧路径 remove + 目标路径 write
  ]
  const plan = computeSyncPlan([S('A', 'java/string')], existing)
  expect(plan.remove.sort()).toEqual(['java/string/GONE.java', 'java/wrongplace/A.java'])
  expect(plan.write).toEqual([{ file: 'java/string/A.java', source: '// A' }])
})

test('空源 + 已有快照：remove 全部（由 CLI 闸门在真实环境拦截，纯函数如实反映）', () => {
  const plan = computeSyncPlan([], [E('java/string/A.java')])
  expect(plan.remove).toEqual(['java/string/A.java'])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/tools/demo-sync.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `tools/demo-sync/plan.ts`**

```ts
/**
 * demo:sync 的同步计划纯函数（零 IO；CLI 壳在 index.ts）。
 * 语义：sync 后 content/ 下的 .java 与源仓带题卡标记的文件严格一一对应——
 * 目标路径 = content/<块Id>/<ULID>.java，不在目标路径集合里的现存快照一律删除
 * （含源仓已删的孤儿与手挪错位的旧副本）。
 */

export type DemoSource = { ulid: string; block: string; source: string }
export type ExistingSnapshot = { file: string; source: string }
export type SyncPlan = {
  write: Array<{ file: string; source: string }>
  skip: string[]
  remove: string[]
}

export function computeSyncPlan(sources: DemoSource[], existing: ExistingSnapshot[]): SyncPlan {
  const targetOf = new Map(sources.map(s => [`${s.block}/${s.ulid}.java`, s.source] as const))
  const existingByFile = new Map(existing.map(e => [e.file, e.source] as const))

  const write: Array<{ file: string; source: string }> = []
  const skip: string[] = []
  for (const [file, source] of targetOf) {
    if (existingByFile.get(file) === source) skip.push(file)
    else write.push({ file, source })
  }
  const remove = existing.map(e => e.file).filter(f => !targetOf.has(f))
  return { write, skip, remove }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/tools/demo-sync.test.ts`
Expected: PASS（4 条全绿）

- [ ] **Step 5: 实现 CLI 壳 `tools/demo-sync/index.ts`**

```ts
/**
 * pnpm demo:sync —— 把 interview-code 的 Demo 类快照进 content/（spec §3）。
 * 三道闸门防静默事故：源仓不存在 / 0 个带标记文件（除非 --allow-empty）/ 只删带题卡标记的 .java。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseDemoHeader } from '../../src/lib/content/demo-code.js'
import { computeSyncPlan, type DemoSource, type ExistingSnapshot } from './plan.js'

const CONTENT_DIR = 'content'
const DEMO_REPO = process.env.DEMO_REPO ?? '../interview-code'
const allowEmpty = process.argv.includes('--allow-empty')

function walk(dir: string, matches: (name: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const rel = relative('.', p)
    if (statSync(p).isDirectory()) {
      if (rel.split(/[\\/]/).includes('target')) continue   // Maven 编译产物
      walk(p, matches, out)
    } else if (matches(name)) out.push(p)
  }
  return out
}

// 闸门 1：源仓不存在 → loud 退出（CI/服务器上没有兄弟仓，绝不能当「全空」处理）
if (!existsSync(DEMO_REPO)) {
  console.error(`源仓不存在：${DEMO_REPO}（可用 env DEMO_REPO 覆盖）`)
  process.exit(1)
}

const sources: DemoSource[] = []
const unrecognized: string[] = []
const seen = new Map<string, string>()
for (const f of walk(DEMO_REPO, n => n.endsWith('.java'))) {
  const h = parseDemoHeader(readFileSync(f, 'utf8'))
  if (h === null) { unrecognized.push(f); continue }
  const dup = seen.get(h.ulid)
  if (dup !== undefined) {
    console.error(`同一 ULID 出现两次：${h.ulid}\n  ${dup}\n  ${f}`)
    process.exit(1)
  }
  seen.set(h.ulid, f)
  sources.push({ ulid: h.ulid, block: h.block, source: readFileSync(f, 'utf8') })
}

// 闸门 2：0 个带标记文件 → 默认拒绝（防把全部现存快照判成孤儿删光）
if (sources.length === 0 && !allowEmpty) {
  console.error('源仓没有解析到任何带「题卡：」标记的 .java——拒绝清空快照（确需清空用 --allow-empty）')
  process.exit(1)
}

// 现存快照（闸门 3 的体现：孤儿判定只针对这里 walk 到的 .java）
const existing: ExistingSnapshot[] = walk(CONTENT_DIR, n => n.endsWith('.java'))
  .map(f => ({ file: relative(CONTENT_DIR, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }))

const plan = computeSyncPlan(sources, existing)

for (const w of plan.write) {
  const abs = join(CONTENT_DIR, w.file)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, w.source)
}
for (const r of plan.remove) unlinkSync(join(CONTENT_DIR, r))

console.log(`demo:sync 完成——写入 ${plan.write.length}，跳过 ${plan.skip.length}，删除 ${plan.remove.length}，未识别 ${unrecognized.length}`)
for (const u of unrecognized) console.log(`  未识别（无题卡标记，跳过）：${u}`)
for (const r of plan.remove) console.log(`  删除：${r}`)
```

（`mkdirSync(join(abs, '..'))` 若执行器认为不清晰，等价写法：`mkdirSync(dirname(abs), { recursive: true })` 配 `import { dirname } from 'node:path'`。）

- [ ] **Step 6: package.json 加脚本 + tmp 假仓冒烟**

`package.json` scripts 里（紧跟 `content:new` 一行之后）加：

```json
"demo:sync": "tsx --env-file-if-exists=.env.local tools/demo-sync/index.ts",
```

冒烟（不碰真仓、不碰 content/）：

```bash
mkdir -p /tmp/fake-demo-repo/src
cat > /tmp/fake-demo-repo/src/D.java <<'EOF'
package com.interview.java.string;

/**
 * 题目：冒烟
 * 题卡：01M3M39N0X12RYG621PWMWKSR4
 * 块：java/string
 */
public class D {}
EOF
DEMO_REPO=/tmp/fake-demo-repo pnpm demo:sync
git status --short content/
```

Expected: 输出「写入 1 …」；`git status` 显示 `content/java/string/01M3M39N0X12RYG621PWMWKSR4.java` 新文件。**立即回滚冒烟产物**：`git clean -f content/java/string/01M3M39N0X12RYG621PWMWKSR4.java && rm -rf /tmp/fake-demo-repo`。真仓同步在 Task 9（audit 闸门就位之后）。

- [ ] **Step 7: typecheck + 全量测试 + commit**

```bash
pnpm typecheck && pnpm test
git add tools/demo-sync package.json tests/tools/demo-sync.test.ts
git commit -m "feat(demo): pnpm demo:sync 同步脚本——三道闸门防静默删光，纯函数计划可单测"
```

---

### Task 3: server 层 loader（fs + memo + loud 缺失）

**Files:**
- Create: `src/server/demo-code.ts`
- Test: `tests/server/demo-code.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `stripDemoHeader`。
- Produces（Task 5/6/7 依赖）:
  - `loadDemoCode(blockId: string, cardId: string, baseDir?: string): string | null`——同步；剥头后的源码；单卡无 demo → null；`content/` 整体缺失 → throw（loud）

- [ ] **Step 1: 写失败测试**

`tests/server/demo-code.test.ts`：

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDemoCode } from '../../src/server/demo-code.js'

const ULID = '01M3M39N0Z840CFBC8RWQ0R8FV'
const JAVA = `package x;

/**
 * 题目：t
 * 题卡：${ULID}
 * 块：java/generics
 */
public class D { void m() {} }
`

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'demo-code-'))
  mkdirSync(join(dir, 'java/generics'), { recursive: true })
  writeFileSync(join(dir, `java/generics/${ULID}.java`), JAVA)
  return dir
}

test('读到快照 → 剥头后返回；同参二次调用走 memo（返回一致）', () => {
  const base = makeRepo()
  try {
    const code = loadDemoCode('java/generics', ULID, base)
    expect(code).not.toBeNull()
    expect(code).toContain('public class D')
    expect(code).not.toContain('题卡：')
    expect(loadDemoCode('java/generics', ULID, base)).toBe(code)
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('单卡无 demo → null（正常态，不是错误）', () => {
  const base = makeRepo()
  try {
    expect(loadDemoCode('java/generics', '01M3M39N0ZZZZZZZZZZZZZZZZZZ', base)).toBeNull()
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('剥头失败（快照无标记）→ throw（loud）', () => {
  const base = mkdtempSync(join(tmpdir(), 'demo-code-'))
  try {
    mkdirSync(join(base, 'java/generics'), { recursive: true })
    writeFileSync(join(base, 'java/generics/01M3M39N0Z840CFBC8RWQ0R9.java'), 'class NoHeader {}\n')
    expect(() => loadDemoCode('java/generics', '01M3M39N0Z840CFBC8RWQ0R9', base)).toThrow('题卡')
  } finally { rmSync(base, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/server/demo-code.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/server/demo-code.ts`**

```ts
/**
 * Demo 快照 loader（fs 留在 server 层，与 SQL 同级不下沉 lib；spec §4）。
 * 同步签名 + 模块级 memo：content/ 是只读快照，进程内缓存即可——顺带避免
 * settings 保存路径里 buildDailyPayload 的即弃调用白做 N 次读盘。
 * 两种失败刻意不同：content/ 整体缺失 = 部署事故，throw（防「功能整体不可见
 * 还零报错」的静默漂移）；单卡无快照 = 正常态，null。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { stripDemoHeader } from '../lib/content/demo-code.js'

const memo = new Map<string, string | null>()
let contentDirChecked = false

export function loadDemoCode(
  blockId: string, cardId: string, baseDir = 'content',
): string | null {
  const key = `${baseDir}::${blockId}::${cardId}`
  if (memo.has(key)) return memo.get(key)!
  if (baseDir === 'content' && !contentDirChecked) {
    if (!existsSync('content')) {
      throw new Error('content/ 目录缺失——示例代码快照不可用，检查部署（cwd 与 rsync 排除项）')
    }
    contentDirChecked = true
  }
  let result: string | null = null
  const file = join(baseDir, blockId, `${cardId}.java`)
  if (existsSync(file)) {
    const raw = readFileSync(file, 'utf8')
    const stripped = stripDemoHeader(raw)
    if (!stripped.ok) throw new Error(`demo 快照异常 ${file}：${stripped.reason}`)
    result = stripped.code
  }
  memo.set(key, result)
  return result
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/server/demo-code.test.ts`
Expected: PASS（3 条全绿）

- [ ] **Step 5: typecheck + commit**

```bash
pnpm typecheck
git add src/server/demo-code.ts tests/server/demo-code.test.ts
git commit -m "feat(demo): server 层快照 loader——memo + content 缺失 loud，单卡缺 demo 为 null"
```

---

### Task 4: DemoCodeBlock 组件（复用 Java 高亮）

**Files:**
- Create: `src/app/DemoCodeBlock.tsx`
- Modify: `src/app/RichText.tsx:10`（`const TOKEN_CLASS` → `export const TOKEN_CLASS`，仅加 export）
- Test: `tests/app/demo-code-block.test.tsx`

**Interfaces:**
- Consumes: `tokenize`（`src/lib/content/highlight.ts`，已存在）；`TOKEN_CLASS`（本 Task 从 RichText export）。
- Produces: `DemoCodeBlock({ code }: { code: string }): React.JSX.Element`（无 'use client'，server/client 双侧可 import——Task 5/6 消费）

- [ ] **Step 1: 写失败测试**

`tests/app/demo-code-block.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { DemoCodeBlock } from '../../src/app/DemoCodeBlock.js'

const CODE = 'public class D {\n    public static void main(String[] args) { }\n}\n'

test('折叠展示：summary 固定文案，代码进 pre（jsdom 中 details 内容仍在 DOM）', () => {
  const { container } = render(<DemoCodeBlock code={CODE} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  const pre = container.querySelector('pre')
  expect(pre).not.toBeNull()
  expect(pre!.textContent).toContain('public static void main')
})

test('高亮：关键字上 span.keyword 色（tokenize java）', () => {
  const { container } = render(<DemoCodeBlock code={CODE} />)
  const kw = container.querySelector('pre span.text-accent')
  expect(kw?.textContent).toContain('public')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/app/demo-code-block.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/app/DemoCodeBlock.tsx`**

```tsx
import { tokenize } from '../lib/content/highlight.js'
import { TOKEN_CLASS } from './RichText.js'

/**
 * 可运行示例代码块（spec §5）：折叠 details + 复用 RichText 的 Java 着色
 * （单色阶荧光笔——与正文代码块同一呈现，不引新依赖）。
 * code 必须是**已剥头**的源码（头 Javadoc 含全部要点口径，见 spec §1 泄露面）。
 */
export function DemoCodeBlock({ code }: { code: string }): React.JSX.Element {
  const tokens = tokenize(code, 'java')
  return (
    <details className="rounded-xl border border-paper-line bg-paper-deep">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-paper-muted transition-colors hover:text-paper-ink">
        可运行示例（Java）
      </summary>
      <div className="border-t border-paper-line/60">
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-paper-ink">
          <code>
            {tokens.map((t, j) => (
              <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>
            ))}
          </code>
        </pre>
      </div>
    </details>
  )
}
```

同时改 `src/app/RichText.tsx` 第 10 行：`const TOKEN_CLASS: Record<TokenKind, string> = {` → `export const TOKEN_CLASS: Record<TokenKind, string> = {`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/app/demo-code-block.test.tsx tests/app/rich-text.test.tsx`
Expected: PASS（新 2 条 + RichText 既有测试不回归）

- [ ] **Step 5: typecheck + commit**

```bash
pnpm typecheck
git add src/app/DemoCodeBlock.tsx src/app/RichText.tsx tests/app/demo-code-block.test.tsx
git commit -m "feat(demo): DemoCodeBlock——折叠+复用 RichText Java 着色，TOKEN_CLASS 导出"
```

---

### Task 5: 刷题复盘链路（deps 契约 + CardView + DrillFeedback）

**Files:**
- Modify: `src/server/queue.ts:81-92`（CardView）、`queue.ts:97-116`（DailyPayloadDeps）、`queue.ts:180-193` 与 `queue.ts:251-264`（两处 cardViews map）
- Modify: `src/server/deps.ts:18-44`（payloadDepsOf 接线）
- Modify: `src/app/(drill)/DrillFeedback.tsx`（header 末尾渲染）
- Test: `tests/server/queue.test.ts`（扩展）、`tests/app/drill-feedback.test.tsx`（扩展）

**Interfaces:**
- Consumes: Task 3 的 `loadDemoCode`；Task 4 的 `DemoCodeBlock`。
- Produces: `CardView.demoCode?: string`（剥头源码，无 demo 缺省）；`DailyPayloadDeps.loadDemoCode(blockId: string, cardId: string): string | null`（同步）

- [ ] **Step 1: 写失败测试（集成侧）**

`tests/server/queue.test.ts` 的 `mkDeps`（59-82 行）加一行（typecheck 立即红，正好证明契约生效）：

```ts
    loadDemoCode: () => null,
```

然后在文件末尾（131 行后）追加用例：

```ts
test('demoCode 注入：deps.loadDemoCode 命中的卡携带剥头源码，其余缺省（spec §5）', async () => {
  const t = await seedQueueFixture()
  try {
    const d = mkDeps(t, 'u-free')
    d.loadDemoCode = (blockId, cardId) => (cardId === 'b1-c0' ? 'public class Demo {}' : null)
    const p = await buildDailyPayload(d)
    const withDemo = p.cards.find(c => c.demoCode !== undefined)
    const without = p.cards.find(c => c.cardId !== 'b1-c0')
    expect(withDemo?.cardId).toBe('b1-c0')
    expect(withDemo?.demoCode).toBe('public class Demo {}')
    expect(without?.demoCode).toBeUndefined()
  } finally {
    await t.pg.close()
  }
})
```

（若今日队列因排期恰好不含 `b1-c0`，改断言为：`p.cards` 中 `demoCode !== undefined` 的卡恰为队列里的 `b1-c0` 期望不存在时——直接放宽：断言「所有 demoCode !== undefined 的卡，其 cardId 必为 `b1-c0`」且 `p.cards.some(c => c.cardId === 'b1-c0')` 为真（夹具 daily_capacity=45、两块各 5 卡 fresh，首轮全进队列，`b1-c0` 必在）。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/server/queue.test.ts`
Expected: FAIL——`mkDeps` 缺 `loadDemoCode`（typecheck 层面）或新用例 `withDemo` 为 undefined

- [ ] **Step 3: 实现注入**

`src/server/queue.ts` 三处修改：

① `CardView`（92 行 `detail: string` 之后）加：

```ts
  /** 剥头后的可运行示例源码（interview-code 快照）；无 demo 的卡缺省该字段（spec §5） */
  demoCode?: string
```

② `DailyPayloadDeps`（115 行 `serverNowMs: number` 之前）加：

```ts
  /** 示例代码快照读取（同步 + server 侧 memo；集成测试注入 fake） */
  loadDemoCode(blockId: string, cardId: string): string | null
```

③ 两处 cardViews map（`buildDailyPayload` 180 行、`practiceQueue` 251 行），各自 return 对象的 `detail: ...` 行之后加同一行：

```ts
      ...(deps.loadDemoCode(c.blockId, c.cardId) === null ? {} : { demoCode: deps.loadDemoCode(c.blockId, c.cardId)! }),
```

（`practiceQueue` 里变量名是 `card`，对应写 `deps.loadDemoCode(card.blockId, c.id)`。为避免双调，可先取局部变量：`const demo = deps.loadDemoCode(...)` 再展开——执行者按上下文选清晰写法，语义不变。）

`src/server/deps.ts` 顶部 import 加 `import { loadDemoCode } from './demo-code.js'`，`payloadDepsOf` 返回对象（43 行 `}` 前）加：

```ts
    loadDemoCode,
```

- [ ] **Step 4: 跑集成测试确认通过**

Run: `pnpm vitest run tests/server/queue.test.ts tests/server/settings-blocks.test.ts tests/server/cram.test.ts`
Expected: PASS（新用例绿；其余消费 payloadDepsOf 的套件不回归——它们走真实 `loadDemoCode`，对 `b1-c0` 这类假 ULID 返回 null，行为不变）

- [ ] **Step 5: 写失败测试（组件侧）**

`tests/app/drill-feedback.test.tsx` 追加（该文件现有夹具构造 card/variant/submission/result 的写法照抄现有用例，只给增量）：

```tsx
test('demoCode 存在 → 讲解区下方渲染可运行示例折叠块', () => {
  const { card, variant, submission, result } = mkFeedbackFixture()   // 现有夹具函数名以文件内实际为准
  render(<DrillFeedback
    card={{ ...card, demoCode: 'public class IntegerCacheDemo { }' }}
    variant={variant} submission={submission} result={result} offline={false} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  expect(document.querySelector('pre')?.textContent).toContain('IntegerCacheDemo')
})

test('无 demoCode → 不渲染示例块', () => {
  const { card, variant, submission, result } = mkFeedbackFixture()
  const { container } = render(<DrillFeedback
    card={card} variant={variant} submission={submission} result={result} offline={false} />)
  expect(container.querySelector('details')).toBeNull()   // 「进阶」折叠是 RichText 内嵌、此处 card.detail 无进阶段时成立；若夹具 detail 含进阶，改断言 queryByText('可运行示例（Java）') 为 null
})
```

- [ ] **Step 6: 实现组件渲染**

`src/app/(drill)/DrillFeedback.tsx`：顶部 import 加 `import { DemoCodeBlock } from '../DemoCodeBlock.js'`；在 header 收尾（109-127 行得分与统计块之后、`</header>` 之前）加：

```tsx
      {card.demoCode !== undefined && (
        <div className="mt-6">
          <DemoCodeBlock code={card.demoCode} />
        </div>
      )}
```

- [ ] **Step 7: 跑组件测试确认通过**

Run: `pnpm vitest run tests/app/drill-feedback.test.tsx`
Expected: PASS

- [ ] **Step 8: typecheck + 全量测试 + commit**

```bash
pnpm typecheck && pnpm test
git add src/server/queue.ts src/server/deps.ts "src/app/(drill)/DrillFeedback.tsx" tests/server/queue.test.ts tests/app/drill-feedback.test.tsx
git commit -m "feat(demo): 复盘页内嵌可运行示例——deps 注入契约，CardView 携带剥头源码可离线看"
```

---

### Task 6: 学习页接入

**Files:**
- Modify: `src/app/learn/page.tsx`（组装 LearnCard 时注入）
- Modify: `src/app/learn/LearnView.tsx:11-16`（LearnCard 类型）、article 渲染处
- Test: `tests/app/learn.test.tsx`（扩展）

**Interfaces:**
- Consumes: Task 3 的 `loadDemoCode`（`import { loadDemoCode } from '../../server/demo-code.js'`）；Task 4 的 `DemoCodeBlock`。
- Produces: `LearnCard.demoCode?: string`

- [ ] **Step 1: 写失败测试**

`tests/app/learn.test.tsx` 追加（LearnView 是纯展示组件，直接渲染）：

```tsx
test('卡片带 demoCode → 正文后渲染可运行示例', () => {
  render(<LearnView blockName="泛型" blockId="java/generics" cards={[{
    cardId: 'c1', question: 'Q1', frequency: 'high', detail: '讲解',
    demoCode: 'public class BridgeMethodDemo { }',
  }]} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  expect(document.querySelector('pre')?.textContent).toContain('BridgeMethodDemo')
})

test('卡片无 demoCode → 不渲染示例块', () => {
  render(<LearnView blockName="泛型" blockId="java/generics" cards={[{
    cardId: 'c1', question: 'Q1', frequency: 'high', detail: '讲解',
  }]} />)
  expect(screen.queryByText('可运行示例（Java）')).not.toBeInTheDocument()
})
```

（import 与现有文件一致：`LearnView` 从 `../../src/app/learn/LearnView.js`；若文件已 import 则复用。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/app/learn.test.tsx`
Expected: FAIL（demoCode 被忽略，不渲染示例块）

- [ ] **Step 3: 实现**

`src/app/learn/LearnView.tsx`：

① `LearnCard` 类型（16 行 `detail: string` 后）加：

```ts
  /** 剥头后的可运行示例源码（page 侧 loadDemoCode 注入）；无 demo 缺省 */
  demoCode?: string
```

② import 加 `import { DemoCodeBlock } from '../DemoCodeBlock.js'`；article 内 `<DetailLayers detail={c.detail} indent={false} />`（114 行）之后、`<CardQA ...>` 之前加：

```tsx
                {c.demoCode !== undefined && (
                  <div className="mt-3">
                    <DemoCodeBlock code={c.demoCode} />
                  </div>
                )}
```

`src/app/learn/page.tsx`：import 加 `import { loadDemoCode } from '../../server/demo-code.js'`；`inBlock` 的 map（约 60-66 行）改为：

```ts
  const inBlock = cards
    .filter(c => ids.has(c.cardId))
    .map((c): LearnCard => {
      const demo = loadDemoCode(c.blockId, c.cardId)
      return {
        cardId: c.cardId,
        question: c.question ?? '',
        frequency: c.frequency,
        detail: c.detail ?? '',
        ...(demo === null ? {} : { demoCode: demo }),
      }
    })
    .sort((a, b) => (a.cardId < b.cardId ? -1 : 1))
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/app/learn.test.tsx tests/app/learn-qa.test.tsx`
Expected: PASS

- [ ] **Step 5: typecheck + commit**

```bash
pnpm typecheck
git add src/app/learn/page.tsx src/app/learn/LearnView.tsx tests/app/learn.test.tsx
git commit -m "feat(demo): 学习页每卡正文后内嵌可运行示例（page 层 loader 直调）"
```

---

### Task 7: 公开题页（PublicCard.blockId + 提示行，代码绝不上此页）

**Files:**
- Modify: `src/server/db/adapters.ts:439-478`（PublicCard + loadPublicCard）
- Modify: `src/app/q/[cardId]/page.tsx`
- Modify: `src/app/q/[cardId]/PublicQuestionView.tsx`
- Test: `tests/server/public-card.test.ts`（扩展）、`tests/app/public-question.test.tsx`（扩展）

**Interfaces:**
- Consumes: Task 3 的 `loadDemoCode`。
- Produces: `PublicCard.blockId: string`；`PublicQuestionView` 新 prop `hasDemo?: boolean`

- [ ] **Step 1: 写失败测试**

`tests/server/public-card.test.ts` 追加（该文件用 PGlite 夹具建卡后调 `loadPublicCard`，现有写法照抄；若夹具函数名不同以文件内为准）：

```ts
test('loadPublicCard 返回 blockId（供 demo 存在性判定；不含任何非 public 文本）', async () => {
  const card = await loadPublicCard(db, '<夹具里的卡 id>')
  expect(card?.blockId).toBe('<夹具里的块 id，如 mysql/index>')
})
```

`tests/app/public-question.test.tsx` 追加：

```tsx
test('hasDemo：只放提示行，绝无代码（cloaking 纪律，spec §1）', () => {
  const { container } = render(
    <PublicQuestionView card={card as never} hasDemo />)
  expect(screen.getByText(/本题配有可运行示例/)).toBeInTheDocument()
  expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === '/')).toBe(true)
  // 代码永不上公开页：无 pre、无 code
  expect(container.querySelector('pre')).toBeNull()
  expect(container.querySelector('code')).toBeNull()
})

test('无 hasDemo：提示行不出现', () => {
  render(<PublicQuestionView card={card as never} />)
  expect(screen.queryByText(/本题配有可运行示例/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/server/public-card.test.ts tests/app/public-question.test.tsx`
Expected: FAIL（blockId 不存在 / hasDemo 不被识别）

- [ ] **Step 3: 实现**

`src/server/db/adapters.ts`：

① `PublicCard`（439-445 行）加字段（`cardId` 之后）：

```ts
  blockId: string
```

② `loadPublicCard` 的第一条 SQL（455-458 行）select 加列：

```ts
  const cardRes = await db.execute<{ question: string; block_id: string; block_name: string | null }>(sql`
    select c.question, c.block_id, b.name as block_name
    from cards c left join blocks b on b.id = c.block_id
    where c.id = ${cardId} and c.retired_at is null`)
```

③ 返回对象（471-477 行）加 `blockId: card.block_id,`。

`src/app/q/[cardId]/page.tsx`：import 加 `import { loadDemoCode } from '../../../../server/demo-code.js'`（路径深度以现有 import 为准——现有是 `'../../../server/db/client.js'` 三级，此处同为三级：`'../../../server/demo-code.js'`）；`Page` 组件 `notFound()` 之后改：

```ts
  const demoCode = loadDemoCode(card.blockId, cardId)
  return <PublicQuestionView card={card} hasDemo={demoCode !== null} />
```

`src/app/q/[cardId]/PublicQuestionView.tsx`：签名改 `({ card, hasDemo = false }: { card: PublicCard; hasDemo?: boolean })`；要点列表 `</ul>`（23 行）之后、`完整 N 条要点` 链接（24 行 `<p>`）之前加：

```tsx
      {hasDemo && (
        <p className="mt-6 text-sm text-paper-muted">
          本题配有可运行示例 ·{' '}
          <Link href="/" className="font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80">
            在 App 内查看
          </Link>
        </p>
      )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/server/public-card.test.ts tests/app/public-question.test.tsx`
Expected: PASS

- [ ] **Step 5: typecheck + commit**

```bash
pnpm typecheck
git add src/server/db/adapters.ts "src/app/q/[cardId]/page.tsx" "src/app/q/[cardId]/PublicQuestionView.tsx" tests/server/public-card.test.ts tests/app/public-question.test.tsx
git commit -m "feat(demo): 公开题页放「App 内查看」提示不放代码——PublicCard 补 blockId，守无 cloaking 纪律"
```

---

### Task 8: audit 闸门接入 content:audit

**Files:**
- Modify: `tools/audit-cli.ts`（现有校验循环之后、退出判定之前）

**Interfaces:**
- Consumes: Task 1 的 `parseDemoHeader`、`auditDemoSnapshots`。
- Produces: `pnpm content:audit` 对 `content/**/*.java` 执行三条规则；无 `.java` 时零输出（不强求每卡有 Demo）

- [ ] **Step 1: 实现（CLI 集成，判定已在 Task 1 测过）**

`tools/audit-cli.ts`：import 加 `import { parseDemoHeader, auditDemoSnapshots } from '../src/lib/content/demo-code.js'` 与 `import { relative } from 'node:path'`（`join` 已有则复用）。

在 cards 全部 parse 完、既有 issues 汇总之后（执行者定位：文件里现有「互斥判定闸门」等校验全部完成后、`issues.length > 0 → process.exit(1)` 之前）插入：

```ts
// demo 快照闸门（spec §6）：content/**/*.java 头标记 ↔ 文件名/题卡/目录 一致
const demoFacts = walk(CONTENT_DIR, n => n.endsWith('.java')).map(f => {
  const h = parseDemoHeader(readFileSync(f, 'utf8'))
  return {
    file: relative(CONTENT_DIR, f).split('\\').join('/'),
    headerUlid: h?.ulid ?? '',
    headerBlock: h?.block ?? '',
  }
})
const knownCardIds = new Set(cards.map(c => c.id))
issues.push(...auditDemoSnapshots(demoFacts, knownCardIds))
```

（`cards` 为该文件已 parse 的 `Card[]`；若变量名不同以文件内为准——核心是拿全库卡 id 集合。）

- [ ] **Step 2: 验证（当前 content/ 无 .java → 零新增问题）**

Run: `pnpm content:audit`
Expected: 与改动前一致（demo 闸门零输出，既有的绿保持绿）

- [ ] **Step 3: 负向自证（临时造一个孤儿快照，audit 必须抓到，然后删除）**

```bash
cat > content/java/generics/01M3M39N0ZZZZZZZZZZZZZZZZZZ.java <<'EOF'
/**
 * 题卡：01M3M39N0ZZZZZZZZZZZZZZZZZZ
 * 块：java/generics
 */
class Orphan {}
EOF
pnpm content:audit; echo "exit=$?"
rm content/java/generics/01M3M39N0ZZZZZZZZZZZZZZZZZZ.java
```

Expected: audit 输出含「孤儿——没有同名片」且 `exit=1`；删除后复跑 `pnpm content:audit` 恢复绿。

- [ ] **Step 4: typecheck + commit**

```bash
pnpm typecheck
git add tools/audit-cli.ts
git commit -m "feat(demo): content:audit 加 demo 快照三规则闸门——孤儿/头不符/块错位"
```

---

### Task 9: 真实同步 + 全量验收

**Files:**
- Create: `content/java/**/<ULID>.java` × 50（`pnpm demo:sync` 产物，必须进 git——rsync `--delete` 部署依赖它）
- Modify: `docs/deploy.md`（补记 WorkingDirectory）

**Interfaces:**
- Consumes: Task 2 脚本、Task 8 闸门。
- Produces: 线上可见的完整功能。

- [ ] **Step 1: 执行真实同步**

```bash
pnpm demo:sync
```

Expected: 输出「写入 50，跳过 0，删除 0，未识别 0」；`git status --short content/` 显示 50 个新 `.java`（10 块 × 5）。

- [ ] **Step 2: audit + 全量验证**

```bash
pnpm content:audit && pnpm typecheck && pnpm test
```

Expected: 全绿（audit 的 demo 闸门对 50 个真快照零问题——ULID↔文件名↔目录全部一致）。

- [ ] **Step 3: docs/deploy.md 补记 WorkingDirectory**

在 deploy 文档 systemd unit 说明处（执行者定位现有 unit 段落）加一句：

```markdown
- `WorkingDirectory=/opt/interview-drill`：示例代码快照 loader（`src/server/demo-code.ts`）以 `process.cwd()` 为基准读 `content/`——缺此配置时该功能静默不可见（loader 会在 content/ 缺失时抛错，但 cwd 错误等于部署错误，必须核对）。
```

- [ ] **Step 4: commit + 手动验证清单**

```bash
git add content/ docs/deploy.md
git commit -m "feat(demo): 快照 50 个 Java Demo 进 content/——rsync --delete 部署依赖快照进 git"
```

手动验证（`pnpm dev` 后浏览器，记入 commit 前自测）：

1. `/drill/java/generics` 对应学习页（`/drill/learn?block=java/generics`）：桥方法卡正文后有「可运行示例（Java）」折叠块，展开是高亮 Java、无头 Javadoc（看不到「题卡：」「要点口径」字样）。
2. 复盘：勾答交卷后，讲解区下出现示例折叠块；无 demo 的卡（非 java 大类卡）不出现。
3. 公开页 `/drill/q/01M3M39N0Z840CFBC8RWQ0R8FV`（桥方法）：见「本题配有可运行示例 · 在 App 内查看」，**页面无任何代码**。
4. 非题卡路径兜底：公开页 `/drill/q/<不存在的卡>` 仍是 404。

- [ ] **Step 5: 部署提醒（不在本计划内执行，交付时告知用户）**

生产升级时无需 `content:upsert` / `drizzle-kit migrate`（代码不进 DB）；rsync（含新 `.java`）→ `pnpm build` → restart 即可。本地与生产都不需要重跑 upsert。

---

## 自审记录（writing-plans Self-Review）

1. **Spec 覆盖**：§3 脚本→Task 2；§4 lib/server→Task 1/3；§5 三页→Task 5/6/7（公开页提示行、复盘 deps 注入、学习页直调）；§6 audit→Task 8；§7 测试→各 Task 内嵌 + Task 9 验收；§8 部署→Task 9 Step 3/5。GitHub 外链 spec §8 标记「暂不做」，无对应任务（有意）。
2. **占位符**：Task 5/7 测试中「夹具函数名以文件内为准」是对既有测试文件的引用约定（执行者读文件即得），非缺失设计；其余步骤代码完整。
3. **类型一致性**：`parseDemoHeader`/`stripDemoHeader`/`auditDemoSnapshots`/`loadDemoCode`/`DemoCodeBlock`/`CardView.demoCode`/`LearnCard.demoCode`/`PublicCard.blockId` 在各 Task 间签名一致；`DailyPayloadDeps.loadDemoCode` 为同步签名（与 `serverNowMs` 同为同步成员的先例）。
