# 服务层实现计划（计划 4a/5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `src/server`——同步回放（幂等/排序/时钟钳制/服务端日界）、今日队列装配与预生成选项集下发（唯一池装配入口）、刷一张卡的服务端流程、内容 upsert job、Next.js 基座与 GitHub OAuth 接线：纯核单测 + pglite 集成测试，HTTP 层薄壳。

**Architecture:** 业务逻辑全部落在**纯函数核**（`userId`/`today`/时钟全是参数），DB 与 HTTP 是薄适配层；依赖严格单向 `app → server → lib`（server 可 import lib/content、scheduler、options、mastery、entitlement，lib 之间互不 import 的纪律不变）。**服务端是 `plan[]` 的唯一写者**（§8.3）：DB 存绝对日期 + `planGeneratedAt` + `algoVersion`，进出 scheduler 用 `diffDays`/`addDays` 转偏移（计划 2 尾注的承诺）。选项集复现走确定性重算：`hashSeed(userId, cardId, reviewIndex)` 在服务端重放时逐条重建当时下发的变体（§4.3「服务端能校验客户端结果」的兑现）。

**Tech Stack:** Next.js 15（App Router，4a 只放 route handlers）· Drizzle ORM + pg · **@electric-sql/pglite**（进程内真 PG，集成测试不依赖 Docker）· date-fns + @date-fns/tz（锁定版本时区，**禁 Intl 判日界**，§8.3）· next-auth v4（GitHub OAuth）· vitest。ulid 已在依赖。

**Spec:** `docs/superpowers/specs/2026-09-15-interview-drill-design.md` §8 全部（8.1 存储结构、8.2 重放边界、8.3 离线三机制）、§4.3（预生成选项集/服务端抽取）、§5.5（重排四条件）、§5.7（维持模式）、§6（今日进度分母）、§7（架构与内容 job）、§11（server/sync 行）。计划 3 终审裁决（ROADMAP 与计划 3 文档末尾）：**免费用户 crossBlock 与 neighbor 两层都必须过 public 过滤，且装配必须收敛到唯一入口**。

**上游依赖:** 计划 1（lib/content parse/schema）、计划 2（lib/scheduler 全部导出）、计划 3（lib/options、lib/mastery、lib/entitlement）。当前基线 238 测试全绿。

---

## 全局约束（每个任务隐含遵守）

- **plan[] 唯一写者是服务端**（§8.3）：客户端只消费；断网答错不重排，只入队，回放时由服务端按序执行 §5.5。**复习提交绝不整跑 `schedule()`**（§8.1——发散根源），重排只走 `regenerateAfterFailure`（答错）或 `schedule()`（四条件中的设置/块集变更，仅在显式入口触发）。
- **幂等**：`review_log.submissionId` 唯一索引（§8.3）；重复提交（超时重试）必须被静默去重并计入返回的 `duplicated` 集合——不写第二条日志。
- **顺序与钳制**（§8.3）：按 `reviewedAt`（UTC 瞬时）排序重放；早于该卡上一条 → 钳到上一条 +1ms；晚于服务端 now + 5min → 钳到 now；被钳制的要在日志里留 `clockClamped` 标记。
- **localDate 只由服务端判定**：`localDateOf(instantMs, userTz)` 用 `@date-fns/tz` 的 TZDate，**禁止 Intl/DateTimeFormat**（ICU 漂移，§8.3）。客户端上报的日期只作展示参考，不落库。
- **DB 里的 plan 存绝对日期**（`date[]`）；进 scheduler 前 `diffDays(planDate, today)` 转偏移，落库前 `addDays(today, offset)` 转回。
- **唯一池装配入口**：`buildDistractorPools(card, allCards, ent)` 是全库唯一构造 `DistractorPools` 的地方，免费用户的 crossBlock **与 neighbor** 都过 `crossBlockPoolFor`（计划 3 终审裁决）。任何旁路构造都是缺陷。
- **纯核纪律**：`src/server` 的业务文件（time/replay/review/queue）不 import next/drizzle/pg——只 import lib/* 与自身模块；SQL 只出现在 `src/server/db/`，HTTP 只出现在 `src/app/api/`。集成测试经 `db/adapters.ts`。
- **algoVersion**：常量 `'v1'`（`src/server/version.ts`），随 `card_state` 与 `review_log` 落盘；判分/排期行为以它为版本边界（§8.1）。
- **`predictedCount` 按 §12 ④ 裁决弃用**：spec §8.1 列了该列，但 §12 ④ 明文废弃了预测环节（元认知偏差的采集依赖"先预测再作答"，该屏已被砍）——`review_log` 不设此列，此为执行期裁决，非遗漏。
- **时区口径的诚实边界**：`@date-fns/tz` 的 TZDate 内部仍经 `Intl.DateTimeFormat` 取 UTC 偏移——tz 数据仍来自运行时 ICU。本计划锁定的是 **API 口径与库版本**（不散落各处手写 Intl 判日界），ICU 数据漂移风险降级但未消除；彻底锁死需换 tz 编译数据包，记为 4b 前的待议项。
- **每卡判定按 cardType 分派**（§4.4/计划 3）：selection→`scoreSelection`、sequence→`scoreSequence`、judgment→`scoreJudgment`、atomic→`scoreAtomic`；s 更新走 `weightedS`（lib/scheduler）。
- 集成测试用 pglite（每测试文件独立实例，`tests/server/helpers.ts` 提供）；vitest include 已覆盖 `tests/**/*.test.ts`；tsconfig 开 `strict + noUncheckedIndexedAccess`；import 带 `.js` 后缀（lib 内部）。
- 新增依赖白名单（超出即违规）：`next` `react` `react-dom` `drizzle-orm` `pg` `next-auth` `date-fns` `@date-fns/tz`；dev：`drizzle-kit` `@types/react` `@types/react-dom` `@types/pg` `@electric-sql/pglite`。

## 数据与算法规格速览（实现时照抄，不要发明）

```
localDateOf(instant, tz)      TZDate(instant, tz) → 'YYYY-MM-DD'
clampReviewedAt(cand, last, now)  cand<last → {ms:last+1, clamped:'past'}
                               cand>now+5min → {ms:now, clamped:'future'}
                               否则 {ms:cand, clamped:null}
变体重算   variantAt(card, pools, sAtServe, userId, reviewIndex) =
           prepareOptions(card, pools, sAtServe, userId, reviewIndex, 1).variants[0]
判分       按 cardType 分派 mastery 四函数；ratio = num/den 交叉乘 failed(ratio)
状态迁移   消费 plan 中 ≤ today 的最早一项（逾期即吃掉最早那条）；
           s ← weightedS([score, ...旧最近2次])；reviewCount+1；
           sprint & failed(ratio) → regenerateAfterFailure(load=其他卡占用)
           maintenance(readyBy 空/过期) → maintenanceStep(k, ratio) → plan=[today+next]
           剩余偏移空 → phase done
回放       按 (cardId 分组, reviewedAt 升序) 逐条：submissionId 已存在 → duplicated；
           新的 → clamp → 判分 → 迁移 → 写 review_log + card_state
队列装配   cards' = entitledCards(ent, active)；states 转 offset；schedule(...)
           → 新计划转回绝对日期落盘；每张队列卡 prepareOptions(K=剩余次数, ≤6)
daily_session  (userId, localDate) 唯一；当天首次取队列时写 queueSize，之后不动
```

**§11 server/sync 行验收对照**：重复 submissionId 幂等（Task 6）；乱序回传按 reviewedAt 重算 s 正确（Task 6）；异常时钟被钳制（Task 4/6）；离线跨日界的 localDate 由服务端判定（Task 4/8）。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/server/version.ts` | `ALGO_VERSION = 'v1'` |
| `src/server/time.ts` | `localDateOf` / `clampReviewedAt`（纯） |
| `src/server/types.ts` | `Submission`（四型 payload 判别联合）/ `ReviewOutcome` / `CardSnapshot` / `Settings` |
| `src/server/replay.ts` | `scoreSubmission`（变体重算+四型判分）、`transitionCard`（消费/重排/终止/维持）、`applySubmissions`（纯核） |
| `src/server/queue.ts` | `buildDistractorPools`（**唯一装配入口**）、`buildDailyPayload`（纯核：装配+schedule+预生成） |
| `src/server/settings.ts` | `applySettingsChange`（§5.5 条件 2/3）、`applyBlockSelection`（条件 4：加减块） |
| `src/server/db/schema.ts` | drizzle 表：users/user_settings/blocks/cards/key_points/card_state/review_log/daily_session |
| `src/server/db/adapters.ts` | pglite/pg 双驱动工厂、建表、薄查询与事务 |
| `src/app/api/**/route.ts` | HTTP 薄壳（health/settings/blocks/sync/queue/review/auth） |
| `src/server/auth.ts` | NextAuth options + `requireUserId`（session → userId） |
| `src/server/content-upsert/run.ts` | content/ → DB 的 upsert job（tsx CLI） |
| `tests/server/*.test.ts` | 纯核单测 + pglite 集成 |

---

### Task 1: 基座——依赖、tsconfig、Next.js 最小壳、pglite 测试装置

**Files:**
- Modify: `package.json`（依赖与 scripts）、`tsconfig.json`、`.gitignore`
- Create: `next.config.ts`、`src/app/api/health/route.ts`、`tests/server/helpers.ts`

