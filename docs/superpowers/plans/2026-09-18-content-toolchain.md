# 内容工具链与 Schema 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成 1345 道题的内容 schema、校验体系与审核工具链，让内容生产（170-280 小时的关键路径）可以安全开工。

**Architecture:** 三层。`src/lib/content` 是纯函数库——类型、zod schema、三条机器校验正则、源文件解析、全库审计，无 IO 无副作用，可完整单测。`tools/` 是本地 CLI——脚手架铸 id、互斥检查的召回与确认，直接读写 `content/` 目录，不部署、不接触生产库。`content/` 是 Git 管理的内容源，YAML frontmatter 承载结构化字段、markdown 正文承载 `detail`。

**为什么这个计划排第一：** 设计文档 §4.2 明写 `KeyPoint` schema 是"唯一有截止期限的改动——必须在批量生产 1400 张卡之前定好，否则全部返工"；§9.1 明写审核工具"开发应排在内容生产之前"；§10 明写内容轨是关键路径。schema 一旦有卡片落盘再改，代价是全量返工。

**Tech Stack:** TypeScript 5 · Node 20 · pnpm · vitest（测试）· zod（schema）· gray-matter（frontmatter 解析）· ulid（id 铸造）

**上游依赖：** 无。本计划不依赖排期引擎、出题引擎或应用层。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/content/types.ts` | 领域类型：`Card` `KeyPoint` `Source` `CardType` `Frequency`。无逻辑，纯类型 |
| `src/lib/content/schema.ts` | zod schema + per-`cardType` 的最少要点数规则 |
| `src/lib/content/rules.ts` | 三条机器校验正则（要点长度 / 承载词 / 块名），§9.3 |
| `src/lib/content/parse.ts` | 源文件（YAML frontmatter + markdown）→ `Card` |
| `src/lib/content/block.ts` | `block.yml` → `Block`，并执行 B5 块名校验 |
| `src/lib/content/audit.ts` | 全库一次性审计：id 唯一性、外键、干扰项池容量、块归属、跨提交 id 守卫 |
| `src/lib/content/index.ts` | 对外导出面 |
| `tools/content-new/index.ts` | `pnpm content:new <blockId> [cardType]` —— 铸 ULID、生成骨架 |
| `tools/review/pairs.ts` | 生成块内 (要点, 他题) 组合 |
| `tools/review/recall.ts` | 召回导向预筛：打分函数注入，可测 |
| `tools/review/register.ts` | 互斥登记写回源文件，纯函数 |
| `tools/review/cli.ts` | 互斥确认界面：预筛 → 逐条确认 → 写回 |
| `tools/audit-cli.ts` | 读盘 + 调用 lib 审计 + lockfile 读写。**唯一的读盘处** |
| `content/.ids.lock` | 上一次 main 的全量 id 快照，CI 跨提交守卫用 |
| `content/<category>/<block>/block.yml` | 块元数据：id、中文名、所属大类 |

**边界原则：** `src/lib/content` 不做任何文件系统访问——`parse` 接收字符串、`audit` 接收已解析的 `Card[]`。读盘只发生在 `tools/` 和 CI 脚本里。这样全部校验逻辑可以在内存里单测，不需要建临时目录。

---

### Task 1: 项目骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/lib/content/index.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "interview-drill",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "content:new": "tsx tools/content-new/index.ts",
    "content:audit": "tsx tools/audit-cli.ts",
    "review:pairs": "tsx tools/review/cli.ts"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "ulid": "^2.3.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tools", "tests"]
}
```

`noUncheckedIndexedAccess` 打开是有意的：审计代码大量做数组和 Map 下标访问，这个开关能在编译期逼出漏掉的 undefined 分支。

- [ ] **Step 3: 创建 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: 创建 `src/lib/content/index.ts` 占位导出**

```ts
export const CONTENT_LIB_VERSION = '0.0.0'
```

- [ ] **Step 5: 写冒烟测试 `tests/smoke.test.ts`**

```ts
import { CONTENT_LIB_VERSION } from '../src/lib/content/index.js'

test('工具链已就位', () => {
  expect(CONTENT_LIB_VERSION).toBe('0.0.0')
})
```

- [ ] **Step 6: 安装依赖并运行测试**

Run: `pnpm install`，然后 `pnpm test`
Expected: 1 passed

（分两条命令跑。pnpm 10 起 `install` 会因 build script 审批提示而中断串联命令。）

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src tests
git commit -m "chore: 项目骨架与测试环境"
```

---

### Task 2: 领域类型

**Files:**
- Create: `src/lib/content/types.ts`

设计文档 §4.2 定义了 `Card` 和 `KeyPoint`，但引用了一个从未定义的 `Source` 类型。本任务把它定死——不定的话 1345 张卡的出处格式会各写各的，而 §9 ③ 的"每条要点能否在 sources 里逐条验证"就没法机器校验。

- [ ] **Step 1: 创建 `src/lib/content/types.ts`**

```ts
/** 题型。决定出题形式与计分方式，见设计文档 §4.3 */
export type CardType =
  | 'enumeration'  // 可枚举型：答案是无序清单
  | 'comparison'   // 对比推理型：X vs Y，正确要点须成对
  | 'sequence'     // 因果链/过程型：顺序即答案，排序题，选项不打乱
  | 'judgment'     // 权衡判断型：二段式，先结论后支撑
  | 'atomic'       // 单点事实型：单选 4 选 1

export type Frequency = 'high' | 'mid' | 'low'

/**
 * 要点出处。必须指向英文一手资料——设计文档 §9.1 规定中文技术博客
 * 不得作为 source，因为中文圈流传的错误结论正是双模型交叉预审失效的根源。
 * `kind` 的枚举本身就是这条规则的执行机制。
 */
export type SourceKind = 'official-doc' | 'source-code' | 'rfc' | 'jsr' | 'spec'

export type Source = {
  kind: SourceKind
  /** 资料 URL */
  url: string
  /** 精确定位：类#方法、章节号、RFC 小节。如 'AbstractQueuedSynchronizer#acquire' */
  locator: string
}

export type KeyPoint = {
  /** 块内唯一。互斥登记、漏点统计、干扰项引用都指向它 */
  id: string
  text: string
  source: Source
  /** 该条要点自己的版本范围，缺省继承卡级 appliesTo */
  appliesTo?: string
  /** 本要点对这些题（cardId）也成立，不得抽作它们的干扰项 */
  excludeAsDistractorFor: string[]
  /**
   * 人工已确认"对这些题不成立"。仅用于避免重复确认，不参与出题。
   * 没有这个字段的话，答"否"的组合不留痕，每次重跑互斥 CLI 都会原样再问一遍 ——
   * 而重跑是常态（加了新题、调了阈值、中途退出）。工具会反复消耗它本该保护的那 25-60 小时。
   */
  confirmedIndependentOf: string[]
  /** 审核签字日期 YYYY-MM-DD，驱动 §9.2 的增量复核 */
  verifiedAt: string
  /** 公开要点：用于 SEO lead-in，且构成免费用户的跨块干扰项池 */
  public: boolean
  /** 仅 cardType='sequence' 必填：该步骤在流程中的序号，从 1 起 */
  order?: number
}

export type Card = {
  id: string
  blockId: string
  relatedBlocks: string[]
  question: string
  cardType: CardType
  keyPoints: KeyPoint[]
  /** markdown 正文，展开讲解，不参与计分 */
  detail: string
  followUps: string[]
  /** 卡级版本适用范围，如 'JDK 8+' */
  appliesTo: string
  frequency: Frequency
  /** tombstone：退役日期 YYYY-MM-DD。设置后不再出题，但保留以免 review_log 悬空 */
  retiredAt?: string
  /** id 迁移记录：本卡由哪个旧 id 改名而来，供 CI 跨提交守卫放行 */
  movedFrom?: string
}
```

- [ ] **Step 2: 验证类型可编译**

Run: `pnpm typecheck`
Expected: 无输出（通过）

- [ ] **Step 3: Commit**

```bash
git add src/lib/content/types.ts
git commit -m "feat(content): 领域类型，并定死 spec 中未定义的 Source"
```

---

### Task 3: Zod schema 与 per-cardType 最少要点数

**Files:**
- Create: `src/lib/content/schema.ts`
- Create: `tests/lib/content/schema.test.ts`

设计文档 §8.3：最少要点数**按 `cardType` 分派，不是统一 3 条**。统一 3 条会自动挡掉 17.5% 的真实高频题（单点事实型 9.9% + 情景推演型 7.6%），这是把题库推向列举题的三条漂移力里最硬的一条。

- [ ] **Step 1: 写失败测试 `tests/lib/content/schema.test.ts`**

```ts
import { cardSchema, MIN_KEY_POINTS } from '../../../src/lib/content/schema.js'
import type { Card, KeyPoint } from '../../../src/lib/content/types.js'

function kp(over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id: 'kp-1',
    text: 'state 是 volatile int，表示同步状态',
    source: { kind: 'source-code', url: 'https://example.org/AQS.java', locator: 'AbstractQueuedSynchronizer#state' },
    excludeAsDistractorFor: [],
    confirmedIndependentOf: [],
    verifiedAt: '2026-09-18',
    public: false,
    ...over,
  }
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: '01J8ZKQ7Y0000000000000000A',
    blockId: 'concurrency/aqs',
    relatedBlocks: [],
    question: 'AQS 是怎么实现独占锁的？',
    cardType: 'enumeration',
    keyPoints: [kp({ id: 'kp-1' }), kp({ id: 'kp-2' }), kp({ id: 'kp-3' })],
    detail: '展开讲解',
    followUps: ['为什么队列是双向的？'],
    appliesTo: 'JDK 8+',
    frequency: 'high',
    ...over,
  }
}

