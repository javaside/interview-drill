# 专属错误选项（misconceptions）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 题卡可配「常见误解」式专属错误选项，抽取时优先于三层干扰项池；未熟练期（s<2/3）干扰项集合固定（排列仍随复习变），熟练后（s≥2/3）保持现状换血。

**Architecture:** 纯核先行（lib/options 抽取算法 + lib/content schema），再 DB/upsert，再 server 投影链路（CardSnapshot→OptionCard 四处 + replay 判分同卷），最后审计闸门与 UI 溯源。mc 永不进任何干扰项池、永不进 exclusion 账本。

**Tech Stack:** TypeScript strict（`pnpm typecheck`）、vitest 双 project（node + jsdom）、drizzle-orm/PGlite、zod。

**Spec:** `docs/superpowers/specs/2026-10-19-misconception-distractors-design.md`（含审核修正，本计划按终稿执行；执行者须先读 spec）

## Global Constraints

- 依赖单向 `src/app → src/server → src/lib`；SQL 只在 src/server；`server/lib` 内相对导入带 `.js` 后缀。
- `pnpm typecheck && pnpm test` 全绿是每个 task 的验收线。
- 熟练阈值 `3·s.num ≥ 2·s.den`（s ≥ 2/3），与 `layerCounts` 分档线一致；哨兵 `-2`（`-1` 已被 sequence 呈现序占用）。
- 固定分支必须同时冻结传给 `layerCounts` 的 s（恒 `{num:0,den:1}`）。
- 熟练分支（s≥2/3 且卡无 mc）与现状行为一致：同输入两次调用逐字节相等、跨 reviewIndex 集合不同。
- mc 永不进 `buildDistractorPools` 的任何层（池装配只读 keyPoints）。
- 选项总数恒 9（多选型）/ 恒 4（atomic），任何路径不得少给或超发。
- mc id 禁含 `#`（tombstone unnest 拼接键）；全库唯一；数量 ≤ 8/卡；sequence 卡禁配。
- 测试文件必须放对 vitest project：纯核单测 `tests/lib/**`、集成 `tests/server/**`（node）；组件 `tests/app/**`（jsdom）。

---

### Task 1: lib/options 纯核——类型、专属优先抽取、seed 分档

**Files:**
- Modify: `src/lib/options/types.ts`
- Modify: `src/lib/options/layers.ts`（新增 `isProficient`）
- Modify: `src/lib/options/draw.ts`
- Modify: `src/lib/options/prepare.ts`
- Test: `tests/lib/options/prepare.test.ts`（存量夹具迁移）
- Test: `tests/lib/options/misconception.test.ts`（新建）

**Interfaces:**
- Consumes: 现有 `OptionCard`/`DistractorPools`/`Rational`/`prepareOptions(card, pools, s, userId, reviewIndexBase, K)`。
- Produces（后续任务依赖的精确签名）:
  - `type OptionMisconception = { id: string; text: string; why: string; retiredAt?: string }`
  - `OptionCard` 增 `misconceptions?: readonly OptionMisconception[]`
  - `PreparedVariant` 增 `misconceptionWhy?: Record<number, string>` 与 `misconceptionIds: string[]`
  - `drawDistractors(card, pools, count, s, rng): { keyPoints: OptionKeyPoint[]; misconceptions: OptionMisconception[]; degradedTo: Degradation }`
  - `isProficient(s: Rational): boolean`（`3*s.num >= 2*s.den`）
  - `FIXED_DRAW_SENTINEL = -2`（types.ts 导出）

- [ ] **Step 1: 写失败测试（新文件 `tests/lib/options/misconception.test.ts`）**