**Interfaces:**
- Produces: `createTestDb(): Promise<TestDb>`（helpers.ts——pglite 实例 + 建表 + 事后关闭；`TestDb = { db: NodePgDatabase | PgDatabase, pg: PGlite }`，后续集成任务全靠它）、`GET /api/health` 返回 `{ ok: true }`。

- [ ] **Step 0: 提交本计划文档**

```bash
git add docs/superpowers/plans/2026-09-21-server-layer.md
git commit -m "docs: 计划 4a（服务层）实施计划"
```

- [ ] **Step 1: 安装依赖**

```bash
pnpm add next@15 react react-dom drizzle-orm pg next-auth@4 date-fns @date-fns/tz
pnpm add -D drizzle-kit @types/react @types/react-dom @types/pg @electric-sql/pglite
```

- [ ] **Step 2: 配置文件**

`tsconfig.json` 的 `compilerOptions` 增补（其余不动）：

```json
"jsx": "preserve",
"lib": ["ES2022", "DOM"],
"paths": { "@/*": ["./src/*"] }
```

并在 `compilerOptions` 末尾加 `"plugins": [{ "name": "next" }]`。`include` 增加 `"next-env.d.ts"`（文件由 next dev 首跑生成，先手动建一个内容为 `/// <reference types="next" />` `/// <reference types="next/image-types/global" />` 的文件）。

`next.config.ts`：

```ts
import type { NextConfig } from 'next'
export default {
  // server 业务代码与 lib 一样跑在 Node 运行时；关闭边缘默认，保持同构一致性测试简单
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
} satisfies NextConfig
```

`.gitignore` 追加：`.next/`、`*.tsbuildinfo`。`package.json` scripts 追加：`"dev": "next dev"`、`"build": "next build"`。

- [ ] **Step 3: 最小路由壳 `src/app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export function GET() {
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: pglite 测试装置 `tests/server/helpers.ts`**

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 每个集成测试文件一个独立 pglite（真 PG 语义、进程内、无 Docker）。
 * 建表用 drizzle-kit 生成的 SQL（Task 2 产出），保证测试库结构与生产迁移同源。
 */
export async function createTestDb() {
  const pg = new PGlite()
  const db = drizzle(pg)
  const here = dirname(fileURLToPath(import.meta.url))
  const migrationsFolder = join(here, '..', '..', 'drizzle')
  if (await fs.stat(migrationsFolder).then(() => true).catch(() => false)) {
    await migrate(db, { migrationsFolder })
  }
  return { db, pg } as const   // 调用方 finally { await t.pg.close() }，不用 asyncDispose（ES2022 lib 无其类型）
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>   // db: pglite 驱动的 drizzle 实例（类型由推导自愈，不写死驱动类型名）
```

- [ ] **Step 5: 验证**

Run: `pnpm typecheck && pnpm vitest run tests/smoke.test.ts`
Expected: typecheck 无输出；smoke 全过（pglite 装置未被业务测试使用，先确保不破坏基线）。再跑 `pnpm exec next build 2>&1 | tail -3` 确认壳可构建。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore(server): Next.js 基座、依赖白名单落地与 pglite 测试装置"
```

---

### Task 2: drizzle schema 与迁移

**Files:**
- Create: `src/server/db/schema.ts`、`drizzle.config.ts`、`drizzle/`（生成物）
- Test: `tests/server/schema.test.ts`

**Interfaces:**
- Produces: 全部表的 drizzle 定义（后续 adapters 与所有集成任务消费）：`users` `userSettings` `blocks` `cards` `keyPoints` `cardState` `reviewLog` `dailySession`。`drizzle.config.ts` 指向 `src/server/db/schema.ts`，out = `drizzle/`。

- [ ] **Step 1: 写失败测试 `tests/server/schema.test.ts`**

```ts
import { createTestDb } from './helpers.js'
import { sql } from 'drizzle-orm'