test('每种 cardType 的最少要点数各不相同', () => {
  expect(MIN_KEY_POINTS).toEqual({
    enumeration: 3, comparison: 3, sequence: 4, judgment: 2, atomic: 1,
  })
})

test('atomic 型只要 1 条要点也合法', () => {
  const r = cardSchema.safeParse(card({ cardType: 'atomic', keyPoints: [kp()] }))
  expect(r.success).toBe(true)
})

test('enumeration 型只给 2 条要点应失败', () => {
  const r = cardSchema.safeParse(card({ keyPoints: [kp({ id: 'a' }), kp({ id: 'b' })] }))
  expect(r.success).toBe(false)
})

test('sequence 型的每条要点必须有 order', () => {
  const four = [1, 2, 3, 4].map(i => kp({ id: `kp-${i}` }))
  const r = cardSchema.safeParse(card({ cardType: 'sequence', keyPoints: four }))
  expect(r.success).toBe(false)

  const withOrder = [1, 2, 3, 4].map(i => kp({ id: `kp-${i}`, order: i }))
  const ok = cardSchema.safeParse(card({ cardType: 'sequence', keyPoints: withOrder }))
  expect(ok.success).toBe(true)
})

test('要点上限 6 条', () => {
  const seven = [1, 2, 3, 4, 5, 6, 7].map(i => kp({ id: `kp-${i}` }))
  expect(cardSchema.safeParse(card({ keyPoints: seven })).success).toBe(false)
})

test('中文博客不能作为 source —— kind 枚举挡住它', () => {
  const bad = kp({ source: { kind: 'blog' as never, url: 'https://blog.csdn.net/x', locator: '全文' } })
  expect(cardSchema.safeParse(card({ keyPoints: [bad, kp({ id: 'b' }), kp({ id: 'c' })] })).success).toBe(false)
})

test('verifiedAt 必须是 YYYY-MM-DD', () => {
  const bad = kp({ verifiedAt: '2026/09/18' })
  expect(cardSchema.safeParse(card({ keyPoints: [bad, kp({ id: 'b' }), kp({ id: 'c' })] })).success).toBe(false)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/schema.test.ts`
Expected: FAIL —— `Failed to resolve import ".../schema.js"`

- [ ] **Step 3: 实现 `src/lib/content/schema.ts`**

```ts
import { z } from 'zod'
import type { CardType } from './types.js'

/** 按 cardType 分派的最少要点数。设计文档 §8.3 */
export const MIN_KEY_POINTS: Record<CardType, number> = {
  enumeration: 3,
  comparison: 3,
  sequence: 4,
  judgment: 2,
  atomic: 1,
}

export const MAX_KEY_POINTS = 6

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 两个 schema 都是 .strict()。zod 默认会**静默剥离**未知字段，而 `retiredAt`
// 和 `movedFrom` 恰好是 §7 那套 id 守卫的两个放行开关，且都是可选的 ——
// 拼成 `retiredAT` 不会有任何信号，作者以为下线了，卡却继续出题给用户。

export const sourceSchema = z.object({
  kind: z.enum(['official-doc', 'source-code', 'rfc', 'jsr', 'spec']),
  url: z.string().url(),
  locator: z.string().min(1),
})

export const keyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source: sourceSchema,
  appliesTo: z.string().min(1).optional(),
  excludeAsDistractorFor: z.array(z.string()),
  confirmedIndependentOf: z.array(z.string()).default([]),
  verifiedAt: z.string().regex(ISO_DATE, 'verifiedAt 必须是 YYYY-MM-DD'),
  public: z.boolean(),
  order: z.number().int().positive().optional(),
}).strict()

export const cardSchema = z
  .object({
    id: z.string().min(1),
    blockId: z.string().min(1),
    relatedBlocks: z.array(z.string()),
    question: z.string().min(1),
    cardType: z.enum(['enumeration', 'comparison', 'sequence', 'judgment', 'atomic']),
    keyPoints: z.array(keyPointSchema).max(MAX_KEY_POINTS),
    detail: z.string(),
    followUps: z.array(z.string()),
    appliesTo: z.string().min(1),
    frequency: z.enum(['high', 'mid', 'low']),
    retiredAt: z.string().regex(ISO_DATE).optional(),
    movedFrom: z.string().optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    const min = MIN_KEY_POINTS[card.cardType]
    if (card.keyPoints.length < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keyPoints'],
        message: `${card.cardType} 型至少需要 ${min} 条要点，实际 ${card.keyPoints.length} 条`,
      })
    }
    if (card.cardType === 'sequence') {
      card.keyPoints.forEach((kp, i) => {
        if (kp.order === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyPoints', i, 'order'],
            message: 'sequence 型的每条要点必须有 order —— 顺序就是这型题的答案',
          })
        }
      })
    }
  })
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/lib/content/schema.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/schema.ts tests/lib/content/schema.test.ts
git commit -m "feat(content): zod schema，最少要点数按 cardType 分派"
```

---

### Task 4: 三条机器校验正则

**Files:**
- Create: `src/lib/content/rules.ts`
- Create: `tests/lib/content/rules.test.ts`

设计文档 §9.3 的三条规则。它们覆盖的正是 §9.1 自己承认的薄弱点——"同块连审 20 道题极其单调，第 15 道后判断质量下降"。跑在约 6000 条要点上，成本为零。

- [ ] **Step 1: 写失败测试 `tests/lib/content/rules.test.ts`**

```ts
import { checkKeyPointText, checkBlockName, MAX_KP_HAN_CHARS } from '../../../src/lib/content/rules.js'

test('要点汉字数上界是 30', () => {
  expect(MAX_KP_HAN_CHARS).toBe(30)
})

test('超长要点被拒，并报出实际字数', () => {
  const long = '在' .repeat(31)
  const issues = checkKeyPointText(long)
  expect(issues).toHaveLength(1)
  expect(issues[0]).toContain('31')
})

test('长度只数汉字，不数英文和标点', () => {
  const s = 'state 是 volatile int，表示同步状态，独占锁下 0 表示空闲'
  expect(checkKeyPointText(s)).toEqual([])
})

test.each(['等', '多种', '一系列', '若干', '之类', '诸如', '各种'])(
  '承载词「%s」命中即失败', (word) => {
    const issues = checkKeyPointText(`AQS 支持独占和共享${word}模式`)
    expect(issues.some(i => i.includes(word))).toBe(true)
  },
)

test('正常要点无问题', () => {
  expect(checkKeyPointText('获取锁是对 state 做 CAS，成功即持有')).toEqual([])
})

test.each(['基础', '进阶', '高级', '其他', '常见问题', '高频'])(
  '块名黑名单「%s」命中即失败', (word) => {
    expect(checkBlockName(`MySQL ${word}`)).toHaveLength(1)
  },
)