```ts
import { prepareOptions } from '../../../src/lib/options/prepare.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, OptionMisconception } from '../../../src/lib/options/types.js'

const S0 = { num: 0, den: 1 }          // 未熟练 → 固定分支
const S_PROF = { num: 2, den: 3 }      // 熟练 → 换血分支

function kp(id: string): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [] }
}
function pools(): DistractorPools {
  return {
    sameBlock: Array.from({ length: 10 }, (_, i) => kp(`s${i}`)),
    crossBlock: Array.from({ length: 12 }, (_, i) => kp(`c${i}`)),
    neighbor: [],
  }
}
function mc(id: string, why = `W-${id}`): OptionMisconception {
  return { id, text: `M-${id}`, why }
}
function cardWith(nMc: number): OptionCard {
  return {
    id: 'e1', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0'), kp('k1'), kp('k2')],
    misconceptions: Array.from({ length: nMc }, (_, i) => mc(`m${i}`)),
  }
}

test('专属优先：mc 文本出现在选项里，池干扰项只补缺口（3 正确 + 4 mc + 池补 2）', () => {
  const r = prepareOptions(cardWith(4), pools(), S_PROF, 'u1', 0, 1)
  const v = r.variants[0]!
  expect(v.optionTexts).toHaveLength(9)
  const mcTexts = ['M-m0', 'M-m1', 'M-m2', 'M-m3']
  for (const t of mcTexts) expect(v.optionTexts).toContain(t)
  const poolTexts = v.optionTexts.filter(t => t.startsWith('T-') && !['T-k0', 'T-k1', 'T-k2'].includes(t))
  expect(poolTexts).toHaveLength(2)
  expect(v.misconceptionIds.sort()).toEqual(['m0', 'm1', 'm2', 'm3'])
  // why 映射：mc 所在下标 → why
  const whyVals = Object.values(v.misconceptionWhy ?? {})
  expect(whyVals.sort()).toEqual(['W-m0', 'W-m1', 'W-m2', 'W-m3'])
})

test('固定分支（s<2/3）：跨 K 份、跨调用干扰项集合恒同，排列互异；s 演化跨 3s=1 档集合仍不变', () => {
  const c = cardWith(4)
  const a = prepareOptions(c, pools(), { num: 0, den: 1 }, 'u1', 0, 3)
  const b = prepareOptions(c, pools(), { num: 1, den: 2 }, 'u1', 0, 3)  // 仍在未熟练带，但跨过 layerCounts 3s=1 档
  for (let i = 0; i < 3; i++) {
    expect(new Set(b.variants[i]!.optionTexts)).toEqual(new Set(a.variants[i]!.optionTexts))
  }
  // K 份之间集合恒同、排列互异
  expect(new Set(a.variants[0]!.optionTexts)).toEqual(new Set(a.variants[1]!.optionTexts))
  expect(a.variants[0]!.optionTexts).not.toEqual(a.variants[1]!.optionTexts)
  // 跨调用（同 reviewIndexBase）逐字节相等
  const again = prepareOptions(c, pools(), { num: 0, den: 1 }, 'u1', 0, 3)
  expect(JSON.stringify(a)).toBe(JSON.stringify(again))
})

test('固定分支对无 mc 存量卡同样生效：池干扰项集合跨 K 份恒同、排列互异', () => {
  const c = cardWith(0)
  const r = prepareOptions(c, pools(), S0, 'u1', 0, 3)
  const sets = r.variants.map(v => [...v.optionTexts].sort().join('|'))
  expect(sets[0]).toBe(sets[1])
  expect(r.variants[0]!.optionTexts).not.toEqual(r.variants[1]!.optionTexts)
  expect(r.variants[0]!.misconceptionIds).toEqual([])
})

test('熟练分支（s≥2/3）：无 mc 时与现状签名一致——同输入逐字节相等、跨 reviewIndex 换血', () => {
  const c = cardWith(0)
  const a = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1)
  const again = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1)
  expect(JSON.stringify(a)).toBe(JSON.stringify(again))
  const b = prepareOptions(c, pools(), S_PROF, 'u1', 500, 1)
  expect(new Set(b.variants[0]!.optionTexts)).not.toEqual(new Set(a.variants[0]!.optionTexts))
})

test('熟练分支 mc 多于缺口：跨 reviewIndex 子集轮换（每条都值得见）', () => {
  const c = cardWith(8)   // enumeration 3 正确 → 缺口 6，8 > 6
  const a = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1).variants[0]!
  const b = prepareOptions(c, pools(), S_PROF, 'u1', 1, 1).variants[0]!
  const d = prepareOptions(c, pools(), S_PROF, 'u1', 2, 1).variants[0]!
  expect(a.misconceptionIds).toHaveLength(6)
  expect(b.misconceptionIds).toHaveLength(6)
  // 8 选 6、三份不同 seed：合计见过的 mc 超过单份的 6 条（轮换的可观测签名）
  expect(new Set([...a.misconceptionIds, ...b.misconceptionIds, ...d.misconceptionIds]).size)
    .toBeGreaterThan(6)
})

test('退役 mc 不出现；mc+池全枯竭仍抛错', () => {
  const c: OptionCard = {
    id: 'e2', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0'), kp('k1'), kp('k2')],
    misconceptions: [
      { id: 'm0', text: 'M-m0', why: 'W-m0', retiredAt: '2026-10-01' },
    ],
  }
  const tiny: DistractorPools = { sameBlock: [], crossBlock: [], neighbor: [] }
  expect(() => prepareOptions(c, tiny, S_PROF, 'u1', 0, 1))
    .toThrow(/干扰项池枯竭/)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/lib/options/misconception.test.ts`
Expected: FAIL——`OptionMisconception` 类型不存在 / `misconceptionIds` 字段不存在（TS 报错即失败依据）。

- [ ] **Step 3: types.ts 实现**

```ts
/** 专属错误选项（spec §2.4）：最小输入类型，movedFrom 不参与出题不进 */
export type OptionMisconception = {
  id: string
  text: string
  why: string
  retiredAt?: string
}

// OptionCard 增：
export type OptionCard = {
  id: string
  blockId: string
  cardType: CardType
  keyPoints: OptionKeyPoint[]
  /** 本卡专属错误选项；缺省 = 无，全走池（spec §3.1） */
  misconceptions?: readonly OptionMisconception[]
}

/** 固定分支抽取哨兵（spec §3.2）：-1 已被 sequence 呈现序占用，-2 专用于未熟练抽取 */
export const FIXED_DRAW_SENTINEL = -2
```