test('迁移建出全部表与关键约束', async () => {
  const t = await createTestDb()
  try {
    const rows = await t.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema='public'`,
    )
    const names = rows.rows.map(r => r.table_name)
    for (const want of ['users', 'user_settings', 'blocks', 'cards', 'key_points',
      'card_state', 'review_log', 'daily_session']) {
      expect(names).toContain(want)
    }
    // submissionId 唯一索引是 §8.3 幂等的物理底座
    const idx = await t.db.execute<{ indexname: string }>(sql`
      select indexname from pg_indexes where tablename='review_log' and indexname like '%submission%'`)
    expect(idx.rows.length).toBeGreaterThan(0)
  } finally {
    await t.pg.close()
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/server/schema.test.ts`
Expected: FAIL —— 表不存在（migrations 目录尚无产出时建表为空）

- [ ] **Step 3: 实现 `src/server/db/schema.ts`**

```ts
import { pgTable, text, integer, timestamp, date, boolean, jsonb, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),                    // ULID，注册时铸造
  githubId: text('github_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 用户设置——review_log 的 readyByDateAtReview/dailyCapacityAtReview 由此快照 */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id),
  readyByDate: date('ready_by_date'),             // null = 未设 → 维持模式
  dailyCapacity: integer('daily_capacity').notNull().default(45),
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  plan: text('plan').notNull().default('free'),   // 'free' | 'paid'
  freeBlockIds: jsonb('free_block_ids').$type<string[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const blocks = pgTable('blocks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),           // 大类，干扰项池的分组键
})

export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  blockId: text('block_id').notNull().references(() => blocks.id),
  question: text('question').notNull(),
  cardType: text('card_type').notNull(),
  detail: text('detail').notNull(),
  followUps: jsonb('follow_ups').$type<string[]>().notNull().default([]),
  appliesTo: text('applies_to').notNull(),
  frequency: text('frequency').notNull(),
  conclusion: text('conclusion'),                 // 仅 judgment：'yes'|'no'|'depends'（Task 3）
  retiredAt: date('retired_at'),
})

export const keyPoints = pgTable('key_points', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  source: jsonb('source').$type<{ kind: string; url: string; locator: string }>().notNull(),
  public: boolean('public').notNull().default(false),
  order: integer('order'),
  excludeAsDistractorFor: jsonb('exclude_as_distractor_for').$type<string[]>().notNull().default([]),
  retiredAt: date('retired_at'),
}, t => [primaryKey({ columns: [t.cardId, t.id] })])

/**
 * plan 存绝对日期数组（§8.1 + 计划 2 尾注）；s 存分子分母（精确有理数）。
 * (userId, cardId) 主键。
 */
export const cardState = pgTable('card_state', {
  userId: text('user_id').notNull(),
  cardId: text('card_id').notNull(),
  phase: text('phase').notNull().default('new'),
  sNum: integer('s_num').notNull().default(0),
  sDen: integer('s_den').notNull().default(1),
  plan: jsonb('plan').$type<string[]>().notNull().default([]),   // 'YYYY-MM-DD' 绝对日期，升序
  phaseIndex: integer('phase_index').notNull().default(0),
  reviewCount: integer('review_count').notNull().default(0),
  planGeneratedAt: timestamp('plan_generated_at', { withTimezone: true }),
  algoVersion: text('algo_version').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.userId, t.cardId] }),
  index('card_state_user_idx').on(t.userId),
])

/** append-only，永不更新（§8.1）。submissionId 唯一索引 = 幂等键。 */
export const reviewLog = pgTable('review_log', {
  id: text('id').primaryKey(),                    // ULID
  submissionId: text('submission_id').notNull(),
  userId: text('user_id').notNull(),
  cardId: text('card_id').notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),  // UTC 瞬时，仅排序
  localDate: date('local_date').notNull(),        // 服务端判定（§8.3）
  correctChecked: integer('correct_checked').notNull(),
  wrongChecked: integer('wrong_checked').notNull(),
  keyPointsTotal: integer('key_points_total').notNull(),
  readyByDateAtReview: date('ready_by_date_at_review'),
  dailyCapacityAtReview: integer('daily_capacity_at_review').notNull(),
  distractorIds: jsonb('distractor_ids').$type<string[]>().notNull().default([]),
  clockClamped: text('clock_clamped'),            // null | 'past' | 'future'
  algoVersion: text('algo_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('review_log_submission_uidx').on(t.submissionId),
  index('review_log_user_card_idx').on(t.userId, t.cardId),
])

/** 今日进度分母：per-(用户, 本地日)，当天首次取队列时写定（§6/§8.1） */
export const dailySession = pgTable('daily_session', {
  userId: text('user_id').notNull(),
  localDate: date('local_date').notNull(),
  queueSize: integer('queue_size').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.localDate] })])
```

`drizzle.config.ts`：

```ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
})
```

- [ ] **Step 4: 生成迁移并验证**

```bash
pnpm exec drizzle-kit generate --name init
pnpm vitest run tests/server/schema.test.ts
```

Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle.config.ts drizzle tests/server && git commit -m "feat(server): drizzle schema——review_log 幂等索引与 plan 绝对日期存储"
```

---

### Task 3: content 扩 judgment 结论字段

**Files:**
- Modify: `src/lib/content/types.ts`、`src/lib/content/schema.ts`
- Test: `tests/lib/content/schema.test.ts`（追加）

**Interfaces:**
- Produces: `Card.conclusion?: 'yes' | 'no' | 'depends'`（仅 judgment 必填，其余型禁填）。计划 3 已把「judgment 结论无处承载」记为已知缺口，本任务兑现 §4.4 的「结论错→0 分」。

- [ ] **Step 1: 追加失败测试（tests/lib/content/schema.test.ts 末尾）**

```ts
test('judgment 必须携带结论字段，其余型禁填（§4.4 二段式）', () => {
  const base = {
    id: 'c1', blockId: 'b', relatedBlocks: [], question: 'q', detail: 'd',
    followUps: [], appliesTo: 'JDK 8+', frequency: 'mid' as const,
    keyPoints: [
      { id: 'k1', text: 'a', source: { kind: 'official-doc' as const, url: 'https://x', locator: 's1' },
        excludeAsDistractorFor: [], confirmedIndependentOf: [], verifiedAt: '2026-01-01', public: false },
      { id: 'k2', text: 'b', source: { kind: 'official-doc' as const, url: 'https://x', locator: 's2' },
        excludeAsDistractorFor: [], confirmedIndependentOf: [], verifiedAt: '2026-01-01', public: false },
    ],
  }
  const judgment = { ...base, cardType: 'judgment' as const }
  expect(() => cardSchema.parse(judgment)).toThrow()                    // 缺 conclusion
  expect(cardSchema.parse({ ...judgment, conclusion: 'depends' })).toBeTruthy()
  expect(() => cardSchema.parse({ ...judgment, conclusion: 'maybe' })).toThrow()
  const enumCard = { ...base, cardType: 'enumeration' as const, keyPoints: [...base.keyPoints, base.keyPoints[0]!] }
  enumCard.keyPoints[2] = { ...base.keyPoints[0]!, id: 'k3' }
  expect(() => cardSchema.parse({ ...enumCard, conclusion: 'yes' })).toThrow()  // 非 judgment 禁填
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**

`types.ts` 的 `Card` 增：

```ts
  /** 仅 cardType='judgment' 必填：正确结论（§4.4 二段式——结论错则本题 0 分） */
  conclusion?: 'yes' | 'no' | 'depends'
```

`schema.ts` 的 cardSchema 增 `conclusion: z.enum(['yes', 'no', 'depends']).optional()`，superRefine 追加：

```ts
    if (card.cardType === 'judgment' && card.conclusion === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conclusion'],
        message: 'judgment 型必须声明正确结论（yes/no/depends）' })
    }
    if (card.cardType !== 'judgment' && card.conclusion !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conclusion'],
        message: 'conclusion 仅 judgment 型允许' })
    }
```

试点块的 judgment 卡（`content/mysql/mvcc-undo/01M2YHWJHGBGZ57DWPS0FSTNG8.md`——RR 幻读，结论语义为"不会"）frontmatter 补 `conclusion: no`。

- [ ] **Step 4: 全量回归**：`pnpm test`（238 + 1 = 239）+ `pnpm typecheck`
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(content): judgment 结论字段——二段式判分的内容承载"`

---

### Task 4: time.ts——服务端日界与时钟钳制

**Files:**
- Create: `src/server/time.ts`、`src/server/version.ts`
- Test: `tests/server/time.test.ts`

**Interfaces:**
- Produces: `ALGO_VERSION`、`localDateOf(instantMs: number, ianaTz: string): LocalDate`、`clampReviewedAt(candidateMs, lastMs | null, serverNowMs): { ms: number; clamped: null | 'past' | 'future' }`、`MAX_CLOCK_SKEW_MS = 5 * 60_000`。

- [ ] **Step 1: 失败测试 `tests/server/time.test.ts`**

```ts
import { localDateOf, clampReviewedAt, MAX_CLOCK_SKEW_MS } from '../../src/server/time.js'
import { ALGO_VERSION } from '../../src/server/version.js'

test('ALGO_VERSION 钉死 v1', () => expect(ALGO_VERSION).toBe('v1'))

test('localDateOf：按用户时区判日历日——同一瞬时不同时区可差一天', () => {
  const instant = Date.UTC(2026, 8, 21, 17, 0)   // 2026-09-21T17:00Z
  expect(localDateOf(instant, 'Asia/Shanghai')).toBe('2026-09-22')   // +8 → 次日 01:00
  expect(localDateOf(instant, 'UTC')).toBe('2026-09-21')
  expect(localDateOf(instant, 'America/New_York')).toBe('2026-09-21')
})

test('localDateOf：跨 DST 也按当地日历日（@date-fns/tz，不经 Intl）', () => {
  // 美 DST 2026-11-01 结束（2:00 回拨）；当日 06:30Z 在纽约仍是 10-31 深夜？不——06:30Z=02:30 EDT=01:30 EST
  const t = Date.UTC(2026, 10, 1, 6, 30)
  expect(localDateOf(t, 'America/New_York')).toBe('2026-11-01')
})

test('localDateOf：非法时区抛错', () => {
  expect(() => localDateOf(0, 'Mars/Olympus')).toThrow()
})

test('clampReviewedAt：三条路径', () => {
  const now = 1_000_000
  expect(clampReviewedAt(now - 10, null, now)).toEqual({ ms: now - 10, clamped: null })
  expect(clampReviewedAt(5, 10, now)).toEqual({ ms: 11, clamped: 'past' })          // 早于上一条 → last+1ms
  expect(clampReviewedAt(now + MAX_CLOCK_SKEW_MS + 1, null, now)).toEqual({ ms: now, clamped: 'future' })
  expect(clampReviewedAt(now + 1000, null, now)).toEqual({ ms: now + 1000, clamped: null })  // 容差内
  expect(MAX_CLOCK_SKEW_MS).toBe(300_000)
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**

`src/server/version.ts`：`export const ALGO_VERSION = 'v1'`

`src/server/time.ts`：

```ts
import { TZDate } from '@date-fns/tz'
import type { LocalDate } from '../lib/scheduler/date.js'

/** §8.3：localDate 只由服务端判定；锁定版本的 tz 库（@date-fns/tz），禁 Intl。 */
export function localDateOf(instantMs: number, ianaTz: string): LocalDate {
  try {
    const d = new TZDate(instantMs, ianaTz)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  } catch {
    throw new Error(`非法 IANA 时区：${ianaTz}`)
  }
}

export const MAX_CLOCK_SKEW_MS = 5 * 60_000

/**
 * 异常时钟钳制（§8.3）：早于该卡上一条 → last+1ms（保持严格升序，排序稳定）；
 * 晚于服务端 now+容差 → now。被钳制的返回标记，落 review_log.clockClamped。
 */
export function clampReviewedAt(
  candidateMs: number,
  lastMs: number | null,
  serverNowMs: number,
): { ms: number; clamped: null | 'past' | 'future' } {
  if (lastMs !== null && candidateMs <= lastMs) {
    return { ms: lastMs + 1, clamped: 'past' }
  }
  if (candidateMs > serverNowMs + MAX_CLOCK_SKEW_MS) {
    return { ms: serverNowMs, clamped: 'future' }
  }
  return { ms: candidateMs, clamped: null }
}
```

（注：`TZDate` 对非法时区在不同版本可能不抛错而回退 UTC——测试若因此失败，改为先查 `Intl.supportedValuesOf('timeZone')` 白名单校验……**不**，那是 Intl。改为显式正则预校验 `^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$` + try/catch 双保险，以测试实际行为为准修实现而非改断言。）

- [ ] **Step 4: 验证**：`pnpm vitest run tests/server/time.test.ts` → 5 passed；`pnpm typecheck`
- [ ] **Step 5: Commit**：`git add src/server/time.ts src/server/version.ts tests/server/time.test.ts && git commit -m "feat(server): 服务端日界判定与异常时钟钳制"`

---

### Task 5: 判分核——变体重算与状态迁移（纯函数）

**Files:**
- Create: `src/server/types.ts`、`src/server/replay.ts`
- Test: `tests/server/replay.test.ts`

**Interfaces:**
- Consumes: lib/options（`prepareOptions`、`sameBlockPoolOf`、类型）、lib/mastery（四计分函数）、lib/scheduler（`weightedS`、`failed`、`regenerateAfterFailure`、`maintenanceStep`、`shouldMarkDone`、`diffDays`、`addDays`、`Rational`）。
- Produces:
  - `Submission = { submissionId: string; cardId: string; reviewedAtMs: number } & ({ kind: 'selection'; selected: number[] } | { kind: 'sequence'; order: number[] } | { kind: 'judgment'; conclusion: 0 | 1 | 2; selected: number[] } | { kind: 'atomic'; selected: number })`
  - `CardSnapshot = { cardId, blockId, cardType, frequency, keyPoints(id/text/public/excludeAsDistractorFor/retiredAt?/order?), conclusion? }`、`Settings = { readyByDate: LocalDate | null; dailyCapacity: number }`
  - `variantAt(card: CardSnapshot, pools: DistractorPools, sAtServe: Rational, userId: string, reviewIndex: number): PreparedVariant`
  - `transitionCard(state, score, ctx, recent: Rational[] = []): { state: CardState; outcome: ReviewOutcome }`——消费/加权/答错重排/维持进退/终止
  - `ReviewOutcome = { newS: Rational; nextReviewOffset: number | null; remainingReviews: number; replanned: boolean; maintenanceAdvanced: boolean }`（绝对日期转换在 HTTP 层）

- [ ] **Step 1: 失败测试 `tests/server/replay.test.ts`**（用与计划 3 同款夹具风格；关键断言）

```ts
import { variantAt, transitionCard, scoreSubmission } from '../../src/server/replay.js'
import type { CardSnapshot, Submission } from '../../src/server/types.js'
import { rat } from '../../src/lib/scheduler/types.js'
import { prepareOptions } from '../../src/lib/options/prepare.js'

const POOLS = { sameBlock: mk(10), crossBlock: mk(10), neighbor: [] } as const  // mk 同计划 3 测试 helper
const enumCard: CardSnapshot = {
  cardId: 'c1', blockId: 'b1', cardType: 'enumeration', frequency: 'mid',
  keyPoints: [
    { id: 'a', text: 'A', public: false, excludeAsDistractorFor: [] },
    { id: 'b', text: 'B', public: false, excludeAsDistractorFor: [] },
    { id: 'c', text: 'C', public: false, excludeAsDistractorFor: [] },
  ],
}

test('variantAt 与 prepareOptions 第 reviewIndex 份逐字节一致（确定性重算契约）', () => {
  const v = variantAt(enumCard, POOLS, rat(0, 1), 'u1', 3)
  const full = prepareOptions(enumCard as never, POOLS, rat(0, 1), 'u1', 3, 1)
  expect(v).toEqual(full.variants[0])
})

test('scoreSubmission：selection 按 correctIndices 判勾对/勾错', () => {
  const sub: Submission = { submissionId: 's1', cardId: 'c1', reviewedAtMs: 0, kind: 'selection', selected: [0, 2, 5] }
  const v = { optionTexts: ['A', 'x', 'B', 'x', 'x', 'C', 'x', 'x', 'x'],
              correctIndices: [0, 2, 5], distractorKeyPointIds: [] }
  const r = scoreSubmission(enumCard, v, sub)
  expect(r).toEqual({ score: rat(3, 3), correctChecked: 3, wrongChecked: 0 })
  // 勾错一条：selected 含 1（干扰）
  const r2 = scoreSubmission(enumCard, v, { ...sub, selected: [0, 1, 2] })
  expect(r2).toEqual({ score: rat(1, 3), correctChecked: 2, wrongChecked: 1 })
})

test('scoreSubmission：judgment 结论错 → 0 分（conclusion 0=yes 1=no 2=depends 映射）', () => {
  const card = { ...enumCard, cardType: 'judgment', conclusion: 'depends' } as CardSnapshot
  const v = { optionTexts: [], correctIndices: [0], distractorKeyPointIds: [] }
  const wrong = scoreSubmission(card, v, { submissionId: 's', cardId: 'c1', reviewedAtMs: 0, kind: 'judgment', conclusion: 0, selected: [0] })
  expect(wrong.score).toEqual(rat(0, 1))
})

test('transitionCard：答对消费今天项，s 加权，剩余遍数 = plan 长度', () => {
  // plan 偏移 [0, 2, 6]，today=0：消费 0 → 剩 [2,6]
  const st = mkState({ plan: [0, 2, 6], s: rat(1, 2), phase: 'learning' })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0 }), [])
  expect(r.state.plan).toEqual([2, 6])
  expect(r.outcome.remainingReviews).toBe(2)
  expect(r.outcome.replanned).toBe(false)
})

test('transitionCard：答错（ratio<1/2）触发 regenerateAfterFailure——新计划从明天起', () => {
  const st = mkState({ plan: [0, 5], s: rat(1, 3) })
  const r = transitionCard(st, rat(1, 3), mkCtx({ today: 0 }), [])
  expect(r.outcome.replanned).toBe(true)
  expect(r.state.plan[0]).toBeGreaterThan(0)   // 绝不今天
})

test('transitionCard：维持模式走 maintenanceStep，plan = [today + nextInDays]', () => {
  const st = mkState({ plan: [0], phase: 'learning', phaseIndex: 2 })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0, mode: 'maintenance' }), [])
  expect(r.state.phaseIndex).toBe(3)
  expect(r.state.plan).toEqual([15])           // MAINTAIN_INTERVALS[3] = 15（k: 2→3）
  expect(r.outcome.maintenanceAdvanced).toBe(true)
})