test('合格的块名通过', () => {
  expect(checkBlockName('MVCC 与 Undo Log')).toEqual([])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/rules.test.ts`
Expected: FAIL —— 无法解析 `rules.js`

- [ ] **Step 3: 实现 `src/lib/content/rules.ts`**

```ts
/** 要点长度上界（汉字数）。KP2「单一信息核」的廉价代理，不替代人工判断 */
export const MAX_KP_HAN_CHARS = 30

/** KP5 承载词：把多个事实折叠进一个词，是"把不可枚举硬塞进枚举"的语法标志 */
const CARRIER_WORDS = ['等', '多种', '一系列', '若干', '之类', '诸如', '各种'] as const

/** B5 块名黑名单：这些词说明块的边界没想清楚 */
const VAGUE_BLOCK_WORDS = ['基础', '进阶', '高级', '其他', '常见问题', '高频'] as const

const HAN = /\p{Script=Han}/gu

export function countHanChars(s: string): number {
  return (s.match(HAN) ?? []).length
}

export function checkKeyPointText(text: string): string[] {
  const issues: string[] = []
  const n = countHanChars(text)
  if (n > MAX_KP_HAN_CHARS) {
    issues.push(`要点过长：${n} 个汉字，上界 ${MAX_KP_HAN_CHARS}（违反 KP2 单一信息核）`)
  }
  for (const w of CARRIER_WORDS) {
    if (text.includes(w)) {
      issues.push(`要点含承载词「${w}」，它折叠了未知数量的事实（违反 KP5）`)
    }
  }
  return issues
}

export function checkBlockName(name: string): string[] {
  const issues: string[] = []
  for (const w of VAGUE_BLOCK_WORDS) {
    if (name.includes(w)) {
      issues.push(`块名含模糊词「${w}」，说明块的边界没定清楚（违反 B5）`)
    }
  }
  return issues
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/lib/content/rules.test.ts`
Expected: 全部 passed（`test.each` 会把两组参数化用例各展开成多条，以实际输出为准）

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/rules.ts tests/lib/content/rules.test.ts
git commit -m "feat(content): KP5/B5 的三条机器校验规则"
```

---

### Task 5: 源文件解析器

**Files:**
- Create: `src/lib/content/parse.ts`
- Create: `tests/lib/content/parse.test.ts`

内容源格式：YAML frontmatter 承载结构化字段，markdown 正文即 `detail`。`parse` 接收字符串不接收路径——保证 `lib/content` 零 IO，全部逻辑可在内存里测。

- [ ] **Step 1: 写失败测试 `tests/lib/content/parse.test.ts`**

```ts
import { parseCard } from '../../../src/lib/content/parse.js'

const SRC = `---
id: 01J8ZKQ7Y0000000000000000A
blockId: concurrency/aqs
relatedBlocks: []
question: AQS 是怎么实现独占锁的？
cardType: enumeration
appliesTo: JDK 8+
frequency: high
followUps:
  - 为什么等待队列是双向的？
keyPoints:
  - id: kp-1
    text: state 是 volatile int，表示同步状态
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#state
  - id: kp-2
    text: 获取锁是对 state 做 CAS，成功即持有
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#acquire
  - id: kp-3
    text: CAS 失败则把线程包装成 Node，入队列尾部
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#addWaiter
---

AQS 是 JUC 的基础同步框架。`

test('解析出完整的 Card', () => {
  const r = parseCard(SRC, 'content/concurrency/aqs/01J8.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.id).toBe('01J8ZKQ7Y0000000000000000A')
  expect(r.card.cardType).toBe('enumeration')
  expect(r.card.keyPoints).toHaveLength(3)
  expect(r.card.keyPoints[0]!.public).toBe(true)
  expect(r.card.detail.trim()).toBe('AQS 是 JUC 的基础同步框架。')
})

test('schema 不合法时返回错误而非抛异常，且带上文件路径', () => {
  const bad = SRC.replace('cardType: enumeration', 'cardType: essay')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('content/x/y.md')
})

test('触发 KP5 承载词的要点在解析阶段就被报出', () => {
  const bad = SRC.replace('表示同步状态', '表示同步状态等信息')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('承载词')
})

test('缺 frontmatter 时报错不崩', () => {
  const r = parseCard('只有正文没有 frontmatter', 'content/x/y.md')
  expect(r.ok).toBe(false)
})

test('verifiedAt 必须保持字符串，不能被 YAML 当 timestamp 解析成 Date', () => {
  const r = parseCard(SRC, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(typeof r.card.keyPoints[0]!.verifiedAt).toBe('string')
  expect(r.card.keyPoints[0]!.verifiedAt).toBe('2026-09-18')
})

test('public 仍然是 boolean，没有被 JSON_SCHEMA 影响', () => {
  const r = parseCard(SRC, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.public).toBe(true)
})
```

最后两条是本任务的核心。**默认的 YAML 引擎会把 `2026-09-18` 解析成 `Date` 对象**，`z.string()` 一律拒收，报 `verifiedAt —— Expected string, received date` —— 1345 张卡一张都进不来，后面全部任务连带报废。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/parse.test.ts`
Expected: FAIL —— 无法解析 `parse.js`

- [ ] **Step 3: 创建共享 YAML 引擎 `src/lib/content/yaml.ts`**

```ts
import yaml from 'js-yaml'

/**
 * 全项目统一的 YAML 引擎，parse.ts / block.ts / register.ts 必须都用它。
 *
 * 为什么钉 JSON_SCHEMA：默认的 YAML 1.1 schema 含 timestamp 类型，
 * 会把 `verifiedAt: 2026-09-18` 解析成 Date 对象。JSON_SCHEMA 只有
 * null/bool/int/float/string 五种类型，日期保持字符串，而 `public: true`
 * 仍然是 boolean。
 *
 * 为什么钉 dump 选项：写回时必须与读入格式一致，否则每次写回都会顺手改动
 * 无关字段（实测默认设置会把 `url: https://x` 加上引号），让 diff 失去可读性 ——
 * 而互斥登记是 25-60 小时的人工成果，全靠 PR diff 审查。
 */
export const YAML_ENGINE = {
  // 注：静态检查工具可能对 `yaml.load` 报 PyYAML 的反序列化告警 —— 那条规则针对
  // Python。js-yaml v4 起 `load` 本身就是安全加载器（不安全的那个已移除），
  // 且这里显式钉了 JSON_SCHEMA，比默认更收紧，不存在任意类型构造。
  parse: (s: string) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object,
  stringify: (o: object) =>
    yaml.dump(o, { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true, sortKeys: false }),
}

export const MATTER_OPTS = { engines: { yaml: YAML_ENGINE } }

/**
 * gray-matter 会按输入字符串缓存解析结果，且 `.data` 是缓存里的**引用**。
 * 直接改它会污染缓存 —— 实测同一输入第二次调用会带出第一次的修改结果。
 * 任何要改 data 的地方必须先经过这个函数。
 */
export function detachedData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}
```

把 `js-yaml` 加进 `package.json` 的 dependencies：`"js-yaml": "^4.1.0"`，devDependencies 加 `"@types/js-yaml": "^4.0.9"`，然后 `pnpm install`。

- [ ] **Step 4: 实现 `src/lib/content/parse.ts`**

```ts
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/lib/content/parse.test.ts`
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/yaml.ts src/lib/content/parse.ts tests/lib/content/parse.test.ts package.json
git commit -m "feat(content): 源文件解析器 + 统一 YAML 引擎

钉 JSON_SCHEMA 是必须的：默认 YAML 1.1 会把 verifiedAt 解析成 Date，
z.string() 一律拒收，全部 1345 张卡都进不来。"
```

---

### Task 6: 全库审计 —— id 唯一性与外键

**Files:**
- Create: `src/lib/content/audit.ts`
- Create: `tests/lib/content/audit-identity.test.ts`

设计文档 §7：**校验必须是全库一次性，不是 per-card**。两个作者在同块不同文件各加一条 `kp-7`，Git 不会冲突，只有全库校验能发现。而 id 一动，`review_log.distractorIds`、`excludeAsDistractorFor`、`card_state` 全变悬空引用——§9.1 那 25-60 小时的人工互斥登记就挂在这些 id 上。

- [ ] **Step 1: 写失败测试 `tests/lib/content/audit-identity.test.ts`**

```ts
import { auditLibrary } from '../../../src/lib/content/audit.js'
import type { Card, KeyPoint } from '../../../src/lib/content/types.js'

function kp(id: string, over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id, text: '要点', public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: [], confirmedIndependentOf: [],
    source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
    ...over,
  }
}

function card(id: string, blockId: string, kps: KeyPoint[], over: Partial<Card> = {}): Card {
  return {
    id, blockId, relatedBlocks: [], question: '问题？', cardType: 'enumeration',
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
    ...over,
  }
}

const K3 = () => [kp('kp-1'), kp('kp-2'), kp('kp-3')]

test('干净的库通过审计', () => {
  const r = auditLibrary([card('c1', 'b1', K3()), card('c2', 'b1', K3())])
  expect(r.errors).toEqual([])
})

test('卡 id 全局重复被发现', () => {
  const r = auditLibrary([card('dup', 'b1', K3()), card('dup', 'b2', K3())])
  expect(r.errors.join()).toContain('卡 id 重复')
})

test('要点 id 在同一个块内重复被发现（跨文件也能抓到）', () => {
  const a = card('c1', 'b1', [kp('kp-x'), kp('kp-2'), kp('kp-3')])
  const b = card('c2', 'b1', [kp('kp-x'), kp('kp-5'), kp('kp-6')])
  expect(auditLibrary([a, b]).errors.join()).toContain('要点 id 在块 b1 内重复')
})

test('要点 id 跨块重复是允许的', () => {
  const a = card('c1', 'b1', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  const b = card('c2', 'b2', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([a, b]).errors).toEqual([])
})

test('excludeAsDistractorFor 指向不存在的卡被发现', () => {
  const c = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['ghost'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([c]).errors.join()).toContain('ghost')
})

test('relatedBlocks 指向不存在的块被发现', () => {
  const c = card('c1', 'b1', K3(), { relatedBlocks: ['no-such-block'] })
  expect(auditLibrary([c]).errors.join()).toContain('no-such-block')
})

test('退役卡仍算存在，指向它的外键不算悬空', () => {
  // tombstone 的意义正在于此：卡退役后不再出题，但 review_log 和
  // excludeAsDistractorFor 里的历史引用必须继续有效（§7）
  const dead = card('c-dead', 'b1', K3(), { retiredAt: '2026-01-01' })
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['c-dead'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([dead, live]).errors).toEqual([])
})

test('真正不存在的卡才算悬空外键', () => {
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['never-existed'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([live]).errors.join()).toContain('never-existed')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/audit-identity.test.ts`
Expected: FAIL —— 无法解析 `audit.js`

- [ ] **Step 3: 实现 `src/lib/content/audit.ts`**

```ts
import type { Card } from './types.js'

export type AuditResult = {
  errors: string[]
  warnings: string[]
}

export function auditLibrary(cards: Card[]): AuditResult {
  const errors: string[] = []
  const warnings: string[] = []

  const cardIds = new Set<string>()
  for (const c of cards) {
    if (cardIds.has(c.id)) errors.push(`卡 id 重复：${c.id}`)
    cardIds.add(c.id)
  }

  const blockIds = new Set(cards.map(c => c.blockId))

  // 要点 id 只要求块内唯一，跨块重复是允许的
  const seenPerBlock = new Map<string, Set<string>>()
  for (const c of cards) {
    let set = seenPerBlock.get(c.blockId)
    if (!set) { set = new Set(); seenPerBlock.set(c.blockId, set) }
    for (const kp of c.keyPoints) {
      if (set.has(kp.id)) {
        errors.push(`要点 id 在块 ${c.blockId} 内重复：${kp.id}（卡 ${c.id}）`)
      }
      set.add(kp.id)
    }
  }

  for (const c of cards) {
    for (const b of c.relatedBlocks) {
      if (!blockIds.has(b)) errors.push(`卡 ${c.id} 的 relatedBlocks 指向不存在的块：${b}`)
    }
    for (const kp of c.keyPoints) {
      for (const target of kp.excludeAsDistractorFor) {
        if (!cardIds.has(target)) {
          errors.push(`卡 ${c.id} 要点 ${kp.id} 的 excludeAsDistractorFor 指向不存在的卡：${target}`)
        }
      }
    }
  }

  return { errors, warnings }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/lib/content/audit-identity.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/audit.ts tests/lib/content/audit-identity.test.ts
git commit -m "feat(content): 全库审计的 id 唯一性与外键检查"
```

---

### Task 7: 全库审计 —— 干扰项池容量

**Files:**
- Modify: `src/lib/content/audit.ts`
- Create: `tests/lib/content/audit-pool.test.ts`

设计文档 §4.3：干扰项第 1 层从同块抽。块内要点池减去本题要点、再减去互斥命中的，若剩得太少，出题时会抽不满 9 个选项——而**选项总数必须固定为 9**，抽不满就会泄露正确条数。这条必须在内容阶段挡住，不能等到运行时。

- [ ] **Step 1: 写失败测试 `tests/lib/content/audit-pool.test.ts`**

```ts
import { auditLibrary, MIN_BLOCK_POOL } from '../../../src/lib/content/audit.js'
import type { Card, KeyPoint } from '../../../src/lib/content/types.js'

function kp(id: string, excl: string[] = []): KeyPoint {
  return {
    id, text: '要点', public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: excl, confirmedIndependentOf: [],
    source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
  }
}
function card(id: string, kps: KeyPoint[]): Card {
  return {
    id, blockId: 'b1', relatedBlocks: [], question: '问题？', cardType: 'enumeration',
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
  }
}

test('同块可用干扰项池的下界按最坏情况取 12', () => {
  expect(MIN_BLOCK_POOL).toBe(12)
})

test('块内题目太少导致池不足时报错', () => {
  const cards = [card('c1', [kp('a1'), kp('a2'), kp('a3')]), card('c2', [kp('b1'), kp('b2'), kp('b3')])]
  // 对 c1 而言可用池 = c2 的 3 条 < 12
  expect(auditLibrary(cards).errors.join()).toContain('干扰项池不足')
})

test('互斥登记把池吃到不足时同样报错', () => {
  const cards = [
    card('c1', [kp('a1'), kp('a2'), kp('a3')]),
    card('c2', [kp('b1', ['c1']), kp('b2', ['c1']), kp('b3', ['c1'])]),
    card('c3', [kp('d1', ['c1']), kp('d2', ['c1']), kp('d3', ['c1'])]),
  ]
  // c1 的可用池被互斥登记清空
  expect(auditLibrary(cards).errors.join()).toContain('干扰项池不足')
})

test('池充足时通过', () => {
  // 每张卡的可用池 = 其余 4 张 × 3 条 = 12，刚好达到下界
  const cards = [1, 2, 3, 4, 5].map(i =>
    card(`c${i}`, [kp(`k${i}a`), kp(`k${i}b`), kp(`k${i}c`)]),
  )
  expect(auditLibrary(cards).errors).toEqual([])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/audit-pool.test.ts`
Expected: FAIL —— `MIN_BLOCK_POOL` 未导出

- [ ] **Step 3: 在 `src/lib/content/audit.ts` 顶部加入常量**

```ts
/**
 * 同块可用干扰项池下界。按**最坏情况**推导：
 *
 * - 干扰项数 = 9 − 正确要点数。正确要点最少 3 条（§8.3 的 enumeration 下界），
 *   所以单次出题最多需要 **6 条**干扰项。
 * - §4.3 的分层比例表里 `s = 1` 那档是 **3:0** —— 掌握度满时干扰项**全部从同块抽**。
 *
 * 即最坏情况下单次出题就要吃掉 6 条同块要点。而 §4.3 同时规定"绝不允许少给干扰项"
 * （会让选项总数变化、泄露正确条数）且"不允许重复抽同一条"。
 * 池 = 6 是刚好够一次、余量为零；叠加"每次重抽"和服务端预生成 K 份 variants，
 * 必然反复抽到同一批。取 2 倍余量。
 */
export const MIN_BLOCK_POOL = 12
```

- [ ] **Step 4: 在 `auditLibrary` 的 return 之前插入池容量检查**

```ts
  // 干扰项池容量：对每张卡，同块其他卡的要点里有多少是可用的
  const byBlock = new Map<string, Card[]>()
  for (const c of cards) {
    const list = byBlock.get(c.blockId)
    if (list) list.push(c)
    else byBlock.set(c.blockId, [c])
  }

  // 池容量只校验已完善的块。内容生产要持续 4-9 个月，期间绝大多数块是半成品，
  // 让在建块把 CI 一直染红等于让所有人学会忽略它。
  const readyBlocks = new Set(blocks.filter(b => b.status === 'ready').map(b => b.id))

  for (const [blockId, blockCards] of byBlock) {
    if (blocks.length > 0 && !readyBlocks.has(blockId)) continue
    for (const c of blockCards) {
      if (c.retiredAt) continue
      let usable = 0
      for (const other of blockCards) {
        if (other.id === c.id || other.retiredAt) continue
        for (const kp of other.keyPoints) {
          if (!kp.excludeAsDistractorFor.includes(c.id)) usable++
        }
      }
      if (usable < MIN_BLOCK_POOL) {
        errors.push(
          `块 ${blockId} 卡 ${c.id} 的同块干扰项池不足：可用 ${usable} 条，下界 ${MIN_BLOCK_POOL}`,
        )
      }
    }
  }
```

- [ ] **Step 5: 运行全部内容测试**

Run: `pnpm vitest run tests/lib/content`
Expected: 全部 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/audit.ts tests/lib/content/audit-pool.test.ts
git commit -m "feat(content): 干扰项池容量下界校验"
```

---

### Task 8: 跨提交 id 守卫

**Files:**
- Modify: `src/lib/content/audit.ts`
- Create: `tests/lib/content/audit-lock.test.ts`

设计文档 §7：把上一次 main 的全量 id 集合作为 `content/.ids.lock` 提交，CI 比对，id 消失或改变即构建失败，除非同 PR 显式写了 `movedFrom` / `retiredAt`。这是保护那 25-60 小时人工互斥登记的唯一机制。

- [ ] **Step 1: 写失败测试 `tests/lib/content/audit-lock.test.ts`**

```ts
import { checkIdLock } from '../../../src/lib/content/audit.js'
import type { Card } from '../../../src/lib/content/types.js'

function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id, blockId: 'b1', relatedBlocks: [], question: '问题？', cardType: 'atomic',
    keyPoints: [{
      id: 'kp-1', text: '要点', public: false, verifiedAt: '2026-09-18',
      excludeAsDistractorFor: [], confirmedIndependentOf: [],
      source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
    }],
    detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid', ...over,
  }
}