- [ ] **Step 4: layers.ts 加 `isProficient`**

```ts
/**
 * 熟练判定（spec §3.2）：s ≥ 2/3，与 layerCounts 的 3s≥2 分档线同一语义
 * （两三轮答对≈熟练）。s < 2/3 走固定分支：抽取 seed 用恒定哨兵、
 * layerCounts 的 s 冻结为 rat(0,1)——s 演化跨 3s=1 配额档不再影响集合。
 */
export function isProficient(s: Rational): boolean {
  return 3 * s.num >= 2 * s.den
}
```

- [ ] **Step 5: draw.ts 改造 `drawDistractors`——专属优先、池补足**

现有三层池逻辑整体保留，前面插专属段（`sameBlockPoolOf`/`buildExclusionIndex` 不动）：

```ts
export function drawDistractors(
  card: OptionCard,
  pools: DistractorPools,
  count: number,
  s: Rational,
  rng: Rng,
): { keyPoints: OptionKeyPoint[]; misconceptions: OptionMisconception[]; degradedTo: Degradation } {
  // 专属优先（spec §3.1）：活的全用；多于缺口按 rng 选子集
  const ownLive = (card.misconceptions ?? []).filter(m => !m.retiredAt)
  const misconceptions = shuffle(ownLive, rng).slice(0, count)
  const poolCount = count - misconceptions.length

  // 池缺口走现状三层（互斥过滤、双向回填、枯竭抛错，全部照旧——
  // 原 takeFrom 逻辑不动，只是入口计数变 poolCount；poolCount=0 时三层自然空转）
  const ownIds = new Set(card.keyPoints.map(kp => kp.id))
  const eligible = (pool: OptionKeyPoint[]) =>
    pool.filter(
      kp => !kp.retiredAt && !ownIds.has(kp.id) && !kp.excludeAsDistractorFor.includes(card.id),
    )
  const taken = new Map<string, OptionKeyPoint>()
  const takeFrom = (pool: OptionKeyPoint[], want: number): number => {
    for (const kp of shuffle(eligible(pool), rng)) {
      if (want === 0) break
      if (taken.has(kp.id)) continue
      taken.set(kp.id, kp)
      want--
    }
    return want
  }
  const layers = layerCounts(poolCount, s)
  let shortfall = takeFrom(pools.sameBlock, layers.sameBlock)
  shortfall = takeFrom(pools.crossBlock, layers.crossBlock + shortfall)
  shortfall = takeFrom(pools.sameBlock, shortfall)
  let degradedTo: Degradation = 'none'
  if (shortfall > 0) {
    degradedTo = 'neighbor'
    shortfall = takeFrom(pools.neighbor, shortfall)
  }
  if (shortfall > 0) {
    throw new Error(
      `干扰项池枯竭：${card.id} 需要 ${count} 条（专属 ${misconceptions.length} + 池 ${poolCount}），三层合计仍缺 ${shortfall} 条` +
      '（内容缺陷，构建期解决，绝不静默少给）',
    )
  }
  return { keyPoints: [...taken.values()], misconceptions, degradedTo }
}
```

注意：熟练分支下「与现状逐字节一致」要求 rng 消费序不变——专属段在无 mc 时 `shuffle([], rng)` **零消费**（空数组 Fisher-Yates 循环不执行），第一个真实消费仍是 `shuffle(eligible(sameBlock), rng)`，与现状一致。`layerCounts(0, s)` 返回 `{0,0}` 无副作用。

- [ ] **Step 6: prepare.ts 改造——分档 rng、冻结 s、透传 why**

```ts
import { FIXED_DRAW_SENTINEL } from './types.js'
import { isProficient } from './layers.js'

// PreparedVariant 增两个字段：
//   misconceptionIds: string[]                    // 恒有，可为空数组（review_log 复现用）
//   misconceptionWhy?: Record<number, string>     // mc 所在呈现下标 → why（UI 溯源）

function buildVariant(
  card: OptionCard,
  correctPoints: OptionKeyPoint[],
  pools: DistractorPools,
  s: Rational,
  permRng: Rng,        // ← 改为注入：排列与 sequence 呈现序专用（恒现状派生）
  drawRng: Rng,        // ← 新增注入：干扰项抽取专用（分档派生）
): { variant: PreparedVariant; degradedTo: Degradation } {
  // sequence 分支不动（无干扰项）……
  const total = card.cardType === 'atomic' ? ATOMIC_OPTIONS_TOTAL : OPTIONS_TOTAL
  const correctCount = card.cardType === 'atomic' ? 1 : correctPoints.length
  const { keyPoints: distractors, misconceptions, degradedTo } = drawDistractors(
    card, pools, total - correctCount, s, drawRng,
  )

  type Entry = {
    text: string; correct: boolean
    distractorId?: string; mcId?: string; mcWhy?: string
    origin?: { cardId: string; blockId: string; question: string }
  }
  const entries: Entry[] = [
    ...correctPoints.slice(0, correctCount).map(kp => ({ text: kp.text, correct: true })),
    ...distractors.map(kp => ({
      text: kp.text, correct: false, distractorId: kp.id,
      ...(kp.origin !== undefined ? { origin: kp.origin } : {}),
    })),
    ...misconceptions.map(m => ({ text: m.text, correct: false, mcId: m.id, mcWhy: m.why })),
  ]
  const arranged = shuffle(entries, permRng)
  const origins: Record<number, { cardId: string; blockId: string; question: string }> = {}
  const whys: Record<number, string> = {}
  for (const [i, e] of arranged.entries()) {
    if (e.origin !== undefined) origins[i] = e.origin
    if (e.mcWhy !== undefined) whys[i] = e.mcWhy
  }
  return {
    variant: {
      optionTexts: arranged.map(e => e.text),
      correctIndices: arranged.flatMap((e, i) => (e.correct ? [i] : [])),
      distractorKeyPointIds: arranged.flatMap(e => (e.distractorId ? [e.distractorId] : [])),
      misconceptionIds: arranged.flatMap(e => (e.mcId ? [e.mcId] : [])),
      ...(Object.keys(origins).length > 0 ? { distractorOrigins: origins } : {}),
      ...(Object.keys(whys).length > 0 ? { misconceptionWhy: whys } : {}),
    },
    degradedTo,
  }
}
```