test('transitionCard：plan 清空 → phase done', () => {
  const st = mkState({ plan: [0], phase: 'learning' })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0 }), [])
  expect(r.state.phase).toBe('done')
})
```

（`mkState`/`mkCtx` 为本文件局部 helper：`mkState(over)` 造 lib/scheduler 的 `CardState`（cardId 'c1'、frequency 无关字段补默认）；`mkCtx(over)` 造完整 `TransitionCtx`——默认 `{ today: 0, mode: 'sprint', E: 19, settings: { readyByDate: '2030-01-01', dailyCapacity: 45 }, loadOf: () => new Map(), card: { id: 'c1', frequency: 'mid' } }`；`mk(n)` 造 n 条假要点池——按计划 3 测试文件的 `kp`/`poolOf` 风格内联。）

- [ ] **Step 2: 确认失败 → Step 3: 实现**

`src/server/types.ts`：

```ts
import type { LocalDate } from '../lib/scheduler/date.js'

export type ConclusionChoice = 0 | 1 | 2   // 0=yes 1=no 2=depends，与 UI 三选对齐

export type Submission = { submissionId: string; cardId: string; reviewedAtMs: number } & (
  | { kind: 'selection'; selected: number[] }
  | { kind: 'sequence'; order: number[] }
  | { kind: 'judgment'; conclusion: ConclusionChoice; selected: number[] }
  | { kind: 'atomic'; selected: number }
)

/** 判分与装配所需的最小卡快照（DB cards/key_points 行的投影） */
export type CardSnapshot = {
  cardId: string
  blockId: string
  cardType: 'enumeration' | 'comparison' | 'sequence' | 'judgment' | 'atomic'
  frequency: 'high' | 'mid' | 'low'
  keyPoints: Array<{
    id: string; text: string; public: boolean
    excludeAsDistractorFor: string[]   // OptionKeyPoint 必填字段，池装配直接消费
    retiredAt?: string; order?: number
  }>
  conclusion?: 'yes' | 'no' | 'depends'
}

export type Settings = { readyByDate: LocalDate | null; dailyCapacity: number }
```

`src/server/replay.ts`（完整实现）：

```ts
import { prepareOptions } from '../lib/options/prepare.js'
import type { DistractorPools, PreparedVariant } from '../lib/options/types.js'
import { scoreSelection, scoreSequence, scoreJudgment, scoreAtomic } from '../lib/mastery/score.js'
import { failed, regenerateAfterFailure, maintenanceStep, shouldMarkDone } from '../lib/scheduler/regenerate.js'
import { weightedS } from '../lib/scheduler/types.js'
import type { Rational, CardState } from '../lib/scheduler/types.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import type { CardSnapshot, Settings, Submission } from './types.js'

/**
 * 确定性重算（§4.3）：服务端按 (userId, cardId, reviewIndex) 重建当时下发的变体。
 *
 * sAtServe 语义（复现契约）：prepareOptions 用**单一 s** 生成全部 K 份变体，
 * 即客户端拿到的整套变体基于**取队列时**的 s。因此重算必须用批首快照的 s，
 * 绝不能用回放中已演化的 state.s——s 跨 layerCounts 档位会改变分层配额，
 * 抽中不同干扰项，变体就对不上了。
 */
export function variantAt(
  card: CardSnapshot, pools: DistractorPools, sAtServe: Rational,
  userId: string, reviewIndex: number,
): PreparedVariant {
  return prepareOptions(card as never, pools, sAtServe, userId, reviewIndex, 1).variants[0]!
}

export type Scored = { score: Rational; correctChecked: number; wrongChecked: number }

/**
 * 四型判分（§4.4，按 cardType 分派 mastery）。correctChecked/wrongChecked 以
 * \"能配 keyPointsTotal 解释历史\"为准记录：selection/judgment 记勾选数，
 * sequence/atomic 记换算值（score × n 四舍五入 / 1|0）。
 */
export function scoreSubmission(
  card: CardSnapshot, variant: PreparedVariant, submission: Submission,
): Scored {
  if (submission.kind === 'selection') {
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    return { score: scoreSelection(correct, wrong, variant.correctIndices.length), correctChecked: correct, wrongChecked: wrong }
  }
  if (submission.kind === 'sequence') {
    const presented = variant.optionTexts
    const userOrder = submission.order.map(i => presented[i]!)
    const canonical = variant.correctIndices.map(i => presented[i]!)   // 计划 3 修复后的语义
    const score = scoreSequence(userOrder, canonical)
    const n = variant.correctIndices.length
    return { score, correctChecked: Math.round((score.num * n) / score.den), wrongChecked: n - Math.round((score.num * n) / score.den) }
  }
  if (submission.kind === 'judgment') {
    const want = { yes: 0, no: 1, depends: 2 }[card.conclusion!]!
    const conclusionCorrect = submission.conclusion === want
    const correct = submission.selected.filter(i => variant.correctIndices.includes(i)).length
    const wrong = submission.selected.length - correct
    const points = scoreSelection(correct, wrong, variant.correctIndices.length)
    return {
      score: scoreJudgment(conclusionCorrect, points),
      correctChecked: conclusionCorrect ? correct : 0,
      wrongChecked: conclusionCorrect ? wrong : variant.correctIndices.length,
    }
  }
  const hit = variant.correctIndices.includes(submission.selected)
  return { score: scoreAtomic(hit), correctChecked: hit ? 1 : 0, wrongChecked: hit ? 0 : 1 }
}