test('新增 id 允许', () => {
  expect(checkIdLock([card('c1'), card('c2')], ['card:c1'])).toEqual([])
})

test('卡 id 凭空消失被拦下', () => {
  const errs = checkIdLock([card('c1')], ['card:c1', 'card:c2'])
  expect(errs.join()).toContain('c2')
  expect(errs.join()).toContain('消失')
})

test('退役卡仍在库里，不算消失', () => {
  expect(checkIdLock([card('c1'), card('c2', { retiredAt: '2026-09-18' })], ['card:c1', 'card:c2'])).toEqual([])
})

test('改名时写了 movedFrom 就放行', () => {
  expect(checkIdLock([card('c1'), card('c2-new', { movedFrom: 'c2' })], ['card:c1', 'card:c2'])).toEqual([])
})

test('改名但没写 movedFrom 被拦下', () => {
  expect(checkIdLock([card('c1'), card('c2-new')], ['card:c1', 'card:c2']).join()).toContain('c2')
})

test('要点 id 消失同样被拦下 —— review_log.distractorIds 引用的是它', () => {
  const errs = checkIdLock([card('c1')], ['card:c1', 'kp:b1/kp-gone'])
  expect(errs.join()).toContain('kp-gone')
})

test('要点 id 还在则放行', () => {
  expect(checkIdLock([card('c1')], ['card:c1', 'kp:b1/kp-1'])).toEqual([])
})

test('无法识别的 lockfile 行被报出，而不是静默忽略', () => {
  expect(checkIdLock([card('c1')], ['垃圾行']).join()).toContain('无法识别')
})

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/audit-lock.test.ts`
Expected: FAIL —— `checkIdLock` 未导出

- [ ] **Step 3: 在 `src/lib/content/audit.ts` 末尾追加**

```ts
/**
 * 跨提交 id 守卫。`lockedIds` 是上一次 main 的 content/.ids.lock 内容，
 * 每行形如 `card:<cardId>` 或 `kp:<blockId>/<keyPointId>`。
 *
 * 两类 id 都要守：review_log.distractorIds 存的是**要点** id，
 * 只守卡 id 的话要点改名一样让历史日志悬空。
 */