`prepareOptions` 主循环改为：

```ts
for (let i = 0; i < K; i++) {
  const permRng = seedRng(hashSeed(userId, card.id, reviewIndexBase + i))
  // 抽取 seed 分档（spec §3.2）：熟练 = 与排列同一实例（无 mc 时消费序与现状逐字节一致）；
  // 未熟练 = 恒定哨兵，且 layerCounts 的 s 冻结为 0（跨 3s=1 档集合不变）
  const proficient = isProficient(s)
  const drawRng = proficient ? permRng : seedRng(hashSeed(userId, card.id, FIXED_DRAW_SENTINEL))
  const drawS = proficient ? s : { num: 0, den: 1 }
  const built = buildVariant(card, live, pools, drawS, permRng, drawRng)
  ...
}
```

- [ ] **Step 7: 存量测试迁移**

跑 `pnpm vitest run tests/lib/options/ tests/lib/scheduler/acceptance.test.ts tests/lib/options/acceptance.test.ts`。所有断言「跨 reviewIndex 干扰项集合不同」的存量用例（夹具 s=0，现落入固定分支）把夹具改为 `const S_PROF = { num: 2, den: 3 }`；断言「同输入两次调用相等」的用例任何分支下都应仍绿。逐个失败用例对照此原则修，不改产品代码来迁就测试。

- [ ] **Step 8: 全量验证 + 提交**

Run: `pnpm typecheck && pnpm vitest run tests/lib/options/`
Expected: 全绿。

```bash
git add src/lib/options tests/lib/options
git commit -m "feat(options): 专属错误选项优先抽取 + 熟练前固定干扰项集合——seed 分档与配额冻结"
```

---

### Task 2: content 模型——zod schema、types、sequence 禁配

**Files:**
- Modify: `src/lib/content/schema.ts`
- Modify: `src/lib/content/types.ts`
- Test: `tests/lib/content/schema.test.ts`（追加用例）

**Interfaces:**
- Consumes: 无（纯内容层）。
- Produces:
  - `misconceptionSchema`（zod）、`Card.misconceptions?: Misconception[]`
  - `type Misconception = { id: string; text: string; why: string; retiredAt?: string; movedFrom?: string }`

- [ ] **Step 1: 写失败测试（追加到 `tests/lib/content/schema.test.ts`，复用该文件现有的合法卡构造辅助——先读文件头部找到它）**

```ts
test('misconceptions：why 必填、id 禁含 #、上限 8、strict 拒未知字段', () => {
  // 基于现有合法卡构造辅助（如 baseCard()），以下断言逐一验证：
  // 1) 缺 why → parse 拒，issue 提到 why
  // 2) id: 'mc-1#2' → parse 拒（tombstone 拼接键约束）
  // 3) 9 条 mc → parse 拒（.max(8)）
  // 4) mc 里写未知字段 foo → parse 拒（.strict()）
  // 5) 合法 3 条 mc → parse 过，Card.misconceptions 逐字段还原
  // 6) 不带 misconceptions 字段 → parse 过且 undefined（存量卡零迁移）
})

test('sequence 卡配 misconceptions → superRefine 拒（死内容防线）', () => {
  // sequence 型合法卡 + 1 条合法 mc → parse 拒，issue 提到 misconceptions
})
```