export type TransitionCtx = {
  /** 相对今天的天偏移域（DB 绝对日期的转换在 adapters） */
  today: number
  mode: 'sprint' | 'maintenance'
  /** 偏移域末次目标日：调用方换算 E = max(0, diffDays(readyByDate, todayAbs) - bufferOf(R)) */
  E: number
  settings: Settings
  /** 其他卡的占用图（不含本卡）——regenerateAfterFailure 的 RegenContext 契约 */
  loadOf: (cardId: string) => Map<number, number>
  /** 本卡快照（答错重排只需要 SchedulableCard 形状） */
  card: { id: string; frequency: 'high' | 'mid' | 'low' }
}

export type ReviewOutcome = {
  newS: Rational
  nextReviewOffset: number | null
  remainingReviews: number
  /** sprint 答错触发了 regenerateAfterFailure（§6 UI 必须明说"计划已重排"） */
  replanned: boolean
  /** 维持模式例行推进（与 replanned 互斥——UI 文案不同） */
  maintenanceAdvanced: boolean
}

/**
 * 状态迁移（§8.1 刷一张卡）：消费计划当前项 → s 加权 →
 * sprint 答错走 regenerateAfterFailure（从明天起）；
 * maintenance 走 maintenanceStep；plan 空 → done。
 * 纯偏移域运算，recent 由调用方从 review_log 带入（最近 2 次得分，新→旧）。
 */
export function transitionCard(
  state: CardState,
  score: Rational,
  ctx: TransitionCtx,
  recent: Rational[] = [],
): { state: CardState; outcome: ReviewOutcome } {
  // 1. 消费 ≤ today 的最早一项；无（意外提交）也消费最早项，防御
  const consumeIdx = state.plan.length > 0
    ? Math.max(0, state.plan.findIndex(d => d <= ctx.today))
    : -1
  const plan = consumeIdx >= 0
    ? state.plan.filter((_, i) => i !== consumeIdx)
    : state.plan   // 空计划提交：维持现状不崩（调用方不该传，纯核防御）

  // 2. s ← 最近 3 次 3:2:1 加权（新 → 旧）
  const newS = weightedS([score, ...recent.slice(0, 2)])

  // 3. 重排 / 维持
  let nextPlan = plan
  let replanned = false
  let maintenanceAdvanced = false
  let phase = state.phase
  let phaseIndex = state.phaseIndex
  if (ctx.mode === 'sprint' && failed(score)) {
    const r = regenerateAfterFailure(ctx.card, { ...state, s: newS, plan }, {
      E: ctx.E, load: ctx.loadOf(state.cardId), capacity: ctx.settings.dailyCapacity,
    })
    nextPlan = r.plan
    replanned = true
  } else if (ctx.mode === 'maintenance') {
    const step = maintenanceStep(phaseIndex, score)
    phaseIndex = step.k
    nextPlan = [ctx.today + step.nextInDays]
    maintenanceAdvanced = true
  }

  // 4. 终止
  if (shouldMarkDone(nextPlan)) phase = 'done'

  const nextState: CardState = {
    ...state, s: newS, plan: nextPlan, phase, phaseIndex, reviewCount: state.reviewCount + 1,
  }
  return {
    state: nextState,
    outcome: {
      newS, nextReviewOffset: nextPlan[0] ?? null, remainingReviews: nextPlan.length,
      replanned, maintenanceAdvanced,
    },
  }
}
```

- [ ] **Step 4: 验证**：`pnpm vitest run tests/server/replay.test.ts` → 7 passed；typecheck
- [ ] **Step 5: Commit**：`git add src/server/types.ts src/server/replay.ts tests/server/replay.test.ts && git commit -m "feat(server): 判分核——确定性变体重算、四型判分、状态迁移"`

---

### Task 6: 回放 applySubmissions 与 DB 适配（幂等/排序/钳制）

**Files:**
- Create: `src/server/db/adapters.ts`、`src/app/api/sync/route.ts`
- Modify: `src/server/replay.ts`（追加 `applySubmissions` 纯核）
- Test: `tests/server/sync.test.ts`（pglite 集成）

**Interfaces:**
- Produces: `applySubmissions(subs, snapshot, ctx): { results: ReviewOutcome[]; duplicated: string[] }`（纯核：按 cardId 分组、reviewedAt 升序、逐条钳制判分迁移）；adapters：`loadUserContext(db, userId, today)`、`persistReview(db, ...)`（事务：INSERT review_log + UPSERT card_state）、`recentScoresOf(db, userId, cardId, n)`；`POST /api/sync`。

- [ ] **Step 1: 失败测试 `tests/server/sync.test.ts`**（pglite；夹具：seed 1 用户 + 1 块 3 卡 + settings）

```ts
test('重复 submissionId 幂等：重试不写第二条日志，duplicated 上报（§11）', async () => {
  const t = await seedDb()   // helpers：建库 + 用户 u1 + enum 卡 c1（3 要点）+ settings(readyBy=+21d)
  const sub = mkSelection('sub-1', 'c1', [0, 1, 2])     // 全对
  const r1 = await syncViaApi(t, 'u1', [sub])
  const r2 = await syncViaApi(t, 'u1', [sub])           // 超时重试
  expect(r2.duplicated).toEqual(['sub-1'])
  const logs = await t.db.execute(sql`select count(*)::int as n from review_log`)
  expect(logs.rows[0]!.n).toBe(1)
  expect(r1.results[0]!.newS.num).toBeGreaterThan(0)
})

test('乱序回传按 reviewedAt 排序重放，s 正确（§11）', async () => {
  const t = await seedDb()
  // 先差后好 vs 先好后差，加权不同
  const a = mkSelection('s-a', 'c1', [0], 1_000)        // 1/3
  const b = mkSelection('s-b', 'c1', [0, 1, 2], 2_000)  // 3/3
  const r = await syncViaApi(t, 'u1', [b, a])           // 乱序传入
  const rows = await t.db.execute<{ reviewed_at: string }>(sql`select reviewed_at from review_log order by reviewed_at`)
  expect(rows.rows.map(x => x.reviewed_at)).toHaveLength(2)
  // 先差(1/3,旧)后好(3/3,新) → s = weightedS([3/3, 1/3]) = 11/15（乱序传入结果必须等价于按时序）
  const st = await t.db.execute<{ s_num: number; s_den: number }>(sql`select s_num, s_den from card_state where card_id='c1'`)
  expect(`${st.rows[0]!.s_num}/${st.rows[0]!.s_den}`).toBe('11/15')
})

test('异常时钟被钳制并留痕（§11）', async () => {
  const t = await seedDb()
  const future = mkSelection('s-f', 'c1', [0, 1, 2], SERVER_NOW + 60 * 60_000)
  await syncViaApi(t, 'u1', [future])
  const rows = await t.db.execute<{ clock_clamped: string }>(sql`select clock_clamped from review_log`)
  expect(rows.rows[0]!.clock_clamped).toBe('future')
})

test('离线跨日界：localDate 由服务端按用户时区判定（§11）', async () => {
  const t = await seedDb({ tz: 'Asia/Shanghai' })
  // UTC 2026-09-21T17:00 = 上海 09-22：客户端以为自己刷的是 21 号
  const sub = mkSelection('s-tz', 'c1', [0, 1, 2], Date.UTC(2026, 8, 21, 17, 0))
  const r = await syncViaApi(t, 'u1', [sub], { serverNow: Date.UTC(2026, 8, 21, 18, 0) })
  const rows = await t.db.execute<{ local_date: string }>(sql`select local_date from review_log`)
  expect(rows.rows[0]!.local_date).toBe('2026-09-22')
})