export function checkIdLock(cards: Card[], lockedIds: string[]): string[] {
  const liveCards = new Set(cards.map(c => c.id))
  const movedFrom = new Set(cards.map(c => c.movedFrom).filter((x): x is string => !!x))
  const liveKeyPoints = new Set(
    cards.flatMap(c => c.keyPoints.map(kp => `${c.blockId}/${kp.id}`)),
  )

  const errors: string[] = []
  for (const line of lockedIds) {
    const [kind, ...rest] = line.split(':')
    const id = rest.join(':')
    if (kind === 'card') {
      if (liveCards.has(id) || movedFrom.has(id)) continue
      errors.push(
        `卡 id ${id} 相对上一次 main 消失了。` +
        `若为改名，请在新卡上写 movedFrom: ${id}；若为下线，请保留该卡并设 retiredAt。` +
        `直接删除会让 review_log 与 excludeAsDistractorFor 变成悬空引用。`,
      )
    } else if (kind === 'kp') {
      if (liveKeyPoints.has(id)) continue
      errors.push(
        `要点 id ${id} 相对上一次 main 消失了。` +
        `review_log.distractorIds 引用的正是它，删改会让历史记录无法解释。`,
      )
    } else {
      errors.push(`lockfile 行格式无法识别：${line}`)
    }
  }
  return errors
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/lib/content/audit-lock.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/audit.ts tests/lib/content/audit-lock.test.ts
git commit -m "feat(content): 跨提交 id 守卫，保护人工互斥登记成果"
```

---

### Task 9: 内容脚手架 `content:new`

**Files:**
- Create: `tools/content-new/index.ts`
- Create: `tools/content-new/template.ts`
- Create: `tests/tools/content-new.test.ts`

设计文档 §7：**id 由脚手架生成，不由人写**。序号派生 id 会让"在 001 和 002 之间插一道题"触发全部重编号，`card_state` 全对不上，**用户复习进度静默归零**——而且在产品里看起来像"上新内容了"，不像事故。

- [ ] **Step 1: 写失败测试 `tests/tools/content-new.test.ts`**

```ts
import { renderTemplate } from '../../tools/content-new/template.js'
import { parseCard } from '../../src/lib/content/parse.js'

test('生成的骨架能被 parseCard 解析（enumeration）', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000A', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
})

test('sequence 型骨架自带 4 条带 order 的要点', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000B', blockId: 'mysql/mvcc', cardType: 'sequence', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints).toHaveLength(4)
  expect(r.card.keyPoints.map(k => k.order)).toEqual([1, 2, 3, 4])
})

test('atomic 型骨架只有 1 条要点', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000C', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints).toHaveLength(1)
})

test('骨架里的 verifiedAt 是传入的日期', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000D', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-01-02' })
  expect(src).toContain('verifiedAt: 2026-01-02')
})