（以上为用例规格说明——实现时把注释展开成真实断言，风格对齐该文件现有用例。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/lib/content/schema.test.ts`
Expected: FAIL——schema 无 misconceptions 字段。

- [ ] **Step 3: schema.ts 实现**

```ts
export const misconceptionSchema = z.object({
  id: z.string().min(1).regex(/^[^#]+$/, 'mc id 不得含 #（tombstone unnest 拼接键约束）'),
  text: z.string().min(1),
  why: z.string().min(1),          // 必填：错勾永远有「为什么错」（spec §2.1）
  retiredAt: z.string().regex(ISO_DATE).optional(),
  movedFrom: z.string().optional(),
}).strict()

// cardSchema 的 object 部分加：
misconceptions: z.array(misconceptionSchema).max(8).optional(),

// superRefine 追加（现有 sequence/judgment 校验之后）：
if (card.cardType === 'sequence' && card.misconceptions !== undefined && card.misconceptions.length > 0) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['misconceptions'],
    message: 'sequence 型无干扰项阶段，misconceptions 不会被消费——配了就是死内容' })
}
```

- [ ] **Step 4: types.ts 实现**

`src/lib/content/types.ts` 的 `Card` 加（先读该文件对齐现有 KeyPoint 类型的写法）：

```ts
export type Misconception = {
  id: string
  text: string
  why: string
  retiredAt?: string
  movedFrom?: string
}
// Card 内：
misconceptions?: Misconception[]
```

- [ ] **Step 5: 验证 parse 链路自动贯通 + 提交**

Run: `pnpm vitest run tests/lib/content/ && pnpm typecheck`
Expected: 全绿（parse.ts 走 cardSchema，无需改动；验证 parse.test.ts 不红）。

```bash
git add src/lib/content tests/lib/content
git commit -m "feat(content): misconceptions schema——why 必填、id 禁#、上限8、sequence 禁配"
```

---

### Task 3: DB 表、迁移、content-upsert

**Files:**
- Modify: `src/server/db/schema.ts`（misconceptions 表）
- Create: `drizzle/0007_*.sql`（drizzle-kit generate 产出）
- Modify: `src/server/content-upsert/run.ts`
- Test: `tests/server/content-upsert.test.ts`（追加用例）

**Interfaces:**
- Consumes: Task 2 的 `Card.misconceptions`。
- Produces: `misconceptions` 表（复合主键 card_id+id）；`UpsertResult` 增 `misconceptions: number`。

- [ ] **Step 1: 写失败测试（追加到 `tests/server/content-upsert.test.ts`——先读现有用例的 DB 夹具搭建方式，PGlite）**

```ts
test('misconceptions：upsert 幂等、tombstone、retired 回写', async () => {
  // 1) 首跑：写临时 content 目录（对齐现有用例的目录构造方式），卡带 3 条 mc
  //    → 库里 3 行，UpsertResult.misconceptions === 3
  // 2) 重跑同目录 → 行数与内容逐字节等价（幂等）
  // 3) 删 1 条 mc 后重跑 → 该行 retired_at = current_date（tombstone，不物理删）
  // 4) 恢复该 mc 后重跑 → retired_at 回写 null（自动解除）
  // 5) 卡不带 misconceptions 字段 → misconceptions 表不新增行（存量卡零迁移）
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/server/content-upsert.test.ts`
Expected: FAIL——表不存在 / UpsertResult 无该字段。

- [ ] **Step 3: schema.ts 建表 + 生成迁移**

```ts
/** 专属错误选项（spec §2.3）：与 key_points 平行，永不进干扰项池（池装配只读 key_points） */
export const misconceptions = pgTable('misconceptions', {
  id: text('id').notNull(),   // 复合主键 (cardId, id)，同 key_points 的列级/表级处理
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  why: text('why').notNull(),
  retiredAt: date('retired_at'),
}, t => [primaryKey({ columns: [t.cardId, t.id] })])
```

Run: `npx drizzle-kit generate` → 产出 `drizzle/0007_*.sql`（CREATE TABLE misconceptions）。**检查产出 SQL** 只含这一张表；确认 `drizzle/meta` 已更新。

- [ ] **Step 4: run.ts 的 upsert + tombstone**

照 key_points 现有模式（`src/server/content-upsert/run.ts`）：

```ts
// UpsertResult 增字段：
export type UpsertResult = { blocks: number; cards: number; keyPoints: number; misconceptions: number; tracks: number }

// loadContent 后计数：
const mcCount = cards.reduce((n, c) => n + (c.misconceptions?.length ?? 0), 0)

// 卡循环内、kp 循环之后：
for (const m of c.misconceptions ?? []) {
  await tx.execute(sql`
    insert into misconceptions (id, card_id, text, why, retired_at)
    values (${m.id}, ${c.id}, ${m.text}, ${m.why}, ${m.retiredAt ?? null})
    on conflict (card_id, id) do update set
      text = excluded.text, why = excluded.why, retired_at = excluded.retired_at`)
}

// 事务尾、key_points tombstone 之后（同构：单 JSON 数组 + unnest，不平铺参数）：
const liveMcKeys = cards.flatMap(c => (c.misconceptions ?? []).map(m => `${c.id}#${m.id}`))
await tx.execute(sql`
  update misconceptions set retired_at = current_date
  where retired_at is null
    and (card_id || '#' || id) not in (
      select jsonb_array_elements_text(${JSON.stringify(liveMcKeys)}::jsonb))`)

// 返回：
return { blocks: blocks.length, cards: cards.length, keyPoints: keyPointCount, misconceptions: mcCount, tracks: tracks.length }
```

- [ ] **Step 5: 全量测试 + 提交**

Run: `pnpm typecheck && pnpm vitest run tests/server/content-upsert.test.ts tests/server/schema.test.ts`
Expected: 全绿（迁移目录新文件被 PGlite 同源加载——schema.test.ts 现有用例验证加载机制仍通）。

```bash
git add src/server/db/schema.ts drizzle src/server/content-upsert tests/server/content-upsert.test.ts
git commit -m "feat(db): misconceptions 表与 upsert/tombstone——与 key_points 同构的平行链路"
```

---

### Task 4: server 投影链路——快照、池装配隔离、replay 判分同卷

**Files:**
- Modify: `src/server/types.ts`（CardSnapshot）
- Modify: `src/server/db/adapters.ts`（loadCardSnapshots）
- Modify: `src/server/queue.ts`（toOptionCard / toOptionCardWithOrigin）
- Modify: `src/server/replay.ts`（variantAt 投影 + distractorIds 合并）
- Test: `tests/server/variant-align.test.ts`（扩四象限）
- Test: `tests/server/queue-pools.test.ts`（池隔离守卫）

**Interfaces:**
- Consumes: Task 1 的 `OptionCard.misconceptions`、`PreparedVariant.misconceptionIds`。
- Produces: `CardSnapshot.misconceptions?: Array<{ id: string; text: string; why: string; retiredAt?: string }>`。

- [ ] **Step 1: 写失败测试**

`tests/server/variant-align.test.ts` 追加（先读现有用例：它验证 serve 与 replay 的变体一致性——沿用其夹具与比对方法）：

```ts
test('serve == replay 四象限：两分档 × 配/不配 mc，变体逐字节一致', async () => {
  // 对四个组合各构造一张卡（enumeration，mc 配 4 条）：
  //   A) s=0   + mc    B) s=0   + 无 mc
  //   C) s=2/3 + mc    D) s=2/3 + 无 mc
  // 每组合：队列构建路径产出的 variant 与 variantAt(snapshot, pools, sAtServe, userId, idx)
  // 重算的 variant 做 JSON.stringify 严格相等——判分与展示同卷（AGENTS.md 铁律）。
  // A/B 还断言：固定分支下两次重算（同 s 不同 idx）集合相等、排列不同。
})

test('review_log.distractorIds 合并记录：mc id 与池要点 id 都在', async () => {
  // 配 mc 的卡走一次提交回放 → review_log.distractorIds 同时含 mc id（m*）与池要点 id（s*/c*）
})
```

`tests/server/queue-pools.test.ts` 追加：

```ts
test('池装配隔离：misconceptions 永不进入任何干扰项池', () => {
  // 构造同块两张卡，目标卡 A 配 mc；buildDistractorPools(B 的视角) 的
  // sameBlock/crossBlock/neighbor 三层数组中，A 的 mc 文本与 id 一概不出现
  // （装配只读 keyPoints——本用例锁死这一结构性事实，防未来回归）
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/server/variant-align.test.ts tests/server/queue-pools.test.ts`
Expected: FAIL——CardSnapshot 无 misconceptions，投影后抽取不含 mc。

- [ ] **Step 3: 实现四处投影 + replay 合并**

`src/server/types.ts` CardSnapshot：

```ts
misconceptions?: Array<{ id: string; text: string; why: string; retiredAt?: string }>
```

`src/server/db/adapters.ts` loadCardSnapshots——在 kps 查询后加同构查询（行内投影，retired 透传由 lib 侧过滤，与 kps 一致）：

```ts
const mcs = await db.execute<{ card_id: string; id: string; text: string; why: string; retired_at: string | null }>(sql`
  select card_id, id, text, why, retired_at from misconceptions where card_id in ${inList(cardIds)}`)
const mcByCard = new Map<string, NonNullable<CardSnapshot['misconceptions']>>()
for (const m of mcs.rows) {
  const arr = mcByCard.get(m.card_id) ?? []
  arr.push({ id: m.id, text: m.text, why: m.why, ...(m.retired_at ? { retiredAt: m.retired_at } : {}) })
  mcByCard.set(m.card_id, arr)
}
// 卡循环 out.set 处：
...(mcByCard.get(c.id) ? { misconceptions: mcByCard.get(c.id)! } : {}),
```

`src/server/queue.ts` 两个投影：

```ts
// toOptionCard：
return { id: c.cardId, blockId: c.blockId, cardType: c.cardType, keyPoints: c.keyPoints,
         ...(c.misconceptions ? { misconceptions: c.misconceptions } : {}) }
// toOptionCardWithOrigin 同样透传 misconceptions（mc 不挂 origin——它不属于任何题）
```

`src/server/replay.ts`：

```ts
// variantAt 内 optionCard 投影同样透传 misconceptions
// distractorIds 落库处（301 行附近）：
distractorIds: [...variant.distractorKeyPointIds, ...(variant.misconceptionIds ?? [])],
```

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck && pnpm vitest run tests/server/`
Expected: 全绿（queue/replay/sync/acceptance 现有用例若因固定分支语义漂移，按 Task 1 Step 7 原则迁移夹具）。

```bash
git add src/server tests/server
git commit -m "feat(server): mc 投影链路四处贯通 + 判分同卷四象限——distractorIds 合并记录"
```

---

### Task 5: 审计闸门——池豁免、全库查重、ids.lock、脚手架

**Files:**
- Modify: `src/lib/content/audit.ts`（MIN_BLOCK_POOL 豁免 + mc 查重 + checkIdLock 认 mc + checkPlaceholders 扩展）
- Modify: `src/lib/content/pool.ts` 或 `exclusion.ts`（poolMarginsOf 同步豁免——先 grep 定位其所在文件）
- Modify: `tools/audit-cli.ts`（--write-lock 写 mc 行）
- Modify: `tools/content-new/index.ts`（脚手架模板加 misconceptions 注释块）
- Test: `tests/lib/content/audit-pool.test.ts`、`tests/lib/content/audit-lock.test.ts`、`tests/tools/content-new.test.ts`（各追加）

**Interfaces:**
- Consumes: Task 2 的 `Card.misconceptions`。
- Produces: 豁免规则 `exempt = 活 mc 数 ≥ 选项总数 − 正确要点数`（多选型 9−N、atomic 4−1）；lockfile 行格式 `mc:<id>`。

- [ ] **Step 1: 写失败测试**

`audit-pool.test.ts` 追加：

```ts
test('配满 mc 的卡豁免 MIN_BLOCK_POOL；poolMarginsOf 同口径', () => {
  // 块内只有 1 张 enumeration 卡（要点 3 条）+ mc 6 条（≥ 缺口 6）
  // → auditLibrary 不再报池不足 error；poolMarginsOf 的该卡 need 为 0
  // 部分配（mc 3 条 < 缺口 6）→ 照旧检查（豁免只认「配满」）
})

test('mc 文本与全库活要点撞车 → 红（含跨块）', () => {
  // 卡 A（块 X）的 mc.text 与卡 B（块 Y，跨块甚至相邻大类）某活要点 text 完全相同 → error
  // 卡内两条 mc 文本相同 → error
})
```

`audit-lock.test.ts` 追加：

```ts
test('checkIdLock 认 mc: 行：消失报错、movedFrom 放行', () => {
  // lockfile 有 mc:m-1：源里 mc m-1 消失 → error（提示写 movedFrom 或 retiredAt）
  // 源里 mc id 改为 m-2 且 movedFrom: m-1 → 放行
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/lib/content/audit-pool.test.ts tests/lib/content/audit-lock.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现豁免 + 查重 + lock**

`audit.ts` 池检查循环内（92 行附近）：

```ts
const liveMc = c.misconceptions?.filter(m => !m.retiredAt).length ?? 0
const optionsTotal = c.cardType === 'atomic' ? 4 : 9
const correctCount = c.cardType === 'atomic' ? 1 : c.keyPoints.filter(kp => !kp.retiredAt).length
if (liveMc >= optionsTotal - correctCount) continue   // 配满缺口 → 整卡豁免（spec §5.1）
```

池不足的 need 计算同样减去该卡活 mc 数后与 MIN_BLOCK_POOL 取 min？**不**——豁免只认「配满」，部分配照旧全额检查（保守规则，spec §5.1 原文）。

`poolMarginsOf`（grep 定位后）加同一短路：配满卡该行 need 置 0。

mc 查重（auditLibrary 内，构建期一次装配）：

```ts
const liveKpTexts = new Set(cards.flatMap(c => c.keyPoints.filter(kp => !kp.retiredAt).map(kp => kp.text)))
for (const c of cards) {
  const seenMc = new Set<string>()
  for (const m of c.misconceptions ?? []) {
    if (m.retiredAt) continue
    if (liveKpTexts.has(m.text)) errors.push(`mc ${m.id} 文本与某活要点完全相同（${c.id}）——复制要点冒充错误项`)
    if (seenMc.has(m.text)) errors.push(`卡 ${c.id} 内 mc 文本重复：${m.id}`)
    seenMc.add(m.text)
  }
}
```

`checkIdLock` 加第三种行类型（与 card/kp 分支并列）：

```ts
} else if (kind === 'mc') {
  if (liveMcIds.has(id) || mcMovedFrom.has(id)) continue
  errors.push(
    `mc id ${id} 相对上一次 main 消失了。` +
    `若为改名，请在新 mc 上写 movedFrom: ${id}；若为作废，请保留并设 retiredAt。` +
    `直接删除会让 review_log.distractorIds 悬空引用。`)
}
```

（`liveMcIds`/`mcMovedFrom` 由 cards 的 misconceptions 构建，无块前缀——mc 全库唯一。）

`checkPlaceholders`（audit.ts 内 grep 定位）把 mc 的 text/why 纳入占位符扫描，与 kp 文本同一规则。

`tools/audit-cli.ts` `--write-lock` 落盘处追加 `mc:${m.id}` 行；`tools/content-new/index.ts` 模板加注释块：

```yaml
# misconceptions:            # 可选：本卡专属错误选项（常见误解），配几条用几条
#   - id: mc-xxx-01          # 全库唯一、禁含 #；text 必须本身是错的命题
#     text: "……"
#     why: "误解：……实际……"   # 必填：错勾时展示「为什么错」
```

- [ ] **Step 4: 真实库跑审计 + 提交**

Run: `pnpm typecheck && pnpm vitest run tests/lib/content/ tests/tools/ && pnpm content:audit`
Expected: 测试全绿；content:audit 对存量库（无 mc）输出与改动前一致——38 条已知债报法不变（配满豁免对无 mc 卡不触发）。

```bash
git add src/lib/content tools tests/lib/content tests/tools
git commit -m "feat(audit): mc 池豁免（audit 与 poolMarginsOf 同口径）+ 全库查重 + ids.lock mc 行"
```

---

### Task 6: UI 溯源降级 + 判分同构守卫扩展

**Files:**
- Modify: `src/app/(drill)/DrillFeedback.tsx`（wrongAttributionOf 三级降级）
- Test: `tests/app/drill-feedback.test.tsx`（追加）
- Test: `tests/app/scoring-isomorphic.test.tsx`（四卡型造卡加 mc）

**Interfaces:**
- Consumes: Task 1 的 `PreparedVariant.misconceptionWhy`。
- Produces: 无（UI 终端）。

- [ ] **Step 1: 写失败测试**

`tests/app/drill-feedback.test.tsx` 追加：

```tsx
test('错勾溯源三级降级：mc 优先「常见误解」→ 池干扰项「属于《…》」→ 旧缓存通用文案', () => {
  // 构造 variant：下标 3 有 misconceptionWhy、下标 5 有 distractorOrigins、下标 7 两者皆无
  // 全勾错 → 断言三行提示文案分别为：
  //   「常见误解：W-m0」「属于《某题面》」「属于本大类的另一道题」
})
```

`tests/app/scoring-isomorphic.test.tsx`：现有四卡型（enumeration/comparison/judgment/atomic）造卡各加 3 条 mc，全部用例重跑——判分、染色、计数在 mc 路径下与池干扰项同构（`correct: false` 的选项不分来源）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/app/drill-feedback.test.tsx tests/app/scoring-isomorphic.test.tsx`
Expected: FAIL——wrongAttributionOf 无 mc 分支；isomorphic 夹具无 mc 字段（若其造卡 helper 不透传则需补一行）。

- [ ] **Step 3: 实现**

`DrillFeedback.tsx`：

```tsx
/**
 * 错勾归属提示三级降级（spec §4）：
 * 专属错误项 → 「常见误解：{why}」（它不属于任何题，本身就是错的）；
 * 池干扰项 → 真实来源题面；旧缓存 variant 两者字段皆缺 → 通用文案。
 */
function wrongAttributionOf(variant: PreparedVariant, i: number): string {
  const why = variant.misconceptionWhy?.[i]
  if (why !== undefined) return `常见误解：${why}`
  const origin = variant.distractorOrigins?.[i]
  return origin !== undefined ? `属于《${origin.question}》` : '属于本大类的另一道题'
}
```

（`PreparedVariant` 类型在 client 侧的引用若来自独立定义，同步补可选字段——grep `misconceptionWhy` 找到类型声明处。）

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck && pnpm vitest run tests/app/`
Expected: 全绿。

```bash
git add "src/app/(drill)" tests/app
git commit -m "feat(drill): 错勾溯源认专属错误项——「常见误解」三级降级 + 判分同构四型扩展"
```

---

### Task 7: 收尾——全量验证、AGENTS.md 内容规范、部署清单

**Files:**
- Modify: `AGENTS.md`（题卡内容规范段）
- 无代码改动

- [ ] **Step 1: 全量验证**

Run: `pnpm typecheck && pnpm test`
Expected: 双 project 全绿。

- [ ] **Step 2: AGENTS.md 补内容规范**

「题卡内容规范」段追加一条（对齐现有条目风格）：

```markdown
- **专属错误选项（misconceptions，2026-10-19）**：卡级可选字段，配「常见误解」式错误命题（`text` 必须本身是错的，不是「不属于本题的正确陈述」），`why` 必填（错勾时展示「为什么错」）。抽取时优先于池、缺口照旧走池；`s<2/3` 未熟练期干扰项集合固定（排列仍每次变），`s≥2/3` 恢复换血。mc 永不进干扰项池、**永不触发 exclusion 判定**（对任何题天然不成立）；配满缺口的卡豁免 MIN_BLOCK_POOL（audit 与 content:exclusion 同口径）；id 全库唯一、禁含 `#`、≤8 条/卡；sequence 禁配。改 mc 文本不指纹过期任何判定，但改 mc id 要走 movedFrom（ids.lock 守卫）。
```

- [ ] **Step 3: 提交**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md 补 misconceptions 内容规范——生产/审计/守卫口径"
```

- [ ] **Step 4: 部署提醒（人工执行，不入本计划代码范围）**

上线时照 `docs/deploy.md` 流程，两处必须重跑：`drizzle-kit migrate`（新表 0007）+ `content:upsert`（若已配 mc 的卡进库）——本地与生产都要。第一波 mc 内容生产（frequency=high 的卡）由用户用现有 python 模板流程另行推进，不阻塞本计划合入。