test('答错入队离线重放：服务端统一重排，plan 从明天起（§8.3）', async () => {
  const t = await seedDb({ withPlan: true })   // c1 有 plan=[今天, +5]
  const bad = mkSelection('s-x', 'c1', [], 1_000)       // 空勾（客户端应拦；服务端也要稳）
  const r = await syncViaApi(t, 'u1', [bad])
  const st = await t.db.execute<{ plan: string[] }>(sql`select plan from card_state where card_id='c1'`)
  expect(st.rows[0]!.plan[0]!).not.toBe(todayIso(t))    // 绝不今天
})
```

（`seedDb`/`syncViaApi`/`mkSelection` 为本文件 helper：seedDb 建 pglite + 迁移 + 插入夹具数据；syncViaApi 直接调 `syncHandler(db, userId, subs, { serverNow })`——**纯函数入口而非 HTTP**。route 在本任务先落为薄壳，鉴权用开发期 `x-user-id` 头读取 userId，Task 11 的 `requireUserId` 接线后替换——测试全程绕过 HTTP。）

- [ ] **Step 2: 确认失败 → Step 3: 实现**

`replay.ts` 追加（纯核）：

```ts
export function applySubmissions(
  subs: Submission[],
  snapshot: { cards: Map<string, CardSnapshot>; states: Map<string, CardState>; recents: Map<string, Rational[]> },
  ctx: { userId: string; today: number; serverNowMs: number; settings: Settings;
          poolsOf: (cardId: string) => DistractorPools; loadOf: (cardId: string) => DayLoad },
): { results: ReviewOutcome[]; duplicated: string[] } {
  // 按 cardId 分组 → 组内 reviewedAtMs 升序 → 逐条：
  //   submissionId 已在 DB 或组内累积集合 → duplicated，跳过
  //   clampReviewedAt(cand, 组内 last(钳后), serverNow)
  //   变体重算：variantAt(card, poolsOf(cardId), **快照 s**, userId, **快照 reviewCount + j**)
  //     ——快照 = 本批开始时的 DB 状态；j = 该卡本批内第几条（0 起）。
  //     prepareOptions 生成 K 份变体用同一 s（取队列时），种子为 base+i，
  //     所以第 j 次复习的变体 = (快照 s, 快照 reviewCount + j)。绝不用演化中的 s。
  //   localDate 判定在 route 层（纯核收 serverNowMs 与预判好的 tz 结果由调用方注入）
  //   scoreSubmission → transitionCard（recent 从快照 recents 顺延）→ 收集
  // 返回的 LogRow 逐条带：reviewedAtMs(钳后)/localDate/score/correctChecked/
  //   wrongChecked/keyPointsTotal/distractorIds/clockClamped——route 据此写 review_log。
}
```

`db/adapters.ts`：pglite/pg 双驱动（`drizzle(pg)`/`drizzle-PGlite` 由调用方传入 db 实例，adapters 只写查询）；`syncTransaction(db, ...)`：`INSERT review_log ... ON CONFLICT (submission_id) DO NOTHING RETURNING id` 判定重复，再 UPSERT card_state（`onConflictDoUpdate`）。

`src/app/api/sync/route.ts`：`requireUserId(request)` → `serverNow = Date.now()` → `localDate` 判定（time.ts）→ `applySubmissions` → 事务落库 → `{ results, duplicated }`。

- [ ] **Step 4: 验证**：`pnpm vitest run tests/server/sync.test.ts` → 5 passed；全量 + typecheck
- [ ] **Step 5: Commit**：`git add src/server tests/server src/app && git commit -m "feat(server): 同步回放——幂等、排序重放、时钟钳制、服务端日界"`

---

### Task 7: 唯一池装配入口 buildDistractorPools

**Files:**
- Create: `src/server/queue.ts`
- Test: `tests/server/queue-pools.test.ts`

**Interfaces:**
- Produces: `buildDistractorPools(target: CardSnapshot, all: CardSnapshot[], ent: Entitlement, categories: Map<string, string>): DistractorPools`——**全库唯一**构造点。同块层 = `sameBlockPoolOf`（同块必已解锁）；跨块层 = 同大类其他块要点过 `crossBlockPoolFor`；neighbor = 相邻大类（categories 传入大类邻接序）过 `crossBlockPoolFor`。

- [ ] **Step 1: 失败测试**（复用计划 3 验收夹具形状：b1/b2 解锁、b3 未解锁、b3 半 public；**夹具含两个大类** cat-a（b1/b2/b3）与 cat-b（相邻块），categories Map 按显式顺序传入——neighbor 层非空且顺序确定，杜绝空遍历恒真）

```ts
test('免费用户：crossBlock 与 neighbor 两层都过 public（终审裁决的物理保证）', () => {
  const { all, ent, categories } = mkFixture()   // b3 未解锁、含非 public 要点
  const pools = buildDistractorPools(cardOf('b1-c0'), all, ent, categories)
  for (const p of pools.crossBlock) expect(p.public || ent.plan === 'paid').toBe(true)
  for (const p of pools.neighbor) expect(p.public || ent.plan === 'paid').toBe(true)
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && p.public)).toBe(true)   // public 仍要进来
})

test('同块层不过 public（块已解锁，语料本来可见）', () => {
  const { all, ent, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf('b1-c0'), all, ent, categories)
  expect(pools.sameBlock.some(p => !p.public)).toBe(true)
})

test('互斥登记在装配层不过滤（drawDistractors 负责过滤）——职责分离', () => {
  const { all, ent, categories } = mkFixture({ withExclusion: true })
  const pools = buildDistractorPools(cardOf('b1-c0'), all, ent, categories)
  expect(pools.crossBlock.some(p => p.excludeAsDistractorFor.includes('b1-c0'))).toBe(true)
})

test('付费用户：跨块层含未解锁块的非 public 要点（他买了）', () => {
  const { all, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf('b1-c0'), all, makePaidEntitlement(), categories)
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && !p.public)).toBe(true)
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**（`sameBlockPoolOf` + `crossBlockPoolFor` 的组合，约 30 行：目标块 → 同块层；同大类他块（categories 给 blockId→category 映射，排除本块）→ crossBlock 过滤；相邻大类 = categories 值序列中下一项 → neighbor 过滤）。
- [ ] **Step 4: 验证**：4 passed；typecheck
- [ ] **Step 5: Commit**：`git add src/server/queue.ts tests/server/queue-pools.test.ts && git commit -m "feat(server): 唯一池装配入口——免费层 crossBlock/neighbor 双 public 过滤"`

---

### Task 8: buildDailyPayload——今日队列与预生成下发（集成）

**Files:**
- Modify: `src/server/queue.ts`（追加）、`src/server/db/adapters.ts`
- Create: `src/app/api/queue/route.ts`
- Test: `tests/server/queue.test.ts`

**Interfaces:**
- Produces: `buildDailyPayload(deps): Promise<DailyPayload>`，`DailyPayload = { today: LocalDate; queue: QueueItem[]; prepared: PreparedOptions[]; progress: { done: number; total: number } }`。新计划落盘（绝对日期 + planGeneratedAt + algoVersion）；`daily_session` 当天首次写定 queueSize。

- [ ] **Step 1: 失败测试**（pglite；免费用户夹具：2 解锁块 × 5 卡 + 1 未解锁块）

```ts
test('端到端：免费用户取队列——选项集只含可见语料（§11 server 侧泄露验收）', async () => {
  const t = await seedQueueFixture()   // 夹具卡全部为 enumeration 型（选项恒 9；分型覆盖在计划 3 验收）
  const p = await buildDailyPayload(mkDeps(t, 'u-free'))
  expect(p.queue.length).toBeGreaterThan(0)
  const forbidden = 非public要点文本集(t, 'b-lock')
  for (const prep of p.prepared) for (const v of prep.variants) {
    expect(v.optionTexts).toHaveLength(9)
    for (const text of v.optionTexts) expect(forbidden.has(text)).toBe(false)
  }
})

test('daily_session：当天首次写定 queueSize，第二次取队列分母不变（§6）', async () => {
  const t = await seedQueueFixture()
  const d = mkDeps(t, 'u-free')
  const p1 = await buildDailyPayload(d)
  // 刷掉一张后再取
  await submitOne(t, 'u-free', p1.queue[0]!.cardId)
  const p2 = await buildDailyPayload(d)
  expect(p2.progress.total).toBe(p1.progress.total)
})

test('plan-once：当天重复取队列不重算已有计划（I4）', async () => {
  const t = await seedQueueFixture()
  const d = mkDeps(t, 'u-free')
  await buildDailyPayload(d)
  const after1 = await t.db.execute<{ n: number }>(sql`
    select count(*)::int as n from card_state where plan_generated_at is not null`)
  await buildDailyPayload(d)
  const after2 = await t.db.execute<{ n: number }>(sql`
    select count(*)::int as n from card_state where plan_generated_at is not null`)
  expect(after2.rows[0]!.n).toBe(after1.rows[0]!.n)   // 计划数与时间戳都不变
})

test('未设就绪日：维持模式——无 sprint 计划落盘，队列 = 无计划新卡首次曝光（§5.7）', async () => {
  const t = await seedQueueFixture({ readyBy: null })   // 夹具：5 张 new 卡
  const p = await buildDailyPayload(mkDeps(t, 'u-free'))
  expect(p.queue).toHaveLength(5)
  expect(p.queue.every(q => q.reason === 'due')).toBe(true)
  const n = await t.db.execute<{ n: number }>(sql`
    select count(*)::int as n from card_state where plan_generated_at is not null`)
  expect(n.rows[0]!.n).toBe(0)   // 维持模式不生成冲刺计划
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**（`src/server/queue.ts` 追加）：

```ts
import { schedule, reservedLoadOf } from '../lib/scheduler/schedule.js'
import { prepareOptions } from '../lib/options/prepare.js'
import { entitledCards } from '../lib/entitlement/entitlement.js'
import { diffDays, addDays } from '../lib/scheduler/date.js'
import { ALGO_VERSION } from './version.js'
// ...类型与 buildDistractorPools 已在 Task 7

export type DailyPayload = {
  today: LocalDate
  mode: 'sprint' | 'maintenance'
  queue: Array<{ cardId: string; reason: 'overdue' | 'due' }>
  /** PreparedOptions 含顶层 degradedTo——server 对 'neighbor' 记告警日志（终审裁决） */
  prepared: PreparedOptions[]
  progress: { done: number; total: number }
}

/** CardSnapshot → SchedulableCard（schedule 的最小输入） */
const toSchedulable = (c: CardSnapshot) => ({ id: c.cardId, frequency: c.frequency })

/**
 * 今日队列装配（§6/§4.3）：entitlement 过滤 → schedule（plan-once，含
 * reservedLoad——已有计划卡占容量，§5.1）→ 新计划转回绝对日期落盘 →
 * 每张队列卡预生成 K 份变体 → daily_session 定分母。
 * deps 注入全部 IO（纯核可单测，集成测试经 pglite）。
 */