test('同块两张卡的要点 id 不会相撞', () => {
  const a = renderTemplate({ id: '01J8ZKQ7Y00000000000000AAA', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const b = renderTemplate({ id: '01J8ZKQ7Y00000000000000BBB', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const ra = parseCard(a, 'a.md'); const rb = parseCard(b, 'b.md')
  expect(ra.ok && rb.ok).toBe(true)
  if (!ra.ok || !rb.ok) return
  const idsA = new Set(ra.card.keyPoints.map(k => k.id))
  for (const k of rb.card.keyPoints) expect(idsA.has(k.id)).toBe(false)
})

test('要点 id 不含位置序号派生的成分 —— 插入新题不应触发任何重编号', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y00000000000000AAA', blockId: 'mysql/mvcc', cardType: 'atomic', today: '2026-09-18' })
  const r = parseCard(src, 'a.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  // 前缀来自卡自己的 ULID，与它在块里的第几位无关
  expect(r.card.keyPoints[0]!.id).toContain('000aaa')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/tools/content-new.test.ts`
Expected: FAIL —— 无法解析 `template.js`

- [ ] **Step 3: 实现 `tools/content-new/template.ts`**

```ts
import { MIN_KEY_POINTS } from '../../src/lib/content/schema.js'
import type { CardType } from '../../src/lib/content/types.js'

export type TemplateInput = {
  id: string
  blockId: string
  cardType: CardType
  today: string
}

function keyPointBlock(prefix: string, i: number, today: string, withOrder: boolean): string {
  const orderLine = withOrder ? `\n    order: ${i}` : ''
  return `  - id: ${prefix}-${i}
    text: 待填写要点 ${i}
    public: ${i === 1}
    verifiedAt: ${today}
    excludeAsDistractorFor: []
    confirmedIndependentOf: []${orderLine}
    source:
      kind: official-doc
      url: https://example.org/REPLACE-ME
      locator: REPLACE-ME`
}

export function renderTemplate(input: TemplateInput): string {
  const { id, blockId, cardType, today } = input
  const n = MIN_KEY_POINTS[cardType]
  const withOrder = cardType === 'sequence'
  // 要点 id 必须**块内**唯一（§7 与 Task 6 的审计）。固定写 kp-1/kp-2/kp-3 的话，
  // 同一个块的第二张卡就会撞 id、审计必炸；而作者最自然的补救 ——
  // 手工改成 kp-4/kp-5 —— 正好重演 §7 点名禁止的序号派生 id：
  // 中间插一道题就要重编号，下游 review_log 全部悬空。
  // 从卡自己的 ULID 尾 6 位派生前缀，既块内唯一又与位置无关。
  const prefix = `kp-${id.slice(-6).toLowerCase()}`
  const kps = Array.from({ length: n }, (_, i) => keyPointBlock(prefix, i + 1, today, withOrder)).join('\n')

  return `---
id: ${id}
blockId: ${blockId}
relatedBlocks: []
question: 待填写题面（面试官口吻的问法，不是教科书标题）
cardType: ${cardType}
appliesTo: 待填写版本范围
frequency: mid
followUps:
  - 待填写追问
keyPoints:
${kps}
---

待填写展开讲解。
`
}
```

- [ ] **Step 4: 实现 `tools/content-new/index.ts`**

```ts
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ulid } from 'ulid'
import { renderTemplate } from './template.js'
import type { CardType } from '../../src/lib/content/types.js'

const VALID: CardType[] = ['enumeration', 'comparison', 'sequence', 'judgment', 'atomic']

const blockId = process.argv[2]
const cardType = (process.argv[3] ?? 'enumeration') as CardType

if (!blockId) {
  console.error('用法: pnpm content:new <blockId> [cardType]')
  console.error(`cardType 取值: ${VALID.join(' | ')}`)
  process.exit(1)
}
if (!VALID.includes(cardType)) {
  console.error(`未知 cardType: ${cardType}，可选 ${VALID.join(' | ')}`)
  process.exit(1)
}

const id = ulid()
const today = new Date().toISOString().slice(0, 10)
const dir = join('content', blockId)
mkdirSync(dir, { recursive: true })

const file = join(dir, `${id}.md`)
if (existsSync(file)) {
  console.error(`文件已存在（ULID 撞车，几乎不可能）：${file}`)
  process.exit(1)
}

writeFileSync(file, renderTemplate({ id, blockId, cardType, today }), 'utf8')
console.log(`已创建 ${file}`)
console.log('id 由脚手架铸造，请勿手改 —— 它挂着 review_log 与互斥登记。')
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/tools/content-new.test.ts`
Expected: 6 passed

- [ ] **Step 6: 手动验证脚手架能跑**

Run: `pnpm content:new mysql/mvcc-undo sequence`
Expected: 输出 `已创建 content/mysql/mvcc-undo/<ULID>.md`

- [ ] **Step 7: Commit**

```bash
git add tools/content-new tests/tools/content-new.test.ts content
git commit -m "feat(tools): content:new 脚手架，id 由 ULID 铸造"
```

---

### Task 10: 互斥检查 —— 组合生成

**Files:**
- Create: `tools/review/pairs.ts`
- Create: `tests/tools/review-pairs.test.ts`

设计文档 §4.3：判断单位是**"(某条要点, 另一道题)"，不是"(题, 题)"**——早期按后者估成"20 题的块约 190 对"，低估 9 倍，真实是单块约 1710 次、全库约 12 万次。纯人工不可行，流程必须是机器召回 + 人工确认。

本任务只做组合生成与筛选（纯函数、可测）。LLM 召回是外部调用，放在 Task 11 的 CLI 里，不进 `lib`。

- [ ] **Step 1: 写失败测试 `tests/tools/review-pairs.test.ts`**

```ts
import { buildPairs, countPairs } from '../../tools/review/pairs.js'
import type { Card, KeyPoint } from '../../src/lib/content/types.js'

function kp(id: string, excl: string[] = []): KeyPoint {
  return {
    id, text: `要点 ${id}`, public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: excl, confirmedIndependentOf: [],
    source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
  }
}
function card(id: string, blockId: string, kps: KeyPoint[]): Card {
  return {
    id, blockId, relatedBlocks: [], question: `问题 ${id}？`, cardType: 'enumeration',
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
  }
}

test('组合数 = 要点数 × 同块其他题数', () => {
  const cards = [
    card('c1', 'b1', [kp('k1'), kp('k2')]),
    card('c2', 'b1', [kp('k3')]),
    card('c3', 'b1', [kp('k4')]),
  ]
  // c1 的 2 条 × 2 题 + c2 的 1 条 × 2 题 + c3 的 1 条 × 2 题 = 8
  expect(countPairs(cards, 'b1')).toBe(8)
})

test('只在同块内生成组合', () => {
  const cards = [card('c1', 'b1', [kp('k1')]), card('c2', 'b2', [kp('k2')])]
  expect(buildPairs(cards, 'b1')).toEqual([])
})

test('要点不与自己所属的卡配对', () => {
  const cards = [card('c1', 'b1', [kp('k1')]), card('c2', 'b1', [kp('k2')])]
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.every(p => p.ownerCardId !== p.targetCardId)).toBe(true)
  expect(pairs).toHaveLength(2)
})

test('已登记过的组合被跳过，避免重复人工确认', () => {
  const cards = [
    card('c1', 'b1', [kp('k1', ['c2'])]),
    card('c2', 'b1', [kp('k2')]),
  ]
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.find(p => p.keyPointId === 'k1' && p.targetCardId === 'c2')).toBeUndefined()
  expect(pairs).toHaveLength(1)
})

test('答过"否"的组合也被跳过，不重复询问', () => {
  const cards = [
    card('c1', 'b1', [kp('k1', [])]),
    card('c2', 'b1', [kp('k2')]),
  ]
  cards[0]!.keyPoints[0]!.confirmedIndependentOf = ['c2']
  const pairs = buildPairs(cards, 'b1')
  expect(pairs.find(p => p.keyPointId === 'k1' && p.targetCardId === 'c2')).toBeUndefined()
})

test('退役卡不参与组合', () => {
  const cards = [
    card('c1', 'b1', [kp('k1')]),
    { ...card('c2', 'b1', [kp('k2')]), retiredAt: '2026-01-01' },
  ]
  expect(buildPairs(cards, 'b1')).toEqual([])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/tools/review-pairs.test.ts`
Expected: FAIL —— 无法解析 `pairs.js`

- [ ] **Step 3: 实现 `tools/review/pairs.ts`**

```ts
import type { Card } from '../../src/lib/content/types.js'

export type Pair = {
  /** 要点所属的卡 */
  ownerCardId: string
  keyPointId: string
  keyPointText: string
  /** 被问"这条要点对它也成立吗"的那道题 */
  targetCardId: string
  targetQuestion: string
}

function liveCardsOf(cards: Card[], blockId: string): Card[] {
  return cards.filter(c => c.blockId === blockId && !c.retiredAt)
}

/** 组合总数（含已登记的），用于向审核者展示这个块的工作量 */
export function countPairs(cards: Card[], blockId: string): number {
  const live = liveCardsOf(cards, blockId)
  if (live.length < 2) return 0
  return live.reduce((sum, c) => sum + c.keyPoints.length * (live.length - 1), 0)
}

/** 待人工确认的组合：跳过已登记的，避免重复确认 */
export function buildPairs(cards: Card[], blockId: string): Pair[] {
  const live = liveCardsOf(cards, blockId)
  const out: Pair[] = []
  for (const owner of live) {
    for (const kp of owner.keyPoints) {
      for (const target of live) {
        if (target.id === owner.id) continue
        // 两类已决组合都要跳过。只跳过"是"的话，答过"否"的组合不留痕，
        // 每次重跑 CLI 都会原样再问一遍 —— 而重跑是常态（加新题、调阈值、中途退出）。
        if (kp.excludeAsDistractorFor.includes(target.id)) continue
        if (kp.confirmedIndependentOf.includes(target.id)) continue
        out.push({
          ownerCardId: owner.id,
          keyPointId: kp.id,
          keyPointText: kp.text,
          targetCardId: target.id,
          targetQuestion: target.question,
        })
      }
    }
  }
  return out
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/tools/review-pairs.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add tools/review/pairs.ts tests/tools/review-pairs.test.ts
git commit -m "feat(tools): 互斥检查的组合生成，判断单位是(要点,他题)"
```

---

### Task 11: 人工判定的写回

**Files:**
- Create: `tools/review/register.ts`
- Create: `tests/tools/review-register.test.ts`

人工确认"这条要点对那道题也成立"之后，要把结果写回源文件的 `excludeAsDistractorFor`。写回逻辑做成纯函数（字符串进、字符串出），这样可以单测，不需要碰文件系统。

- [ ] **Step 1: 写失败测试 `tests/tools/review-register.test.ts`**

```ts
import { registerDecision } from '../../tools/review/register.js'
import { parseCard } from '../../src/lib/content/parse.js'

const SRC = `---
id: c1
blockId: b1
relatedBlocks: []
question: 问题？
cardType: atomic
appliesTo: JDK 8+
frequency: mid
followUps: []
keyPoints:
  - id: kp-1
    text: 要点一
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/a
      locator: x
---

正文`

test('写回后源文件仍可解析，且登记生效', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2'])
})

test('答"否"写进 confirmedIndependentOf，不影响出题', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'independent')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual([])
  expect(r.card.keyPoints[0]!.confirmedIndependentOf).toEqual(['c2'])
})

test('是纯函数 —— 同一输入调用两次，第二次不带出第一次的结果', () => {
  const a = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const b = registerDecision(SRC, 'kp-1', 'c9', 'exclude')
  const ra = parseCard(a, 'x.md'); const rb = parseCard(b, 'x.md')
  expect(ra.ok && rb.ok).toBe(true)
  if (!ra.ok || !rb.ok) return
  expect(ra.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2'])
  expect(rb.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c9'])
})

test('重复登记同一目标后内容逐字节不变 —— diff 稳定', () => {
  const once = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const twice = registerDecision(once, 'kp-1', 'c2', 'exclude')
  expect(twice).toBe(once)
})

test('登记目标按字典序排列，便于 diff 审查', () => {
  let out = registerDecision(SRC, 'kp-1', 'c9', 'exclude')
  out = registerDecision(out, 'kp-1', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2', 'c9'])
})

test('无关字段不被改写 —— verifiedAt 不变成时间戳、url 不被加引号', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  expect(out).toContain('verifiedAt: 2026-09-18')
  expect(out).toContain('url: https://example.org/a')
  expect(out).not.toContain('T00:00:00')
})

test('要点 id 不存在时抛出明确错误', () => {
  expect(() => registerDecision(SRC, 'no-such-kp', 'c2', 'exclude')).toThrow(/no-such-kp/)
})

test('正文部分不被改动', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  expect(out.trimEnd().endsWith('正文')).toBe(true)
})

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/tools/review-register.test.ts`
Expected: FAIL —— 无法解析 `register.js`

- [ ] **Step 3: 实现 `tools/review/register.ts`**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/tools/review-register.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add tools/review/register.ts tests/tools/review-register.test.ts
git commit -m "feat(tools): 人工判定写回，钉 YAML 引擎 + 切断 gray-matter 缓存"
```

---

### Task 12: 块元数据与块名校验

**Files:**
- Create: `src/lib/content/block.ts`
- Create: `tests/lib/content/block.test.ts`
- Modify: `src/lib/content/audit.ts`

Task 4 写的 `checkBlockName` 目前是个**孤儿函数**——`Card` 里只有 `blockId`（`mysql/mvcc-undo` 这样的 slug），没有块的中文名，那条 B5 校验没有数据可查。块也确实需要独立的元数据：知识地图要显示名称，§2 的配额表要按块统计。

约定：每个块目录下放一个 `block.yml`。

- [ ] **Step 1: 写失败测试 `tests/lib/content/block.test.ts`**

```ts
import { parseBlock } from '../../../src/lib/content/block.js'

const SRC = `id: mysql/mvcc-undo
name: MVCC 与 Undo Log
category: mysql
status: wip
`

test('解析出块元数据', () => {
  const r = parseBlock(SRC, 'content/mysql/mvcc-undo/block.yml')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.block.name).toBe('MVCC 与 Undo Log')
  expect(r.block.category).toBe('mysql')
  expect(r.block.status).toBe('wip')
})

test('status 缺省为 wip —— 新块默认不受池容量校验', () => {
  const r = parseBlock('id: x\nname: 索引与执行计划\ncategory: mysql\n', 'content/x/block.yml')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.block.status).toBe('wip')
})

test('块名命中 B5 黑名单被拒', () => {
  const r = parseBlock(SRC.replace('MVCC 与 Undo Log', 'MySQL 基础'), 'content/x/block.yml')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('基础')
})

test('缺字段时报错带路径', () => {
  const r = parseBlock('id: x', 'content/x/block.yml')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('content/x/block.yml')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/lib/content/block.test.ts`
Expected: FAIL —— 无法解析 `block.js`

- [ ] **Step 3: 实现 `src/lib/content/block.ts`**

```ts
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
```

- [ ] **Step 4: 让 `auditLibrary` 接收块元数据并校验一致性**

在 `src/lib/content/audit.ts` 中，把签名改为接收第二个参数，并在函数体末尾追加检查：

```ts
export function auditLibrary(cards: Card[], blocks: Block[] = []): AuditResult {
```

在 return 之前追加：

```ts
  if (blocks.length > 0) {
    const declared = new Set(blocks.map(b => b.id))
    for (const c of cards) {
      if (!declared.has(c.blockId)) {
        errors.push(`卡 ${c.id} 的 blockId ${c.blockId} 没有对应的 block.yml`)
      }
    }
    const ids = new Set<string>()
    for (const b of blocks) {
      if (ids.has(b.id)) errors.push(`块 id 重复：${b.id}`)
      ids.add(b.id)
    }
  }
```

文件顶部加 `import type { Block } from './block.js'`。

- [ ] **Step 5: 运行全部内容测试**

Run: `pnpm vitest run tests/lib/content`
Expected: 全部 passed（既有测试因 `blocks` 有默认值而不受影响）

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/block.ts src/lib/content/audit.ts tests/lib/content/block.test.ts
git commit -m "feat(content): 块元数据与 B5 块名校验"
```

---

### Task 13: 互斥检查 CLI

**Files:**
- Create: `tools/review/recall.ts`
- Create: `tools/review/cli.ts`
- Create: `tests/tools/review-recall.test.ts`

设计文档 §4.3 的流程：**LLM 召回导向预筛 → 人工只确认被标出的（预计 5-10%）→ 漏网的靠报错闭环兜住**。这里用 LLM 是安全的，与 §9.1 被否决的双模型预审不同：预筛的失败模式是假阴性，而假阴性有报错闭环兜底；双模型预审的失败模式是把相关性错误系统性路由出人工队列，没有任何东西兜底。

召回逻辑做成接收「打分函数」的高阶函数，这样单测里注入假打分器，不需要真的调 LLM。

- [ ] **Step 1: 写失败测试 `tests/tools/review-recall.test.ts`**

```ts
import { screenPairs } from '../../tools/review/recall.js'
import type { Pair } from '../../tools/review/pairs.js'

const pairs: Pair[] = [
  { ownerCardId: 'c1', keyPointId: 'k1', keyPointText: 'B+ 树非叶子节点只存键', targetCardId: 'c2', targetQuestion: '为什么用 B+ 树？' },
  { ownerCardId: 'c1', keyPointId: 'k2', keyPointText: 'undo log 用于回滚', targetCardId: 'c2', targetQuestion: '为什么用 B+ 树？' },
]

test('只保留打分超过阈值的组合', async () => {
  const score = async (p: Pair) => (p.keyPointId === 'k1' ? 0.9 : 0.1)
  const flagged = await screenPairs(pairs, score, 0.5)
  expect(flagged.map(f => f.pair.keyPointId)).toEqual(['k1'])
})

test('召回导向：阈值调低会保留更多，不会漏掉高分项', async () => {
  const score = async () => 0.3
  expect(await screenPairs(pairs, score, 0.5)).toHaveLength(0)
  expect(await screenPairs(pairs, score, 0.2)).toHaveLength(2)
})

test('打分函数抛错时该组合被保留，不被静默丢弃', async () => {
  const score = async (p: Pair) => {
    if (p.keyPointId === 'k1') throw new Error('API 超时')
    return 0.1
  }
  const flagged = await screenPairs(pairs, score, 0.5)
  expect(flagged.map(f => f.pair.keyPointId)).toEqual(['k1'])
  expect(flagged[0]!.reason).toContain('打分失败')
})
```

第三条是有意的：召回导向意味着**宁可多报不可漏报**，打分失败必须落进人工队列，不能当成"不相关"扔掉。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/tools/review-recall.test.ts`
Expected: FAIL —— 无法解析 `recall.js`

- [ ] **Step 3: 实现 `tools/review/recall.ts`**

```ts
import type { Pair } from './pairs.js'

export type Flagged = {
  pair: Pair
  score: number
  reason: string
}

export type Scorer = (pair: Pair) => Promise<number>

/**
 * 召回导向预筛：宁可多报不可漏报。
 * 打分失败的组合一律保留进人工队列 —— 静默丢弃会让漏网项无人发现，
 * 而这正是双模型交叉预审被否决的那个失败模式（§9.1）。
 */
export async function screenPairs(
  pairs: Pair[],
  score: Scorer,
  threshold: number,
): Promise<Flagged[]> {
  const out: Flagged[] = []
  for (const pair of pairs) {
    try {
      const s = await score(pair)
      if (s >= threshold) out.push({ pair, score: s, reason: `相似度 ${s.toFixed(2)}` })
    } catch (e) {
      out.push({ pair, score: 1, reason: `打分失败，保留待人工确认 —— ${String(e)}` })
    }
  }
  return out
}
```

- [ ] **Step 4: 实现 `tools/review/cli.ts`**

```ts
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseCard } from '../../src/lib/content/parse.js'
import { buildPairs, countPairs } from './pairs.js'
import { screenPairs, type Scorer } from './recall.js'
import { registerDecision } from './register.js'
import type { Card } from '../../src/lib/content/types.js'

const blockId = process.argv[2]
if (!blockId) {
  console.error('用法: pnpm review:pairs <blockId> [--confirm]')
  process.exit(1)
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return walk(p)
    return p.endsWith('.md') ? [p] : []
  })
}

const fileOf = new Map<string, string>()
const cards: Card[] = []
for (const f of walk('content')) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) { cards.push(r.card); fileOf.set(r.card.id, f) }
}

const total = countPairs(cards, blockId)
const pending = buildPairs(cards, blockId)
console.log(`块 ${blockId}：组合总数 ${total}，其中未登记 ${pending.length} 组`)

// 占位打分器：按要点文本与目标题面的字符重合度粗筛。
// 接入真实 LLM 时替换此函数即可，screenPairs 的契约不变。
const scorer: Scorer = async (p) => {
  const a = new Set(p.keyPointText)
  const b = new Set(p.targetQuestion)
  const inter = [...a].filter(c => b.has(c)).length
  return inter / Math.max(a.size, 1)
}

const flagged = await screenPairs(pending, scorer, 0.35)
console.log(`预筛标出 ${flagged.length} 组待人工确认（${((flagged.length / Math.max(pending.length, 1)) * 100).toFixed(1)}%）`)

if (!process.argv.includes('--confirm')) {
  console.log('加 --confirm 进入逐条确认。')
  process.exit(0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
let registered = 0
let independent = 0
for (const [i, f] of flagged.entries()) {
  console.log(`\n[${i + 1}/${flagged.length}] ${f.reason}`)
  console.log(`  要点（来自 ${f.pair.ownerCardId}）：${f.pair.keyPointText}`)
  console.log(`  目标题：${f.pair.targetQuestion}`)
  const ans = (await rl.question('  这条要点对目标题也成立吗？[y/n/s 跳过/q 退出] ')).trim().toLowerCase()
  if (ans === 'q') break
  if (ans === 's') continue

  const file = fileOf.get(f.pair.ownerCardId)
  if (!file) { console.error(`  找不到源文件：${f.pair.ownerCardId}`); continue }

  // 两种答案都要落盘。只记"是"的话，答过"否"的组合下次重跑会原样再问一遍，
  // 而重跑是常态 —— 工具会反复消耗它本该保护的那 25-60 小时人工成果。
  const decision = ans === 'y' ? 'exclude' : 'independent'
  writeFileSync(file, registerDecision(readFileSync(file, 'utf8'), f.pair.keyPointId, f.pair.targetCardId, decision), 'utf8')
  if (decision === 'exclude') { registered++; console.log('  已登记互斥') }
  else { independent++; console.log('  已记录"不成立"，下次不再问') }
}
await rl.close()
console.log(`\n本轮：互斥 ${registered} 条，判定不成立 ${independent} 条。记得跑 pnpm content:audit。`)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/tools/review-recall.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add tools/review/recall.ts tools/review/cli.ts tests/tools/review-recall.test.ts
git commit -m "feat(tools): 互斥检查 CLI，召回导向预筛 + 逐条确认"
```

---

### Task 14: 审计 CLI 与 CI 接线

**Files:**
- Create: `tools/audit-cli.ts`
- Create: `.github/workflows/content.yml`
- Create: `content/.ids.lock`

把前面的纯函数接到真实文件系统和 CI 上。这是 `lib/content` 零 IO 设计的兑现处——读盘逻辑集中在这一个文件里。

- [ ] **Step 1: 实现 `tools/audit-cli.ts`**

```ts
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCard } from '../src/lib/content/parse.js'
import { parseBlock } from '../src/lib/content/block.js'
import { auditLibrary, checkIdLock } from '../src/lib/content/audit.js'
import type { Card } from '../src/lib/content/types.js'
import type { Block } from '../src/lib/content/block.js'

const CONTENT_DIR = 'content'
const LOCK_FILE = join(CONTENT_DIR, '.ids.lock')

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p, ext)
    return p.endsWith(ext) ? [p] : []
  })
}

const files = walk(CONTENT_DIR, '.md')
const cards: Card[] = []
const issues: string[] = []

for (const f of files) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) cards.push(r.card)
  else issues.push(...r.issues)
}

const blocks: Block[] = []
for (const f of walk(CONTENT_DIR, 'block.yml')) {
  const r = parseBlock(readFileSync(f, 'utf8'), f)
  if (r.ok) blocks.push(r.block)
  else issues.push(...r.issues)
}

const { errors } = auditLibrary(cards, blocks)
issues.push(...errors)

if (existsSync(LOCK_FILE)) {
  const locked = readFileSync(LOCK_FILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  issues.push(...checkIdLock(cards, locked))
}

if (process.argv.includes('--write-lock')) {
  // 卡 id 和要点 id 都要锁。spec §8.1 的 review_log.distractorIds 存的是
  // **要点 id**，§4.2 也写"互斥登记、漏点统计、干扰项引用都指向它" ——
  // 只锁卡 id 的话，要点改名/删除一样让历史日志悬空，而守卫看不见。
  const ids = [
    ...cards.map(c => `card:${c.id}`),
    ...cards.flatMap(c => c.keyPoints.map(kp => `kp:${c.blockId}/${kp.id}`)),
  ].sort()
  writeFileSync(LOCK_FILE, ids.join('\n') + '\n', 'utf8')
  console.log(`已写入 ${LOCK_FILE}（${ids.length} 个 id）`)
}

console.log(`解析 ${files.length} 张卡文件、${blocks.length} 个块`)
if (issues.length > 0) {
  console.error(`\n发现 ${issues.length} 个问题：`)
  for (const i of issues) console.error(`  - ${i}`)
  process.exit(1)
}
console.log('内容审计通过')
```

- [ ] **Step 2: 生成初始 lockfile**

Run: `pnpm content:audit --write-lock`
Expected: 输出解析到的卡数并写入 `content/.ids.lock`

- [ ] **Step 3: 创建 `.github/workflows/content.yml`**

```yaml
name: content
on:
  pull_request:
    paths: ['content/**', 'src/lib/content/**', 'tools/**']
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - name: 用 main 的 lockfile 做跨提交 id 守卫
        run: |
          set -euo pipefail
          if git rev-parse --verify origin/main >/dev/null 2>&1; then
            if git cat-file -e origin/main:content/.ids.lock 2>/dev/null; then
              git show origin/main:content/.ids.lock > /tmp/main.ids.lock
              cp /tmp/main.ids.lock content/.ids.lock
              echo "已取到 main 的 lockfile（$(wc -l < content/.ids.lock) 个 id）"
            else
              echo "main 上还没有 lockfile，跳过跨提交守卫（仅首次建库时允许）"
            fi
          else
            echo "::error::取不到 origin/main，跨提交守卫无法执行"
            exit 1
          fi
          pnpm content:audit
```

两个细节都是必须的：

**lockfile 从 `origin/main` 取，不用 PR 分支里那份**——否则作者改了 id 的同时更新 lockfile，守卫形同虚设。

**不能写成 `git show ... > content/.ids.lock || true`**。shell 的重定向**先截断目标文件再执行命令**，所以任何失败（网络、路径改名、权限）都会留下一个**空的** lockfile，而空 lockfile 让 `checkIdLock` 无事可做——守卫静默变成空操作，而 CI 是绿的。这类 fail-open 比没有守卫更危险：它给人一种被保护着的错觉。上面的写法先确认对象存在，取不到就显式失败。

- [ ] **Step 4: 本地验证审计确实会拦住不合格内容**

Run: `pnpm content:audit`
Expected: **失败并退出码 1**，报 `块 ... 的同块干扰项池不足：可用 0 条，下界 12`

这是**预期结果，不是 bug**：此刻 `content/` 里只有 Task 9 Step 6 生成的那一张占位卡，一个块里只有一张卡，池必然为 0。看到这条报错说明审计真的在工作。Task 15 填满试点块之后它才会转绿。

- [ ] **Step 5: Commit**

```bash
git add tools/audit-cli.ts .github/workflows/content.yml content/.ids.lock
git commit -m "feat(ci): 内容审计 CLI 与 CI 接线，lockfile 从 origin/main 取"
```

---

### Task 15: 单块试点 —— MySQL「MVCC 与 Undo Log」

**Files:**
- Create: `content/mysql/mvcc-undo/*.md`（5 张卡，每种 cardType 各一张）
- Create: `docs/superpowers/notes/2026-09-18-pilot-calibration.md`

设计文档 §10：内容轨的顺序是**审核工具 → 单块试点 → 按块批量生产**，跳过试点直接批量会在 1345 题的规模上放大流程缺陷。本任务是那个试点，目的有二：**校准真实单题工时**（§9.1 的 145-220 小时估算是推算出来的，没有实测过），以及**用五种 cardType 各跑一张**验证 schema 真的装得下。

- [ ] **Step 1: 创建块元数据 `content/mysql/mvcc-undo/block.yml`**

```yaml
id: mysql/mvcc-undo
name: MVCC 与 Undo Log
category: mysql
status: wip
```

两点：块名不能写成「MySQL 基础」这类，B5 黑名单会拒（Task 12）；`status: wip` 让本块暂不受干扰项池容量校验——**五张卡的试点本来就凑不满 12 条可用池**（5 张卡共约 13 条要点，对 3 要点的那张卡可用池只有 10 条）。真实的块有 15-25 张卡，填满后改成 `ready` 才开启该校验。

- [ ] **Step 2: 用脚手架生成五张卡**

```bash
pnpm content:new mysql/mvcc-undo enumeration
pnpm content:new mysql/mvcc-undo comparison
pnpm content:new mysql/mvcc-undo sequence
pnpm content:new mysql/mvcc-undo judgment
pnpm content:new mysql/mvcc-undo atomic
```

- [ ] **Step 3: 填写五张卡的真实内容，每张计时**

题目建议（覆盖五种题型，且都是 MVCC 块的真实高频题）：

| cardType | 题面 |
|---|---|
| `enumeration` | MySQL 的 undo log 有哪些作用？ |
| `comparison` | RC 和 RR 隔离级别下 ReadView 的生成时机有什么不同？ |
| `sequence` | 一条 update 语句执行时，undo log、redo log、binlog 的写入顺序是怎样的？ |
| `judgment` | RR 隔离级别下 MVCC 能完全避免幻读吗？ |
| `atomic` | InnoDB 默认的隔离级别是什么？ |

填写要求：每条要点的 `source` 必须指向英文一手资料（MySQL 官方手册或 InnoDB 源码），`locator` 精确到章节号或类#方法；要点须符合 §9.3 的 KP1-KP6。

**逐张记录实际耗时**，这是本任务的主要产出。

- [ ] **Step 4: 跑审计**

Run: `pnpm content:audit`
Expected: `内容审计通过`。若报干扰项池不足，说明 5 张卡撑不起池下界——这本身是有效发现，记进校准笔记。

- [ ] **Step 5: 跑互斥检查，记录实际组合数与确认耗时**

Run: `pnpm review:pairs mysql/mvcc-undo`
Expected: 输出待确认组合数。5 张卡 × 约 4 条要点 × 4 道其他题 ≈ 80 组

- [ ] **Step 6: 写校准笔记 `docs/superpowers/notes/2026-09-18-pilot-calibration.md`**

记录三件事，并与设计文档的估算对照：

```markdown
# 单块试点校准（MySQL / MVCC 与 Undo Log）

## 实测单题工时
| cardType | 题面 | 实际耗时 | 备注 |
|---|---|---|---|
| enumeration | undo log 的作用 | __ 分钟 | |
| comparison | RC/RR 的 ReadView 时机 | __ 分钟 | |
| sequence | 三种日志的写入顺序 | __ 分钟 | |
| judgment | RR 能否完全避免幻读 | __ 分钟 | |
| atomic | 默认隔离级别 | __ 分钟 | |

**均值 __ 分钟/题** vs §9.1 估算的 7-12 分钟。

## 互斥检查实测
- 组合数：__ （设计文档估算：单块约 1710，本块因只有 5 张卡故小得多）
- 人工确认耗时：__ 分钟
- 命中率：__ %（设计文档假设 5-10%）

## schema 是否装得下五种题型
逐型记录遇到的表达困难。

## 对 §9.1 估算的修正建议
若实测均值显著高于 12 分钟，145-220 小时的估算需上调，范围（§2 的 1345 题）应据此重新评估。
```

- [ ] **Step 7: Commit**

```bash
git add content/mysql/mvcc-undo docs/superpowers/notes
pnpm content:audit --write-lock
git add content/.ids.lock
git commit -m "content: MySQL MVCC 单块试点，五种 cardType 各一张 + 工时校准"
```

---

## 完成标准

- [ ] `pnpm test` 全绿
- [ ] `pnpm typecheck` 无错误
- [ ] `pnpm content:audit` 通过
- [ ] 五种 `cardType` 各有一张真实内容的卡通过全部校验
- [ ] 校准笔记里有实测工时，且与 §9.1 的 145-220 小时估算做过对照

**这个计划完成后，内容生产才可以开工。** 在此之前写的任何卡片都面临 schema 变更导致的返工风险——设计文档 §4.2 把这条标为"唯一有截止期限的改动"。

## 本计划明确不覆盖

| spec 章节 | 内容 | 归属 |
|---|---|---|
| §9.2 | 版本衰减的增量复核工具（订阅 release notes → 按 `appliesTo` 圈出受影响要点 → `verifiedAt` 超 18 个月进抽检队列） | 独立的维护工具计划。schema 里的 `appliesTo` 和 `verifiedAt` 已为它留好位置，但工具本身不在第一版关键路径上 |
| §9.3 KP1-KP4 | 要点粒度的人工判据 | 无法机器校验，属审核流程而非工具。Task 15 的试点会实际使用它们并在校准笔记里记录可操作性 |
| §4.3 | 干扰项分层抽取、选项集预生成 | 出题引擎计划（`lib/options`）。本计划只保证内容侧的前置约束：池容量下界、互斥登记 |
| §9 ① | `frequency` 的专家标注流程 | 内容运营流程，非工具。schema 已有该字段 |
| §4.3 | **题型配额的机器校验**（`enumeration ≤ 45%`、`sequence ≈ 20%` 等按大类的目标条数） | **本应覆盖而遗漏，现明确推迟。** spec 说"目标占比必须是配额，不是倡议"，而配额要在**大类填到一定规模后**才有统计意义——5 张卡的试点里算占比没有意义。等第一个大类完成时补一个 `content:quota` 命令。**风险自担**：在此之前，§4.3 记录的那三条把题库推向列举题的漂移力没有任何机制对抗，全靠作者自觉 |

## 后续计划的衔接

| 计划 | 依赖本计划的什么 |
|---|---|
| 排期引擎 | 无依赖，可并行开工 |
| 出题引擎 | `types.ts` 的 `Card` / `KeyPoint`、`excludeAsDistractorFor` 的语义 |
| 应用层 | 以上全部 |
| 支付与资质 | 无依赖，**且应在本计划的 Task 1 同一周启动**（4-8 周日历时间，串行） |