export async function buildDailyPayload(deps: {
  userId: string
  loadSettings(): Promise<{ settings: Settings & { timezone: string }; ent: Entitlement }>
  loadCards(): Promise<{ cards: CardSnapshot[]; categories: Map<string, string> }>
  loadStates(userId: string): Promise<CardState[]>   // 绝对日期，函数内转偏移
  persistPlans(userId: string, today: LocalDate, plans: Array<{ cardId: string; plan: LocalDate[] }>): Promise<void>
  ensureDailySession(userId: string, today: LocalDate, queueSize: number): Promise<number>   // 返回当天 total
  countTodayDone(userId: string, today: LocalDate): Promise<number>
  serverNowMs: number
}): Promise<DailyPayload> {
  const { userId } = deps
  const { settings, ent } = await deps.loadSettings()
  const today = localDateOf(deps.serverNowMs, settings.timezone)
  const { cards, categories } = await deps.loadCards()
  const entitled = entitledCards(ent, cards).map(toSchedulable)   // 先过滤（需 blockId）再投影
  const dbStates = await deps.loadStates(userId)
  const offsetStates = dbStates.map(s => ({ ...s, plan: s.plan.map(d => diffDays(d, today)) }))
  const result = schedule(
    entitled, offsetStates, settings.readyByDate, settings.dailyCapacity, today,
    reservedLoadOf(offsetStates),   // §5.1：已有计划的卡（含已消费剩余项）占容量
  )
  // 新计划落盘（绝对日期 + planGeneratedAt + algoVersion）
  if (result.plans.size > 0) {
    await deps.persistPlans(userId, today, [...result.plans].map(([cardId, offsets]) => ({
      cardId, plan: offsets.map(o => addDays(today, o)),
    })))
  }
  // 预生成：K = 本次新计划长度，否则存量剩余（fresh 卡走新计划——阶梯 5-6 项）
  const prepared = result.todayQueue.map(({ cardId }) => {
    const card = cards.find(c => c.cardId === cardId)!
    const st = offsetStates.find(s => s.cardId === cardId)
    const pools = buildDistractorPools(card, cards, ent, categories)
    const k = result.plans.get(cardId)?.length ?? st?.plan.length ?? 1
    return prepareOptions(card as never, pools, st?.s ?? { num: 0, den: 1 }, userId, st?.reviewCount ?? 0, Math.min(k, 6))
  })
  const total = await deps.ensureDailySession(userId, today, result.todayQueue.length)
  const done = await deps.countTodayDone(userId, today)
  return { today, mode: result.mode, queue: result.todayQueue, prepared, progress: { done, total } }
}
```
- [ ] **Step 4: 验证**：`pnpm vitest run tests/server/queue.test.ts` → 4 passed；全量 + typecheck
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(server): 今日队列装配——schedule×prepareOptions×唯一池入口×daily_session"`

---

### Task 9: 刷一张卡的完整流程（review 端点）

**Files:**
- Create: `src/app/api/review/route.ts`
- Modify: `src/server/db/adapters.ts`
- Test: `tests/server/review.test.ts`

**Interfaces:**
- Produces: `POST /api/review`（在线路径）：判分 → 落 review_log/card_state → 返回 `{ score: {num,den}, newS, nextReviewDate, remainingReviews, remainingPlan: LocalDate[], replanned, maintenanceAdvanced, feedback: { correctChecked, wrongChecked, missed } }`（§6 屏②数据：漏了几条/错勾几条、圆点序列 = remainingPlan 绝对日期）。断网路径不设此端点——客户端入队走 `/api/sync`（§8.3）。在线路径的变体重算同样用**提交前 DB 快照的 s 与 reviewCount**（与 /api/sync 同一复现口径；取队列后 s 演化导致的跨档漂移是已知边界，见「与后续计划的衔接」）。

- [ ] **Step 1: 失败测试**（pglite；复用 sync 夹具）

```ts
test('在线刷一张卡：判分落库，返回 §6 屏②所需全部字段', async () => {
  const t = await seedDb({ withPlan: true, withQueue: true })
  const r = await reviewViaApi(t, 'u1', mkSelection('r-1', 'c1', [0, 1], 1_000))   // 2/3
  expect(r.score).toEqual({ num: 2, den: 3 })
  expect(r.feedback.wrongChecked).toBe(0)
  expect(typeof r.remainingReviews).toBe('number')
  expect(Array.isArray(r.remainingPlan)).toBe(true)   // 圆点序列（绝对日期）
})

test('答对不重排（I4）；答错重排且 replanned=true + 圆点换新', async () => {
  const t = await seedDb({ withPlan: true })
  const good = await reviewViaApi(t, 'u1', mkSelection('r-2', 'c1', [0, 1, 2], 1_000))
  expect(good.replanned).toBe(false)
  const bad = await reviewViaApi(t, 'u1', mkSelection('r-3', 'c1', [0], 2_000))
  expect(bad.replanned).toBe(true)
  expect(bad.remainingPlan[0]).not.toBe(todayIso(t))
})

test('keyPointsTotal 快照：内容变更后历史分数不被静默改写（§8.1）', async () => {
  const t = await seedDb({ withPlan: true })
  await reviewViaApi(t, 'u1', mkSelection('r-4', 'c1', [0, 1, 2], 1_000))
  await updateCardKeyPoints(t, 'c1', 5)     // 要点 3 → 5
  const rows = await t.db.execute<{ key_points_total: number }>(sql`select key_points_total from review_log`)
  expect(rows.rows[0]!.key_points_total).toBe(3)
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**（复用 Task 5/6 的核与事务；HTTP 层判 localDate、查当日 variant（reviewCount 定位）、调 `scoreSubmission`/`transitionCard`、事务落库、圆点序列 = 剩余 plan 绝对日期数组）。
- [ ] **Step 4: 验证**：3 passed；全量 + typecheck
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(server): 刷一张卡流程——判分落库与屏②反馈"`

---

### Task 10: 设置与块集变更入口（§5.5 条件 2/3/4 的服务端接线）

**Files:**
- Create: `src/server/settings.ts`、`src/app/api/settings/route.ts`、`src/app/api/blocks/route.ts`
- Test: `tests/server/settings-blocks.test.ts`

**Interfaces:**
- Produces: `applySettingsChange(deps, userId, next: { readyByDate?: LocalDate | null; dailyCapacity?: number }): Promise<{ replanned: number }>`（条件 2/3：设置变更后对**全部有计划卡**重排——新窗口下旧计划形状无效；实现 = 把这些卡的 plan 清空后跑 `buildDailyPayload` 的装配核）、`applyBlockSelection(deps, userId, blockIds: readonly string[]): Promise<{ paused: number; added: number }>`（条件 4：加块 = 新块卡作为 fresh 走队列装配——`schedule` + `reservedLoadOf` 组合已在计划 2 Task 8 验证；减块 = `pauseCards` 落库置 `paused`，plan 保留）。

- [ ] **Step 1: 失败测试 `tests/server/settings-blocks.test.ts`**（pglite）

```ts
test('readyByDate 变更：已有计划的卡全部重排，圆点换新（§5.5 条件 2）', async () => {
  const t = await seedDb({ withPlans: true })   // 3 卡有计划，readyBy=+21d
  const r = await applySettingsChange(mkSettingsDeps(t, 'u1'), 'u1', { readyByDate: plusDays(t, 40) })
  expect(r.replanned).toBe(3)
  const rows = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from card_state where plan_generated_at is not null`)
  expect(rows.rows[0]!.n).toBe(3)
})

test('dailyCapacity 变更同样触发重排（§5.5 条件 3）', async () => {
  const t = await seedDb({ withPlans: true })
  const r = await applySettingsChange(mkSettingsDeps(t, 'u1'), 'u1', { dailyCapacity: 10 })
  expect(r.replanned).toBe(3)
})

test('减块：目标块卡置 paused、plan 原样保留、不进今日队列（§5.5 / §11）', async () => {
  const t = await seedBlocksFixture()   // b1/b2 两块各 2 卡，都有计划
  const r = await applyBlockSelection(mkBlocksDeps(t, 'u1'), 'u1', ['b1'])
  expect(r.paused).toBe(2)
  const st = await t.db.execute<{ phase: string; plan: string[] }>(sql`select phase, plan from card_state where card_id like 'b2%'`)
  expect(st.rows[0]!.phase).toBe('paused')
  expect(st.rows[0]!.plan.length).toBeGreaterThan(0)   // plan 保留
  const p = await buildDailyPayload(mkDeps(t, 'u1'))
  expect(p.queue.every(q => !q.cardId.startsWith('b2'))).toBe(true)
})

test('加→减→加 往返：计划与只加一次一致（§11）', async () => {
  const t = await seedBlocksFixture()
  await applyBlockSelection(mkBlocksDeps(t, 'u1'), 'u1', ['b1', 'b2'])
  const p1 = await buildDailyPayload(mkDeps(t, 'u1'))
  const plans1 = await allPlans(t)
  await applyBlockSelection(mkBlocksDeps(t, 'u1'), 'u1', ['b1'])       // 减 b2
  await applyBlockSelection(mkBlocksDeps(t, 'u1'), 'u1', ['b1', 'b2']) // 加回
  const plans2 = await allPlans(t)
  expect(plans2).toEqual(plans1)   // plan 保留未被重排（I4），往返逐字节一致
})
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**（`applySettingsChange`：更新 user_settings → 取全部 plan 非空且非 paused/done 的 card_state → 清 plan 并置 phase 按原值 → 调 buildDailyPayload 装配核重排落盘；`applyBlockSelection`：diff 新旧块集 → 移除块 `pauseCards`、新增块保持 fresh（无状态行）→ 更新 freeBlockIds）。
- [ ] **Step 4: 验证**：4 passed；全量 + typecheck
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(server): 设置与块集变更入口——§5.5 条件 2/3/4 的重排接线"`

---

### Task 11: GitHub OAuth 接线（薄壳）

**Files:**
- Create: `src/server/auth.ts`、`src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/sync/route.ts` 等（改用 `requireUserId`）
- Test: `tests/server/auth.test.ts`

**Interfaces:**
- Produces: `authOptions`（GitHub provider；`GITHUB_ID`/`GITHUB_SECRET`/`AUTH_SECRET` 环境变量）、`requireUserId(req: Request): Promise<string>`（无会话 → 401 Response；有 → userId）。首次登录铸造 ULID 用户 + 默认 settings（Asia/Shanghai、free、空 freeBlockIds、capacity 45）。

- [ ] **Step 1: 失败测试**

```ts
test('requireUserId：无会话返回 401，有会话返回 userId（不依赖真实 OAuth）', async () => {
  const getUserId = (req: Request) => requireUserIdWith(req, async () => null)
  const res = await getUserId(new Request('http://x'))
  expect(res).toBeInstanceOf(Response)
  expect((res as Response).status).toBe(401)
  const ok = await requireUserIdWith(new Request('http://x'), async () => ({ id: 'u1' } as never))
  expect(ok).toBe('u1')
})

test('首次登录铸造用户与默认设置（Asia/Shanghai / free / 45）', async () => {
  const t = await createTestDb()
  await ensureUser(t.db, 'gh-1')
  const rows = await t.db.execute(sql`select timezone, plan, daily_capacity from user_settings`)
  expect(rows.rows[0]).toMatchObject({ timezone: 'Asia/Shanghai', plan: 'free', daily_capacity: 45 })
  await ensureUser(t.db, 'gh-1')    // 幂等
  const n = await t.db.execute(sql`select count(*)::int as n from users`)
  expect(n.rows[0]!.n).toBe(1)
})
```

- [ ] **Step 2-4: 实现 + 验证**（next-auth v4 route handler；`requireUserIdWith(req, getSession)` 可注入会话源；`ensureUser` upsert）→ 2 passed + typecheck + `pnpm exec next build` 仍绿
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(server): GitHub OAuth 接线与用户铸造"`

---

### Task 12: 内容 upsert job

**Files:**
- Create: `src/server/content-upsert/run.ts`
- Modify: `package.json`（script `content:upsert`）
- Test: `tests/server/content-upsert.test.ts`

**Interfaces:**
- Produces: `runUpsert(db): Promise<{ blocks: number; cards: number; keyPoints: number }>`——读 `content/`（经 lib/content parse+schema 校验，校验失败抛错不落库）、按事务 upsert blocks/cards/key_points（tombstone：库里多出的 id 置 retiredAt 而非删除）。CLI：`pnpm content:upsert`（生产连 PG，由 DATABASE_URL 决定驱动）。

- [ ] **Step 1: 失败测试**（pglite；夹具用真实 `content/` 试点块）

```ts
test('试点块完整落库且可重复执行（幂等）', async () => {
  const t = await createTestDb()
  const r1 = await runUpsert(t.db)
  expect(r1.blocks).toBeGreaterThanOrEqual(1)
  expect(r1.cards).toBeGreaterThanOrEqual(5)
  const r2 = await runUpsert(t.db)
  expect(r2).toEqual(r1)
  const n = await t.db.execute(sql`select count(*)::int as n from cards`)
  expect(n.rows[0]!.n).toBe(r1.cards)
})

test('judgment 卡的 conclusion 字段落库', async () => {
  const t = await createTestDb()
  await runUpsert(t.db)
  const rows = await t.db.execute<{ conclusion: string | null }>(
    sql`select conclusion from cards where card_type='judgment'`)
  expect(rows.rows[0]!.conclusion).toMatch(/^(yes|no|depends)$/)
})

test('源目录消失的卡被 tombstone 而非删除（§7 id 稳定性）', async () => {
  const t = await createTestDb()
  await runUpsert(t.db)
  // 手动插一张"已从源里消失"的卡（先补外键指向的块）
  await t.db.execute(sql`insert into blocks values ('ghost-b','Ghost','ghost-cat')`)
  await t.db.execute(sql`insert into cards values ('ghost','ghost-b','q','atomic','d','[]','JDK 8+','mid',null,null)`)
  await runUpsert(t.db)
  const ghost = await t.db.execute<{ retired_at: string | null }>(sql`select retired_at from cards where id='ghost'`)
  expect(ghost.rows[0]!.retired_at).not.toBeNull()
})
```

- [ ] **Step 2-4: 实现 + 验证**（parse 走计划 1 的 `parse.ts`；事务内三表 upsert + 差集 tombstone）→ 3 passed + 全量 + typecheck
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(server): 内容 upsert job——幂等落库与 tombstone"`

---

### Task 13: §11 server 行验收与 ROADMAP 收尾

**Files:**
- Test: `tests/server/acceptance.test.ts`
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: 验收测试**（跨切面组合：离线队列 5 条乱序 + 跨日界 + 重试重复 + 内容要点变更后重放）

```ts
test('§11 离线场景全链路：断网 5 张（含 1 答错）→ 乱序+重复回传 → s/计划/进度全部收敛', async () => {
  const t = await seedOfflineScenario()   // c1..c5 各有当天计划；答错的是 c3
  const subs = 离线夹具的 5 条提交（c3 的一条 ratio<1/2）
  const shuffled = [subs[3]!, subs[0]!, subs[3]!, subs[4]!, subs[1]!, subs[2]!]  // 乱序 + 重试
  const r = await syncViaApi(t, 'u1', shuffled)
  expect(r.duplicated).toEqual([subs[3]!.submissionId])
  // c3 的计划被服务端重排且从明天起；其余卡消费当天项
  const c3 = await stateOf(t, 'c3')
  expect(c3.plan[0]).not.toBe(todayIso(t))
  // daily_session 分母当天不变
  const p = await buildDailyPayload(mkDeps(t, 'u1'))
  expect(p.progress.total).toBeGreaterThanOrEqual(1)
})

test('§11 确定性（跨实例）：同一 inputs 在两个独立 pglite 实例上全流程结果逐字节相同', async () => {
  // 注：§11.3 原文的"Node 与 headless 浏览器同构"属 4b 的 UI 层验收；本测试落的是
  // 服务端确定性的端到端形式（同输入 → 同输出），浏览器侧同构在 4b 补。
  const t1 = await seedOfflineScenario()
  const t2 = await seedOfflineScenario()
  const r1 = await syncViaApi(t1, 'u1', 固定提交集(), { serverNow: FIXED_NOW })
  const r2 = await syncViaApi(t2, 'u1', 固定提交集(), { serverNow: FIXED_NOW })
  expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
})
```

- [ ] **Step 2: 验证**（2 passed）+ 全量 `pnpm test`（预期 238 基线 + 本计划新增全部）+ `pnpm typecheck` + `pnpm exec next build`
- [ ] **Step 3: 更新 ROADMAP**（计划 4 拆为 4a/4b 两行的说明、4a 状态 ✅、「下一步」指向 4b；日期）
- [ ] **Step 4: Commit**：`git add -A && git commit -m "test(server): §11 离线/幂等/确定性验收全绿"`

---

## 完成标准

- [ ] `pnpm test` 全绿（239 基线 + 本计划新增；含 pglite 集成）
- [ ] `pnpm typecheck` 无输出；`pnpm exec next build` 成功
- [ ] §11 server/sync 行四条逐条落测：幂等（Task 6/13）、乱序重放（Task 6/13）、时钟钳制（Task 4/6）、服务端日界（Task 4/6/8）；§5.5 四条件的服务端接线（Task 10）
- [ ] 唯一池装配入口成立：全库（src/）无 `buildDistractorPools` 之外的 `DistractorPools` 构造点（终审裁决兑现）
- [ ] plan[] 唯一写者：`src/app` 与 `src/server` 中写 card_state.plan 的代码只存在于 adapters 的事务内
- [ ] ROADMAP 已更新（4a/4b 拆分说明）

## 与后续计划的衔接（4b）

- **4b（UI）**：消费 `/api/queue`（队列 + 预生成选项集 + 圆点序列）与 `/api/review`、`/api/sync`；离线 IndexedDB 只缓存下发物 + 提交队列，**绝不本地生成计划**（§8.3）；屏② 归属显示降级（未解锁 → \"属于本大类的另一道题（未解锁）\"）需要 `/api/review` 返回的 distractor 归属信息（4b 时按需扩展 feedback 字段）。
- **变体复现边界**（记录在案）：重算基于**当前 DB 内容 + 提交前快照的 s/reviewCount**。两个已知边界：① 下发与提交之间内容 upsert 发生，变体可能漂移——review_log 仍存 distractorIds 快照，回放以提交时的 keyPointsTotal 为准；② 在线路径中，取队列后用户已刷若干张、s 演化跨过 layerCounts 档位时，重算变体与下发变体可能不同（影响仅干扰项分层，不改正确项集合）。4b 上线前若实测漂移，升级方案：daily payload 生成时把 variants 落一张 `served_variants` 表，判分直查快照、不再重算。
- **计划 5（支付）**：`user_settings.plan/freeBlockIds` 即权限位；购买 = 更新这两字段，`entitledCards`/`crossBlockPoolFor` 自动生效，无额外接线。
