# 出题与掌握度实现计划（计划 3/5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `src/lib/options`（干扰项分层抽取 + 选项集预生成）、`src/lib/mastery`（四型计分 + 块掌握度）、`src/lib/entitlement`（免费两块 / 付费全量 / 公开池边界）——三个纯函数、零依赖、可完整单测的库。

**Architecture:** 三个互不 import 的库。`options` 自带确定性 PRNG（seed 注入，禁 `Math.random`），消费调用方装配好的三层干扰项池；`mastery` 输出精确有理数（结构兼容 `lib/scheduler` 的 `Rational`，可直接喂 `startTier`/`maintenanceStep`）；`entitlement` 的输出（解锁块集合、公开要点池）以**数据**形式喂给 `options` 的池与 `schedule()` 的 `cards[]`，装配发生在计划 4 的 server 层。三库各自定义最小结构类型（`lib/content` `Card`/`KeyPoint` 的结构子集），不 import 内容侧——同计划 2 `SchedulableCard` 的先例。

**Tech Stack:** TypeScript 5 · Node 20 · vitest。**不新增任何依赖。**

**Spec:** `docs/superpowers/specs/2026-09-15-interview-drill-design.md` §4.3（keyPoints 双重身份、分型表、抽取算法规格四条、`PreparedOptions`）、§4.4（四型计分表、块掌握度）、§10.1（免费/付费边界）、§7（三库定位与依赖单向）、§11（验收表）。

**上游依赖:** 语义上依赖计划 1 的 `Card`/`KeyPoint`/`excludeAsDistractorFor`/`public`/`order` 字段与 `MIN_KEY_POINTS`（judgment=2、atomic=1、sequence=4 且必带 `order`）；与计划 2 通过**同形** `Rational = { num, den }` 衔接（不 import）。测试基线：计划 1+2 共 183 条不回归。

---

## 全局约束（每个任务隐含遵守）

- **纯函数、零依赖**：无 IO、不读系统时钟、不读全局随机（§7）。不 import `lib/content` / `lib/scheduler` / 相邻新库——跨库组合只发生在测试与计划 4 的 server 层。
- **随机源注入**（§4.3 规格第 1 条）：一律 sfc32 + `seed = hash(userId, cardId, reviewIndex)`，**禁止 `Math.random()`**。同输入必同输出——可单测、`review_log.distractorIds` 可复现、服务端能校验客户端结果。
- **分数比较禁浮点**（§4.3 规格第 3 条）：分层比例与计分全部整数交叉运算。`2/3 = 0.6667 < 0.67` 是 spec 记录在案的事故，不许重演。
- **选项总数恒定，不泄露正确条数**（§4.3）：`enumeration` / `comparison` / `judgment` 恒 **9**；`atomic` 恒 **4**；`sequence` = 要点数（**绝不打乱**，顺序即答案——§4.3 强制例外，§11 明文断言）。
- **绝不少给干扰项**（§4.3 规格第 2 条）：降级链 同块 → 跨块（同大类）→ 相邻大类（置 `degradedTo: 'neighbor'`，调用方记日志告警）；三层全枯竭仍不足 → **抛错**（内容缺陷，属构建期问题，不由运行期静默吞掉）。同一条绝不重复抽。
- **过滤三连**：退役（`retiredAt`）、本题自己的要点、`excludeAsDistractorFor` 含目标卡的要点——三个池走同一套过滤。
- **输出确定**：数组顺序与遍历序由代码结构唯一决定；一切随机只经注入的 rng。
- tsconfig 已开 `strict` + `noUncheckedIndexedAccess`；import 一律带 `.js` 后缀；vitest `globals: true`；测试放 `tests/lib/{options,mastery,entitlement}/`。

## 算法规格速览（实现时照抄，不要发明）

```
选项总数  enumeration/comparison/judgment = 9 | atomic = 4 | sequence = 要点数
干扰项数  总数 − 正确数（枚举/对比 3-6；judgment 最多 9−2=7；atomic 3；sequence 0）
分层比例  3s<1 → 1:2 | 3s<2 → 1:1 | s<1 → 2:1 | s=1 → 3:0     // 分数表，交叉相乘
          sameBlock = floor(总数 × w同/(w同+w跨))，余数给跨块层
过滤      retiredAt 已设 ∨ 属于本题要点 ∨ excludeAsDistractorFor 含目标卡 → 不抽
降级链    同块缺口滚给跨块 → 仍缺从相邻大类补（degradedTo='neighbor'）
          三层枯竭 → 抛错；绝不静默少给、绝不重复
随机源    sfc32；seed = fnv1a(userId ⊕ cardId ⊕ reviewIndex)；洗牌用 Fisher-Yates
计分      enum/cmp: max(0,(勾对−勾错)/正确总数) | seq: 1 − 逆序对/最大逆序对
          judgment: 结论错→0；对→ 1/2 + 要点分/2 | atomic: 1 | 0
块掌握度  计划内卡的 s 按 high=3 mid=2 low=1 加权平均；
          phase=new 与 paused 不进分母；计入项为空 → 'untried'（显示"未刷"非 0%）
权限      free = 任选 2 块（构造时超选抛错）；跨块池 free 只取 public 要点；
          paid 全量；解锁块全集按 allBlockIds 顺序输出（确定）
```

**§11 验收对照**（完成标准逐条检查用）：选项总数恒为 9；分层比例正确；互斥项永不被抽中；同一 seed 输出可复现；池不足时降级不断供；每种 `cardType` 各一组测试；`sequence` 必须断言选项未被打乱；四型计分公式各自正确且归一化到 `[0,1]`；免费用户跨块干扰项只来自 public 池。**泄露边界的准确口径**：spec §11 写"未解锁块的要点不出现在下发语料里"，§4.3 免费跨块表写"从本大类的**公开要点池**抽"（含未解锁块的 public 要点——SEO 页本就可见）。两者按 §4.3 读：**未解锁块的非 public 要点**零出现；public 要点允许出现且必须出现（否则免费层退化成全同块抽，正是 §4.3 否定的 98.2% 枯竭场景）。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/options/types.ts` | 最小结构类型 + `OPTIONS_TOTAL` / `ATOMIC_OPTIONS_TOTAL` |
| `src/lib/options/rng.ts` | `fnv1a` / `sfc32` / `seedRng` / `hashSeed` / `shuffle` |
| `src/lib/options/draw.ts` | 互斥反向索引、同块池、分层分数表、`drawDistractors` |
| `src/lib/options/prepare.ts` | `PreparedOptions` 预生成（§4.3 服务端契约的数据层） |
| `src/lib/mastery/types.ts` | `Rational` / `Frequency` / `Phase` / `rat` / `FREQ_WEIGHT` |
| `src/lib/mastery/score.ts` | 四型单次得分（§4.4 计分表） |
| `src/lib/mastery/block.ts` | 块掌握度加权平均 |
| `src/lib/entitlement/entitlement.ts` | 免费两块 / 付费全量 / 公开池过滤（§10.1） |
| `tests/lib/{options,mastery,entitlement}/*.test.ts` | 每模块一组 + Task 8 的 §11 验收套件 |

---

### Task 1: 确定性随机源 `rng.ts`

**Files:**
- Create: `src/lib/options/rng.ts`
- Test: `tests/lib/options/rng.test.ts`

**Interfaces:**
- Produces: `Rng = () => number`（值域 `[0,1)`）、`fnv1a(str: string): number`（32 位无符号）、`sfc32(a, b, c, d): Rng`、`seedRng(seed: number): Rng`、`hashSeed(userId: string, cardId: string, reviewIndex: number): number`、`shuffle<T>(items: readonly T[], rng: Rng): T[]`（Fisher-Yates，返回新数组）。后续所有任务 import 这些名字。

- [ ] **Step 0: 提交本计划文档**

```bash
git add docs/superpowers/plans/2026-09-21-options-mastery.md
git commit -m "docs: 计划 3（出题与掌握度）实施计划"
```

- [ ] **Step 1: 写失败测试 `tests/lib/options/rng.test.ts`**

```ts
import { fnv1a, seedRng, hashSeed, shuffle } from '../../../src/lib/options/rng.js'

test('fnv1a：空串是 FNV 偏移基数，非空串确定且可区分', () => {
  expect(fnv1a('')).toBe(0x811c9dc5)
  expect(fnv1a('a')).toBe(fnv1a('a'))
  expect(fnv1a('a')).not.toBe(fnv1a('b'))
})

test('seedRng：同种子同序列，异种子异序列', () => {
  const a1 = seedRng(42), a2 = seedRng(42), b = seedRng(43)
  const s1 = [a1(), a1(), a1(), a1(), a1()]
  const s2 = [a2(), a2(), a2(), a2(), a2()]
  expect(s1).toEqual(s2)
  expect([b(), b(), b(), b(), b()]).not.toEqual(s1)
})

test('seedRng：值域 [0,1)', () => {
  const r = seedRng(7)
  for (let i = 0; i < 1000; i++) {
    const v = r()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  }
})

test('hashSeed：三元组稳定，各分量与分隔符都参与区分', () => {
  expect(hashSeed('u', 'c', 0)).toBe(hashSeed('u', 'c', 0))
  expect(hashSeed('u', 'c', 0)).not.toBe(hashSeed('u', 'c', 1))
  expect(hashSeed('u', 'c', 0)).not.toBe(hashSeed('u2', 'c', 0))
  // NUL 分隔符防拼接歧义：('u:2','c') 与 ('u','2:c') 不是同一个输入
  expect(hashSeed('u:2', 'c', 0)).not.toBe(hashSeed('u', '2:c', 0))
})

test('shuffle：结果是原元素的一个排列，且不改输入', () => {
  const rng = seedRng(1234)
  const src = [1, 2, 3, 4, 5, 6, 7, 8]
  const out = shuffle(src, rng)
  expect([...out].sort((x, y) => x - y)).toEqual(src)
  expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
})

test('shuffle：同种子逐字节复现', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(9))
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(9))
  expect(a).toEqual(b)
})

test('shuffle：空数组与单元素不炸', () => {
  expect(shuffle([], seedRng(1))).toEqual([])
  expect(shuffle(['x'], seedRng(1))).toEqual(['x'])
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/options/rng.test.ts`
Expected: FAIL —— 无法解析 `rng.js`

- [ ] **Step 3: 实现 `src/lib/options/rng.ts`**

```ts
/**
 * 确定性随机源（§4.3 算法规格第 1 条）。
 *
 * 为什么不用 Math.random()：可单测、review_log.distractorIds 真能复现而不只是
 * 记录、服务端能校验客户端结果、同构一致性（§11）——四件事都要求
 * 「同 seed 必同序列」。sfc32 十几行，统计性质足够选项抽取用。
 */

export type Rng = () => number   // [0, 1)

/** FNV-1a 32 位。纯整数运算（Math.imul），Node 与浏览器逐字节一致 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const out = (t + d) | 0
    c = (c + out) | 0
    return (out >>> 0) / 4294967296
  }
}

/** splitmix32：把单个种子摊开成 sfc32 需要的四个状态字 */
function splitmix32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x9e3779b9) | 0
    let t = Math.imul(s ^ (s >>> 16), 0x21f0aaad)
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97)
    return (t ^ (t >>> 15)) >>> 0
  }
}

export function seedRng(seed: number): Rng {
  const next = splitmix32(seed)
  return sfc32(next(), next(), next(), next())
}

/**
 * §4.3：seed = hash(userId, cardId, reviewIndex)。
 * 同一用户同一张卡第 N 次复习永远拿到同一套选项；N 变则选项变。
 * 用 NUL 字符作分隔符防拼接歧义：('u:2','c') 与 ('u','2:c')
 * 不会碰撞成同一字符串。
 */
export function hashSeed(userId: string, cardId: string, reviewIndex: number): number {
  return fnv1a(`${userId}\u0000${cardId}\u0000${reviewIndex}`)
}

/** Fisher-Yates 洗牌。返回新数组，不改输入（纯函数纪律，同 lib/scheduler） */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/options/rng.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/options/rng.ts tests/lib/options/rng.test.ts
git commit -m "feat(options): 确定性随机源——fnv1a 种子 + sfc32 + Fisher-Yates"
```

---

### Task 2: 最小类型 + 互斥反向索引 + 同块池

**Files:**
- Create: `src/lib/options/types.ts`
- Create: `src/lib/options/draw.ts`（本任务只写索引与同块池）
- Test: `tests/lib/options/draw-pool.test.ts`

**Interfaces:**
- Produces: `CardType`（五型字面量）、`Rational = { num, den }`、`OptionKeyPoint`（`{ id, text, public, excludeAsDistractorFor, retiredAt?, order? }`）、`OptionCard`（`{ id, blockId, cardType, keyPoints }`）、`DistractorPools = { sameBlock, crossBlock, neighbor }`、`OPTIONS_TOTAL = 9`、`ATOMIC_OPTIONS_TOTAL = 4`；`buildExclusionIndex(keyPoints): ReadonlyMap<string, ReadonlySet<string>>`（cardId → 对该卡也成立的要点 id 集）、`sameBlockPoolOf(card, cards): OptionKeyPoint[]`。

- [ ] **Step 1: 写失败测试 `tests/lib/options/draw-pool.test.ts`**

```ts
import { buildExclusionIndex, sameBlockPoolOf } from '../../../src/lib/options/draw.js'
import type { OptionCard, OptionKeyPoint } from '../../../src/lib/options/types.js'

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `要点 ${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function card(id: string, blockId: string, kpIds: string[], over: Partial<OptionCard> = {}): OptionCard {
  return { id, blockId, cardType: 'enumeration', keyPoints: kpIds.map(k => kp(k)), ...over }
}

test('反向索引：excludeAsDistractorFor 被反转成 cardId → 要点 id 集合（§4.3 规格第 4 条）', () => {
  const kps = [
    kp('a1', { excludeAsDistractorFor: ['t1', 't2'] }),
    kp('a2', { excludeAsDistractorFor: ['t1'] }),
    kp('a3', { excludeAsDistractorFor: [] }),
  ]
  const idx = buildExclusionIndex(kps)
  expect(idx.get('t1')).toEqual(new Set(['a1', 'a2']))
  expect(idx.get('t2')).toEqual(new Set(['a1']))
  expect(idx.has('t3')).toBe(false)
})

test('sameBlockPoolOf：同块他题、未退役、排除本题要点与同 id 伪卡', () => {
  const target = card('t1', 'b1', ['t1a', 't1b'])
  const others = [
    card('t2', 'b1', ['x']),
    card('t3', 'b1', ['t3a']),
    card('t4', 'b2', ['t4a']),            // 不同块：不进池
    card('t1', 'b1', ['t1c']),            // 与目标同 id 的伪卡：防御性排除
  ]
  others[0] = {
    ...others[0]!,
    keyPoints: [kp('t2a'), kp('t2r', { retiredAt: '2026-01-01' }), kp('t1a')],
  }
  const pool = sameBlockPoolOf(target, others)
  expect(pool.map(k => k.id)).toEqual(['t2a', 't3a'])
})

test('反向索引与逐条内联过滤给出同一答案（两套写法不漂移）', () => {
  const kps = [
    kp('a', { excludeAsDistractorFor: ['t9'] }),
    kp('b', { excludeAsDistractorFor: [] }),
    kp('c', { excludeAsDistractorFor: ['t8', 't9'] }),
  ]
  const idx = buildExclusionIndex(kps)
  const inline = new Set(kps.filter(k => k.excludeAsDistractorFor.includes('t9')).map(k => k.id))
  expect(inline).toEqual(idx.get('t9'))
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/options/draw-pool.test.ts`
Expected: FAIL —— 无法解析 `types.js` / `draw.js`

- [ ] **Step 3: 实现 `src/lib/options/types.ts`**

```ts
/**
 * lib/options 的最小输入类型。结构上是 lib/content Card/KeyPoint 的子集——
 * 零依赖纪律（同 lib/scheduler 的 SchedulableCard 先例）：内容侧字段再多，
 * 出题只认这里列出的。
 */
export type CardType = 'enumeration' | 'comparison' | 'sequence' | 'judgment' | 'atomic'

/** 结构兼容 lib/scheduler 的 Rational：整数分子/分母，den > 0 */
export type Rational = { num: number; den: number }

export type OptionKeyPoint = {
  id: string
  text: string
  /** SEO lead-in 与免费用户跨块池的成员资格（§4.3） */
  public: boolean
  /** 本要点对这些题也成立，不得抽作它们的干扰项 */
  excludeAsDistractorFor: string[]
  /** 退役要点不再进入选项（§7 tombstone：保留 id 供 review_log 引用） */
  retiredAt?: string
  /** 仅 sequence 型：步骤序号，从 1 起——顺序就是这型题的答案 */
  order?: number
}

export type OptionCard = {
  id: string
  blockId: string
  cardType: CardType
  keyPoints: OptionKeyPoint[]
}

/**
 * 三层干扰项池（§4.3）。跨块层装什么由 lib/entitlement 决定（免费 = 公开
 * 要点池，付费 = 整个大类），装配发生在 server（计划 4），本库只消费。
 */
export type DistractorPools = {
  /** 同块其他题的要点 */
  sameBlock: OptionKeyPoint[]
  /** 同大类其他块的要点（免费用户这里只装 public 池） */
  crossBlock: OptionKeyPoint[]
  /** 相邻大类的要点：两层枯竭时兜底，触发 degradedTo='neighbor' */
  neighbor: OptionKeyPoint[]
}

/** §4.3 出题规则：多选选项总数固定 9——选项个数不携带"几条是对的"信息 */
export const OPTIONS_TOTAL = 9

/** §4.3 分型表：atomic 单选 4 选 1 */
export const ATOMIC_OPTIONS_TOTAL = 4
```

- [ ] **Step 4: 实现 `src/lib/options/draw.ts`（本任务只写这两段）**

```ts
import type { OptionCard, OptionKeyPoint } from './types.js'

/**
 * 互斥反向索引（§4.3 算法规格第 4 条）。字段语义是"本要点对**这些题**也
 * 成立"，而抽取时要反向查询：给定目标题 T，排除所有 excludeAsDistractorFor
 * 含 T 的要点。内容同步 job（计划 4）物化一次，供运行期 O(1) 查询与审计。
 * 注意：库内的 drawDistractors 走内联过滤（池小，线性扫可忽略）——本索引
 * 是给外部消费者的物化形式，两套写法的等价性由 draw-pool.test.ts 锁住。
 */
export function buildExclusionIndex(
  keyPoints: readonly OptionKeyPoint[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const index = new Map<string, Set<string>>()
  for (const kp of keyPoints) {
    for (const targetCardId of kp.excludeAsDistractorFor) {
      const set = index.get(targetCardId) ?? new Set<string>()
      set.add(kp.id)
      index.set(targetCardId, set)
    }
  }
  return index
}

/**
 * 同块干扰项池（§4.3 层 1）：同 blockId、别的卡、未退役的要点。
 * 互斥过滤不在这一步——三个池在 drawDistractors（Task 3）里走同一套过滤。
 */
export function sameBlockPoolOf(card: OptionCard, cards: readonly OptionCard[]): OptionKeyPoint[] {
  const ownIds = new Set(card.keyPoints.map(kp => kp.id))
  return cards
    .filter(c => c.blockId === card.blockId && c.id !== card.id)
    .flatMap(c => c.keyPoints)
    .filter(kp => !kp.retiredAt && !ownIds.has(kp.id))
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm vitest run tests/lib/options/draw-pool.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/options/types.ts src/lib/options/draw.ts tests/lib/options/draw-pool.test.ts
git commit -m "feat(options): 最小类型 + 互斥反向索引 + 同块干扰项池"
```

---

### Task 3: 分层分数表 + `drawDistractors` 降级链

**Files:**
- Modify: `src/lib/options/draw.ts`（追加；import 区补 `import { shuffle } from './rng.js'`、`import type { Rng } from './rng.js'`、`import type { DistractorPools, Rational } from './types.js'`）
- Test: `tests/lib/options/draw-layer.test.ts`

**Interfaces:**
- Consumes: `OptionCard`/`OptionKeyPoint`/`DistractorPools`/`Rational`（Task 2）、`shuffle`/`Rng`（Task 1）。
- Produces: `layerCounts(total: number, s: Rational): { sameBlock: number; crossBlock: number }`、`Degradation = 'none' | 'neighbor'`、`drawDistractors(card, pools, count, s, rng): { keyPoints: OptionKeyPoint[]; degradedTo: Degradation }`。

- [ ] **Step 1: 写失败测试 `tests/lib/options/draw-layer.test.ts`**

```ts
import { layerCounts, drawDistractors } from '../../../src/lib/options/draw.js'
import { seedRng } from '../../../src/lib/options/rng.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, Rational } from '../../../src/lib/options/types.js'

const s = (num: number, den: number): Rational => ({ num, den })

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function poolOf(prefix: string, n: number): OptionKeyPoint[] {
  return Array.from({ length: n }, (_, i) => kp(`${prefix}${i}`))
}
function pools(same: OptionKeyPoint[], cross: OptionKeyPoint[], neighbor: OptionKeyPoint[] = []): DistractorPools {
  return { sameBlock: same, crossBlock: cross, neighbor }
}
function targetCard(): OptionCard {
  return { id: 't1', blockId: 'b1', cardType: 'enumeration', keyPoints: [kp('t1a'), kp('t1b'), kp('t1c')] }
}

test('分层比例分数表：四档各自正确，余数给跨块（交叉相乘，无浮点）', () => {
  expect(layerCounts(6, s(0, 1))).toEqual({ sameBlock: 2, crossBlock: 4 })   // 3s<1 → 1:2
  expect(layerCounts(6, s(1, 3))).toEqual({ sameBlock: 3, crossBlock: 3 })   // 3s=1 → 1:1
  expect(layerCounts(6, s(1, 2))).toEqual({ sameBlock: 3, crossBlock: 3 })   // 3s<2 → 1:1
  expect(layerCounts(6, s(2, 3))).toEqual({ sameBlock: 4, crossBlock: 2 })   // 3s=2 → 2:1
  expect(layerCounts(6, s(5, 6))).toEqual({ sameBlock: 4, crossBlock: 2 })   // s<1 → 2:1
  expect(layerCounts(6, s(1, 1))).toEqual({ sameBlock: 6, crossBlock: 0 })   // s=1 → 3:0
  // 余数给跨块：5 条按 1:2 → 1 + 4；按 2:1 → 3 + 2
  expect(layerCounts(5, s(0, 1))).toEqual({ sameBlock: 1, crossBlock: 4 })
  expect(layerCounts(5, s(2, 3))).toEqual({ sameBlock: 3, crossBlock: 2 })
  // 未约分输入同样正确：2/4 与 1/2 同档
  expect(layerCounts(6, s(2, 4))).toEqual({ sameBlock: 3, crossBlock: 3 })
})

test('按层抽取：条数精确、层来源符合比例、无重复', () => {
  const r = drawDistractors(targetCard(), pools(poolOf('s', 10), poolOf('c', 10)), 6, s(0, 1), seedRng(1))
  expect(r.keyPoints).toHaveLength(6)
  expect(r.degradedTo).toBe('none')
  const ids = r.keyPoints.map(k => k.id)
  expect(new Set(ids).size).toBe(6)
  expect(ids.filter(i => i.startsWith('s'))).toHaveLength(2)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(4)
})

test('互斥与本题要点永不被抽中（§11）', () => {
  const same = [
    kp('sx1', { excludeAsDistractorFor: ['t1'] }),   // 对目标卡成立：禁抽
    kp('t1a'),                                        // 与本题要点同 id：禁抽
    kp('s0'), kp('s1'), kp('s2'),
  ]
  const cross = [
    kp('cx1', { excludeAsDistractorFor: ['t2', 't1'] }),   // 对目标卡成立：禁抽
    ...poolOf('c', 6),
  ]
  const r = drawDistractors(targetCard(), pools(same, cross), 6, s(0, 1), seedRng(2))
  const ids = r.keyPoints.map(k => k.id)
  expect(ids).not.toContain('sx1')
  expect(ids).not.toContain('cx1')
  expect(ids).not.toContain('t1a')
  expect(r.keyPoints).toHaveLength(6)   // 被过滤掉的不占名额——总数绝不少给
})

test('同块不足 → 缺口滚给跨块，总数不变、不算降级', () => {
  const r = drawDistractors(targetCard(), pools(poolOf('s', 1), poolOf('c', 10)), 6, s(1, 1), seedRng(3))
  // s=1 → 3:0 全要同块，但同块只有 1 条 → 5 条缺口由跨块补
  const ids = r.keyPoints.map(k => k.id)
  expect(ids.filter(i => i.startsWith('s'))).toHaveLength(1)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(5)
  expect(r.degradedTo).toBe('none')
})

test('两层枯竭 → 相邻大类兜底并降级标记', () => {
  const r = drawDistractors(targetCard(), pools([], poolOf('c', 1), poolOf('n', 10)), 6, s(0, 1), seedRng(4))
  const ids = r.keyPoints.map(k => k.id)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(1)
  expect(ids.filter(i => i.startsWith('n'))).toHaveLength(5)
  expect(r.degradedTo).toBe('neighbor')
})

test('三层全枯竭 → 抛错，绝不静默少给（§4.3 规格第 2 条）', () => {
  expect(() =>
    drawDistractors(targetCard(), pools([], [], poolOf('n', 1)), 3, s(0, 1), seedRng(5)),
  ).toThrow()
})

test('跨层重叠也不重复：同 id 要点在两层都出现时只抽一次，总数不少给', () => {
  const shared = kp('d0')
  const same = [shared, kp('s1'), kp('s2')]
  const cross = [shared, ...poolOf('c', 6)]
  const r = drawDistractors(targetCard(), pools(same, cross), 6, s(0, 1), seedRng(6))
  const ids = r.keyPoints.map(k => k.id)
  expect(new Set(ids).size).toBe(6)                    // 无重复
  expect(ids).toHaveLength(6)                          // 且绝不少给
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/options/draw-layer.test.ts`
Expected: FAIL —— `layerCounts` 未导出

- [ ] **Step 3: 在 `src/lib/options/draw.ts` 末尾追加**

```ts
/**
 * 分层比例（§4.3 算法规格第 3 条）：分数表 + 交叉相乘，与 §5.2 起始档表同构。
 * 掌握度越高同块占比越大——池子不变而辨别难度上升。这是 §12 ④ 修正后的
 * 唯一难度调节旋钮（"缩窄池子/加干扰项数"两条旧路径都在加速枯竭，已作废）。
 */
export function layerCounts(
  total: number,
  s: Rational,
): { sameBlock: number; crossBlock: number } {
  let wSame = 1
  let wCross = 2                                   // 3·s < 1 → 1:2
  if (s.num === s.den) {
    wSame = 3; wCross = 0                          // s = 1 → 3:0
  } else if (3 * s.num >= 2 * s.den) {
    wSame = 2; wCross = 1                          // 3·s ≥ 2 且 s < 1 → 2:1
  } else if (3 * s.num >= s.den) {
    wSame = 1; wCross = 1                          // 3·s ≥ 1 且 3·s < 2 → 1:1
  }
  const same = Math.floor((total * wSame) / (wSame + wCross))
  return { sameBlock: same, crossBlock: total - same }   // 余数给跨块层
}

export type Degradation = 'none' | 'neighbor'

/**
 * 干扰项抽取（§4.3）。
 *
 * - 过滤三连：退役、本题要点、excludeAsDistractorFor 含目标卡（三个池同一套）
 * - 分层抽取：同块不足的份额滚给跨块；两层都枯竭 → 相邻大类兜底并置
 *   degradedTo='neighbor'（调用方记日志告警——跨大类概念撞车率低，抽检即可）
 * - 绝不少给：三层全枯竭仍不足 → 抛错。少给会让选项总数变化，直接泄露
 *   正确条数（§4.3），比崩溃更糟
 * - 同一条绝不重复（按 id 去重，跨层重叠也防）
 */
export function drawDistractors(
  card: OptionCard,
  pools: DistractorPools,
  count: number,
  s: Rational,
  rng: Rng,
): { keyPoints: OptionKeyPoint[]; degradedTo: Degradation } {
  const ownIds = new Set(card.keyPoints.map(kp => kp.id))
  const eligible = (pool: OptionKeyPoint[]) =>
    pool.filter(
      kp => !kp.retiredAt && !ownIds.has(kp.id) && !kp.excludeAsDistractorFor.includes(card.id),
    )

  const taken = new Map<string, OptionKeyPoint>()   // 插入序 = 层序，输出确定
  const takeFrom = (pool: OptionKeyPoint[], want: number): number => {
    for (const kp of shuffle(eligible(pool), rng)) {
      if (want === 0) break
      if (taken.has(kp.id)) continue
      taken.set(kp.id, kp)
      want--
    }
    return want                                     // 返回剩余缺口
  }

  const layers = layerCounts(count, s)
  let shortfall = takeFrom(pools.sameBlock, layers.sameBlock)
  shortfall = takeFrom(pools.crossBlock, layers.crossBlock + shortfall)
  let degradedTo: Degradation = 'none'
  if (shortfall > 0) {
    degradedTo = 'neighbor'
    shortfall = takeFrom(pools.neighbor, shortfall)
  }
  if (shortfall > 0) {
    throw new Error(
      `干扰项池枯竭：${card.id} 需要 ${count} 条，三层合计仍缺 ${shortfall} 条` +
      '（内容缺陷，构建期解决，绝不静默少给）',
    )
  }
  return { keyPoints: [...taken.values()], degradedTo }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/options/draw-layer.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/options/draw.ts tests/lib/options/draw-layer.test.ts
git commit -m "feat(options): 分层分数表 + 干扰项抽取降级链——绝不少给、绝不重复"
```

---

### Task 4: 选项集预生成 `prepareOptions`

**Files:**
- Create: `src/lib/options/prepare.ts`
- Test: `tests/lib/options/prepare.test.ts`

**Interfaces:**
- Consumes: `drawDistractors`（Task 3）、`hashSeed`/`seedRng`/`shuffle`（Task 1）、`OPTIONS_TOTAL`/`ATOMIC_OPTIONS_TOTAL` 与类型（Task 2）。
- Produces: `PreparedVariant = { optionTexts: string[]; correctIndices: number[]; distractorKeyPointIds: string[] }`、`PreparedOptions = { cardId: string; variants: PreparedVariant[] }`（§4.3 原文类型）、`prepareOptions(card, pools, s, userId, reviewIndexBase, K): PreparedOptions`。

- [ ] **Step 1: 写失败测试 `tests/lib/options/prepare.test.ts`**

```ts
import { prepareOptions } from '../../../src/lib/options/prepare.js'
import type { DistractorPools, OptionCard, OptionKeyPoint } from '../../../src/lib/options/types.js'

const S0 = { num: 0, den: 1 }

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function poolOf(prefix: string, n: number): OptionKeyPoint[] {
  return Array.from({ length: n }, (_, i) => kp(`${prefix}${i}`))
}
function bigPools(): DistractorPools {
  return { sameBlock: poolOf('s', 10), crossBlock: poolOf('c', 12), neighbor: [] }
}
function enumCard(n: number): OptionCard {
  return {
    id: 'e1', blockId: 'b1', cardType: 'enumeration',
    keyPoints: Array.from({ length: n }, (_, i) => kp(`k${i}`)),
  }
}

test('选项总数恒为 9：正确 3/4/6 条都不改变总数（§4.3 防数数）', () => {
  for (const n of [3, 4, 6]) {
    const r = prepareOptions(enumCard(n), bigPools(), S0, 'u1', 0, 2)
    for (const v of r.variants) {
      expect(v.optionTexts).toHaveLength(9)
      expect(v.correctIndices).toHaveLength(n)
      expect(v.distractorKeyPointIds).toHaveLength(9 - n)
      expect(v.correctIndices.every(i => i >= 0 && i < 9)).toBe(true)
    }
  }
})

test('atomic：4 选 1，正确项 = 首条要点', () => {
  const card: OptionCard = { id: 'a1', blockId: 'b1', cardType: 'atomic', keyPoints: [kp('k0')] }
  const r = prepareOptions(card, bigPools(), S0, 'u1', 0, 1)
  const v = r.variants[0]!
  expect(v.optionTexts).toHaveLength(4)
  expect(v.correctIndices).toHaveLength(1)
  expect(v.distractorKeyPointIds).toHaveLength(3)
  // 正确项真的指向首条要点，且本题要点没被误抽成干扰项
  expect(v.optionTexts[v.correctIndices[0]!]).toBe('T-k0')
  expect(v.distractorKeyPointIds).not.toContain('k0')
})

test('sequence：选项不打乱——按 order 排列，无干扰项，K 份变体全同（§4.3 强制例外 / §11）', () => {
  // keyPoints 数组故意乱序存放，order 才是答案；order 与 id 对齐（k0=1..k3=4）
  const card: OptionCard = {
    id: 'q1', blockId: 'b1', cardType: 'sequence',
    keyPoints: [
      kp('k2', { order: 3 }), kp('k0', { order: 1 }),
      kp('k3', { order: 4 }), kp('k1', { order: 2 }),
    ],
  }
  const r = prepareOptions(card, bigPools(), S0, 'u1', 0, 3)
  for (const v of r.variants) {
    expect(v.optionTexts).toEqual(['T-k0', 'T-k1', 'T-k2', 'T-k3'])   // order 1..4
    expect(v.correctIndices).toEqual([0, 1, 2, 3])                    // 呈现序即正确序
    expect(v.distractorKeyPointIds).toEqual([])
  }
  expect(r.variants[0]).toEqual(r.variants[1])
  expect(r.variants[1]).toEqual(r.variants[2])
})

test('同 seed 复现：同一输入两次调用逐字节相等（§11）', () => {
  const card = enumCard(4)
  const a = prepareOptions(card, bigPools(), S0, 'u1', 7, 3)
  const b = prepareOptions(card, bigPools(), S0, 'u1', 7, 3)
  expect(a).toEqual(b)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
})

test('每次重抽：K 份变体的 rng 派生自不同 reviewIndex，选项排布不全相同（§4.3）', () => {
  const r = prepareOptions(enumCard(3), bigPools(), S0, 'u1', 0, 3)
  expect(r.variants[0]).not.toEqual(r.variants[1])
  expect(r.variants[1]).not.toEqual(r.variants[2])
})

test('不同用户不同选项：userId 参与 seed（§4.3 规格第 1 条）', () => {
  const card = enumCard(3)
  const a = prepareOptions(card, bigPools(), S0, 'alice', 0, 1)
  const b = prepareOptions(card, bigPools(), S0, 'bob', 0, 1)
  expect(a).not.toEqual(b)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/options/prepare.test.ts`
Expected: FAIL —— 无法解析 `prepare.js`

- [ ] **Step 3: 实现 `src/lib/options/prepare.ts`**

```ts
import { hashSeed, seedRng, shuffle } from './rng.js'
import type { Rng } from './rng.js'
import { drawDistractors } from './draw.js'
import { ATOMIC_OPTIONS_TOTAL, OPTIONS_TOTAL } from './types.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, Rational } from './types.js'

export type PreparedVariant = {
  /** 选项文本，已按 rng 打乱（sequence 例外：固定顺序） */
  optionTexts: string[]
  /** 正确选项的下标——判分用，客户端离线判分需要（§4.3） */
  correctIndices: number[]
  /** 被抽中的干扰项要点 id——只回传记录供复现，不用于渲染（§4.3） */
  distractorKeyPointIds: string[]
}

export type PreparedOptions = {
  cardId: string
  /** K 份，对应该卡接下来 K 次复习（§4.3 服务端预生成、随队列下发） */
  variants: PreparedVariant[]
}

/**
 * 预生成选项集（§4.3）。第 i 份变体的 rng 由 (userId, cardId,
 * reviewIndexBase + i) 派生——同一次复习永远同一套选项（可复现），
 * 下一次复习换一套（每次重抽，免疫"记住位置不记内容"）。
 *
 * 分型规则（§4.3 分型表）：
 * - enumeration / comparison / judgment：要点阶段多选，选项恒 9，
 *   干扰项 = 9 − 正确数。comparison 的"成对呈现/反转变体优先"是内容
 *   撰写期的约定（§4.3 记录在案），选项层与枚举同构；judgment 的结论
 *   三选（会/不会/取决于）是静态 UI 文案，不属数据层（见计划尾注）
 * - sequence：排序题。选项 = 本题要点按 order 排列，**绝不打乱**（顺序
 *   即答案），无干扰项，correctIndices = [0..n-1] 表示呈现序即正确序
 * - atomic：4 选 1，正确项 = 首条要点（内容侧约定 atomic 题写 1 条要点）
 */
export function prepareOptions(
  card: OptionCard,
  pools: DistractorPools,
  s: Rational,
  userId: string,
  reviewIndexBase: number,
  K: number,
): PreparedOptions {
  const live = card.keyPoints.filter(kp => !kp.retiredAt)
  const variants: PreparedVariant[] = []
  for (let i = 0; i < K; i++) {
    const rng = seedRng(hashSeed(userId, card.id, reviewIndexBase + i))
    variants.push(buildVariant(card, live, pools, s, rng))
  }
  return { cardId: card.id, variants }
}

function buildVariant(
  card: OptionCard,
  correctPoints: OptionKeyPoint[],
  pools: DistractorPools,
  s: Rational,
  rng: Rng,
): PreparedVariant {
  if (card.cardType === 'sequence') {
    const ordered = [...correctPoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return {
      optionTexts: ordered.map(kp => kp.text),
      correctIndices: ordered.map((_, i) => i),
      distractorKeyPointIds: [],
    }
  }
  const total = card.cardType === 'atomic' ? ATOMIC_OPTIONS_TOTAL : OPTIONS_TOTAL
  const correctCount = card.cardType === 'atomic' ? 1 : correctPoints.length
  const { keyPoints: distractors } = drawDistractors(card, pools, total - correctCount, s, rng)

  type Entry = { text: string; correct: boolean; distractorId?: string }
  const entries: Entry[] = [
    ...correctPoints.slice(0, correctCount).map(kp => ({ text: kp.text, correct: true })),
    ...distractors.map(kp => ({ text: kp.text, correct: false, distractorId: kp.id })),
  ]
  const arranged = shuffle(entries, rng)
  return {
    optionTexts: arranged.map(e => e.text),
    correctIndices: arranged.flatMap((e, i) => (e.correct ? [i] : [])),
    distractorKeyPointIds: arranged.flatMap(e => (e.distractorId ? [e.distractorId] : [])),
  }
}
```

（若 sequence 那条失败：先核对夹具的 `order` 值——正确行为是**按 order 升序排列**，禁止为了让测试变绿去改排序键；id 与 order 不同序的真实内容卡恰恰依赖这个排序。）

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/options/prepare.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/options/prepare.ts tests/lib/options/prepare.test.ts
git commit -m "feat(options): 选项集预生成——总数恒定、sequence 不打乱、同 seed 复现"
```

---

### Task 5: 四型单次得分 `mastery/score.ts`

**Files:**
- Create: `src/lib/mastery/types.ts`
- Create: `src/lib/mastery/score.ts`
- Test: `tests/lib/mastery/score.test.ts`

**Interfaces:**
- Produces: `Rational`/`Frequency`/`Phase`/`rat(num, den)`（约分）/`FREQ_WEIGHT = { high: 3, mid: 2, low: 1 }`（types）；`scoreSelection(correctSelected, wrongSelected, totalCorrect): Rational`、`scoreSequence(userOrder, canonicalOrder): Rational`、`scoreJudgment(conclusionCorrect, pointsScore): Rational`、`scoreAtomic(correct): Rational`（score）。

**计分表（§4.4，照抄）**：枚举/对比 `max(0, (勾对−勾错)/正确总数)`（减勾错数堵"乱勾全选"，下限 0）；sequence `1 − 逆序对数/最大逆序对数`（全序正确得 1）；judgment 结论错 → 0、结论对 → `0.5 + 0.5 × 要点得分`；atomic 对 1 错 0。

- [ ] **Step 1: 写失败测试 `tests/lib/mastery/score.test.ts`**

```ts
import {
  scoreSelection, scoreSequence, scoreJudgment, scoreAtomic,
} from '../../../src/lib/mastery/score.js'

test('scoreSelection：max(0, (对−错)/总数)——减勾错数堵乱勾全选，下限 0', () => {
  expect(scoreSelection(2, 0, 3)).toEqual({ num: 2, den: 3 })
  expect(scoreSelection(3, 1, 3)).toEqual({ num: 2, den: 3 })
  expect(scoreSelection(1, 1, 3)).toEqual({ num: 0, den: 1 })   // 对错相抵
  expect(scoreSelection(0, 5, 3)).toEqual({ num: 0, den: 1 })   // 下限 0（§4.4）
  expect(scoreSelection(3, 0, 3)).toEqual({ num: 1, den: 1 })
})

test('scoreSelection：正确总数 < 1 或勾对数超总数是调用方 bug，抛错', () => {
  expect(() => scoreSelection(1, 0, 0)).toThrow()
  expect(() => scoreSelection(4, 0, 3)).toThrow()   // 勾对数 > 正确总数 → 会破坏 [0,1]
  expect(() => scoreSelection(-1, 0, 3)).toThrow()
})

test('scoreSelection：勾错数为负是调用方 bug，抛错', () => {
  expect(() => scoreSelection(1, -1, 3)).toThrow()
})

test('scoreSequence：全序满分、全反 0 分、部分分按逆序对（§4.4）', () => {
  const canon = ['a', 'b', 'c', 'd']
  expect(scoreSequence(canon, canon)).toEqual({ num: 1, den: 1 })
  expect(scoreSequence(['d', 'c', 'b', 'a'], canon)).toEqual({ num: 0, den: 1 })
  // [b,a,c,d] 恰 1 个逆序对，最大 6 → 5/6
  expect(scoreSequence(['b', 'a', 'c', 'd'], canon)).toEqual({ num: 5, den: 6 })
  // [c,d,a,b] 逆序对 (c,a)(c,b)(d,a)(d,b) = 4 → 2/6 = 1/3
  expect(scoreSequence(['c', 'd', 'a', 'b'], canon)).toEqual({ num: 1, den: 3 })
  // 单元素：无逆序可言，满分（防御路径，schema 要求 sequence ≥ 4 要点）
  expect(scoreSequence(['a'], ['a'])).toEqual({ num: 1, den: 1 })
})

test('scoreSequence：不是排列直接抛错（调用方 bug）', () => {
  expect(() => scoreSequence(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toThrow()
  expect(() => scoreSequence(['a', 'b', 'e', 'd'], ['a', 'b', 'c', 'd'])).toThrow()
})

test('scoreJudgment：结论错 0 分；结论对 = 1/2 + 要点分/2（§4.4）', () => {
  expect(scoreJudgment(false, { num: 1, den: 1 })).toEqual({ num: 0, den: 1 })
  expect(scoreJudgment(true, { num: 0, den: 1 })).toEqual({ num: 1, den: 2 })
  expect(scoreJudgment(true, { num: 1, den: 2 })).toEqual({ num: 3, den: 4 })
  expect(scoreJudgment(true, { num: 2, den: 3 })).toEqual({ num: 5, den: 6 })
  expect(scoreJudgment(true, { num: 1, den: 1 })).toEqual({ num: 1, den: 1 })
})

test('scoreAtomic 与归一化：四型结果全部落在 [0,1] 且为精确分数（§11）', () => {
  expect(scoreAtomic(true)).toEqual({ num: 1, den: 1 })
  expect(scoreAtomic(false)).toEqual({ num: 0, den: 1 })
  const all = [
    scoreSelection(0, 0, 5), scoreSelection(5, 0, 5), scoreSelection(2, 3, 5),
    scoreSequence(['a'], ['a']),
    scoreSequence(['b', 'a', 'd', 'c'], ['a', 'b', 'c', 'd']),
    scoreJudgment(true, { num: 1, den: 3 }),
    scoreJudgment(false, { num: 1, den: 3 }),
    scoreAtomic(false), scoreAtomic(true),
  ]
  for (const r of all) {
    expect(r.den).toBeGreaterThan(0)
    expect(r.num).toBeGreaterThanOrEqual(0)
    expect(r.num).toBeLessThanOrEqual(r.den)   // 整数比较，不用浮点
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/mastery/score.test.ts`
Expected: FAIL —— 无法解析 `types.js` / `score.js`

- [ ] **Step 3: 实现 `src/lib/mastery/types.ts`**

```ts
/**
 * lib/mastery 最小类型。Rational 与 lib/scheduler 同形（{ num, den }，den > 0）
 * ——掌握度得分可直接喂 scheduler 的 startTier / maintenanceStep，两边零 import。
 */
export type Rational = { num: number; den: number }

export type Frequency = 'high' | 'mid' | 'low'

export type Phase = 'new' | 'learning' | 'done' | 'paused'

/** §4.4：块掌握度权重 high=3 mid=2 low=1（与 scheduler FREQ_ORDER 同值，零 import） */
export const FREQ_WEIGHT: Record<Frequency, number> = { high: 3, mid: 2, low: 1 }

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function rat(num: number, den: number): Rational {
  if (den <= 0) throw new Error(`分母必须为正：${num}/${den}`)
  const g = gcd(Math.abs(num), den) || 1
  return { num: num / g, den: den / g }
}
```

- [ ] **Step 4: 实现 `src/lib/mastery/score.ts`**

```ts
import { rat } from './types.js'
import type { Rational } from './types.js'

/**
 * 枚举 / 对比 / judgment 要点阶段共用（§4.4 计分表"同上"）：
 * max(0, (勾对 − 勾错) / 正确要点总数)。
 * 减勾错数堵"乱勾全选"——不扣错的话全选就能拿满分；下限 0 避免负分
 * 传进 §5.2 的起始档判断。
 */
export function scoreSelection(
  correctSelected: number,
  wrongSelected: number,
  totalCorrect: number,
): Rational {
  if (totalCorrect < 1) throw new Error(`正确要点总数必须 ≥ 1：${totalCorrect}`)
  if (correctSelected < 0 || wrongSelected < 0 || correctSelected > totalCorrect) {
    throw new Error(
      `非法勾选数：对 ${correctSelected} / 错 ${wrongSelected} / 总 ${totalCorrect}` +
      '——勾对数不得超过正确总数',
    )
  }
  return rat(Math.max(0, correctSelected - wrongSelected), totalCorrect)
}

/**
 * sequence 型（§4.4）：1 − 逆序对数/最大逆序对数，全序正确得 1。
 * n ≤ 6，O(n²) 计数足够。userOrder 必须是 canonicalOrder 的一个排列，
 * 不是则抛错——那是调用方 bug，不该被部分分掩盖。
 */
export function scoreSequence(
  userOrder: readonly string[],
  canonicalOrder: readonly string[],
): Rational {
  if (userOrder.length !== canonicalOrder.length) {
    throw new Error(`长度不一致：${userOrder.length} vs ${canonicalOrder.length}`)
  }
  const seen = new Set(userOrder)
  if (seen.size !== userOrder.length || canonicalOrder.some(id => !seen.has(id))) {
    throw new Error('userOrder 必须是 canonicalOrder 的一个排列')
  }
  const n = canonicalOrder.length
  if (n < 2) return { num: 1, den: 1 }   // 单元素无逆序可言
  const pos = new Map(canonicalOrder.map((id, i) => [id, i] as const))
  const seq = userOrder.map(id => pos.get(id)!)
  let inv = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (seq[i]! > seq[j]!) inv++
    }
  }
  const maxInv = (n * (n - 1)) / 2
  return rat(maxInv - inv, maxInv)
}

/**
 * judgment 型（§4.4）：结论错 → 0；结论对 → 结论分 0.5 + 0.5 × 要点得分。
 * 整数运算：(den + num) / (2·den)，无浮点。
 */
export function scoreJudgment(conclusionCorrect: boolean, pointsScore: Rational): Rational {
  if (!conclusionCorrect) return { num: 0, den: 1 }
  return rat(pointsScore.den + pointsScore.num, pointsScore.den * 2)
}

/** atomic 型（§4.4）：对 1 错 0，不走 keyPoints 计分 */
export function scoreAtomic(correct: boolean): Rational {
  return correct ? { num: 1, den: 1 } : { num: 0, den: 1 }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm vitest run tests/lib/mastery/score.test.ts`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/mastery/types.ts src/lib/mastery/score.ts tests/lib/mastery/score.test.ts
git commit -m "feat(mastery): 四型单次得分——精确分数、下限 0、归一化 [0,1]"
```

---

### Task 6: 块掌握度 `mastery/block.ts`

**Files:**
- Create: `src/lib/mastery/block.ts`
- Test: `tests/lib/mastery/block.test.ts`

**Interfaces:**
- Consumes: `rat`/`FREQ_WEIGHT`/`Rational`/`Frequency`/`Phase`（Task 5 的 types）。
- Produces: `BlockEntry = { frequency: Frequency; phase: Phase; s: Rational }`、`BlockMastery = { kind: 'untried' } | { kind: 'score'; value: Rational }`、`blockMastery(entries: readonly BlockEntry[]): BlockMastery`。

**口径（§4.4）**：分母只算**传入**的卡（收窄排除、跨块过滤都由调用方先做——"分母只算计划内的卡"）；`phase='new'` 不进分母（明文）；`paused` 不进分母（块被取消 = 不在当前计划内）；计入项为空 → `untried`（地图显示"未刷"而非 0%）。

- [ ] **Step 1: 写失败测试 `tests/lib/mastery/block.test.ts`**

```ts
import { blockMastery } from '../../../src/lib/mastery/block.js'
import type { BlockEntry } from '../../../src/lib/mastery/block.js'

const q = (num: number, den: number) => ({ num, den })

test('权重加权：high 满分 + mid 满分 + low 零分 = 5/6（§4.4）', () => {
  const r = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 1) },
    { frequency: 'mid', phase: 'learning', s: q(1, 1) },
    { frequency: 'low', phase: 'learning', s: q(0, 1) },
  ])
  expect(r).toEqual({ kind: 'score', value: { num: 5, den: 6 } })
})

test('new 不进分母：混入 new(满分, high) 不改变结果；全 new → 未刷', () => {
  const learning: BlockEntry = { frequency: 'low', phase: 'learning', s: q(0, 1) }
  expect(blockMastery([learning, { frequency: 'high', phase: 'new', s: q(1, 1) }]))
    .toEqual(blockMastery([learning]))
  expect(blockMastery([{ frequency: 'high', phase: 'new', s: q(1, 1) }]))
    .toEqual({ kind: 'untried' })
})

test('paused 不进分母（块被取消 = 不在当前计划内）；done 计入', () => {
  const r = blockMastery([
    { frequency: 'high', phase: 'paused', s: q(1, 1) },
    { frequency: 'mid', phase: 'done', s: q(1, 1) },
  ])
  expect(r).toEqual({ kind: 'score', value: { num: 1, den: 1 } })
})

test('空块 → 未刷（地图显示"未刷"而非 0%，§4.4）', () => {
  expect(blockMastery([])).toEqual({ kind: 'untried' })
})

test('权重真的起作用：同两个分数，频度排布不同结果不同', () => {
  const a = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 2) },
    { frequency: 'low', phase: 'learning', s: q(1, 1) },
  ])
  const b = blockMastery([
    { frequency: 'high', phase: 'learning', s: q(1, 1) },
    { frequency: 'low', phase: 'learning', s: q(1, 2) },
  ])
  expect(a).toEqual({ kind: 'score', value: { num: 5, den: 8 } })
  expect(b).toEqual({ kind: 'score', value: { num: 7, den: 8 } })
})

test('逐步归约防溢出：50 张 high 卡 s=5/6 → 恰好 5/6（连乘分母会在块规模内溢出）', () => {
  const entries = Array.from({ length: 50 }, () => ({
    frequency: 'high' as const, phase: 'learning' as const, s: q(5, 6),
  }))
  expect(blockMastery(entries)).toEqual({ kind: 'score', value: { num: 5, den: 6 } })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/mastery/block.test.ts`
Expected: FAIL —— 无法解析 `block.js`

- [ ] **Step 3: 实现 `src/lib/mastery/block.ts`**

```ts
import { rat, FREQ_WEIGHT } from './types.js'
import type { Frequency, Phase, Rational } from './types.js'

export type BlockEntry = {
  frequency: Frequency
  phase: Phase
  s: Rational
}

/** untried = 全部被排除/空输入：地图显示"未刷"，不是 0%（§4.4） */
export type BlockMastery = { kind: 'untried' } | { kind: 'score'; value: Rational }

/**
 * 块掌握度（§4.4）：块内**当前计划内**卡片的 s 加权平均，权重 high=3
 * mid=2 low=1。
 *
 * 口径三条：
 * - 分母只算**传入**的条目——被 §5.4 收窄排除的低频卡、别的块的卡，
 *   由调用方先过滤掉再传（spec 明文：分母只算计划内的卡）
 * - phase='new' 不进分母（从未刷过，s 无意义）；'paused' 不进分母
 *   （所属块被取消勾选，不在当前计划内）；'learning'/'done' 计入
 * - 计入项为空 → untried——避免"全是新卡的块显示 0% 红地图"这个死结
 *
 * 精确有理数：通分累加，**每步累加后立即约分**——无归约的连乘分母会在
 * 块规模内溢出（50 条 × den 6 → 6⁵⁰ ≫ 2⁵³；s 来自 weightedS，den 可达
 * 1296，更糟）。逐步归约后分母收敛到各 denᵢ 的 lcm 因子，安全。
 */
export function blockMastery(entries: readonly BlockEntry[]): BlockMastery {
  const counted = entries.filter(e => e.phase === 'learning' || e.phase === 'done')
  if (counted.length === 0) return { kind: 'untried' }

  let accNum = 0
  let accDen = 1
  let weightSum = 0
  for (const e of counted) {
    const w = FREQ_WEIGHT[e.frequency]
    // acc = acc + w · numᵢ/denᵢ —— 通分后立即 rat() 归约，防连乘溢出
    const next = rat(accNum * e.s.den + w * e.s.num * accDen, accDen * e.s.den)
    accNum = next.num
    accDen = next.den
    weightSum += w
  }
  return { kind: 'score', value: rat(accNum, accDen * weightSum) }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/mastery/block.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/mastery/block.ts tests/lib/mastery/block.test.ts
git commit -m "feat(mastery): 块掌握度——频度加权、new/paused 不进分母、空块未刷"
```

---

### Task 7: 权限边界 `entitlement`

**Files:**
- Create: `src/lib/entitlement/entitlement.ts`
- Test: `tests/lib/entitlement/entitlement.test.ts`

**Interfaces:**
- Produces: `Plan = 'free' | 'paid'`、`Entitlement = { plan: Plan; freeBlockIds: readonly string[] }`、`FREE_BLOCK_LIMIT = 2`、`makeFreeEntitlement(blockIds)`（去重后超 2 抛错）、`makePaidEntitlement()`、`isEntitled(ent, blockId)`、`entitledBlockIds(ent, allBlockIds)`（按 `allBlockIds` 顺序输出——确定）、`entitledCards<T extends { blockId: string }>(ent, cards): T[]`、`crossBlockPoolFor<T extends { public: boolean }>(ent, sameCategoryKeyPoints): T[]`（free 只取 `public`）。

- [ ] **Step 1: 写失败测试 `tests/lib/entitlement/entitlement.test.ts`**

```ts
import {
  makeFreeEntitlement, makePaidEntitlement, isEntitled,
  entitledBlockIds, entitledCards, crossBlockPoolFor, FREE_BLOCK_LIMIT,
} from '../../../src/lib/entitlement/entitlement.js'

test('免费层 = 任选 2 个块：限 2、去重、超选抛错（§10.1）', () => {
  expect(FREE_BLOCK_LIMIT).toBe(2)
  const ent = makeFreeEntitlement(['b1', 'b2'])
  expect(ent).toEqual({ plan: 'free', freeBlockIds: ['b1', 'b2'] })
  expect(makeFreeEntitlement(['b1', 'b1', 'b2']).freeBlockIds).toEqual(['b1', 'b2'])
  expect(() => makeFreeEntitlement(['b1', 'b2', 'b3'])).toThrow()
})

test('isEntitled：free 命中所选块；paid 恒 true', () => {
  const free = makeFreeEntitlement(['b1', 'b2'])
  expect(isEntitled(free, 'b1')).toBe(true)
  expect(isEntitled(free, 'b3')).toBe(false)
  expect(isEntitled(makePaidEntitlement(), 'anything')).toBe(true)
})

test('entitledBlockIds：paid 全量；free 交集且按 allBlockIds 顺序（确定）', () => {
  const all = ['b1', 'b2', 'b3', 'b4']
  expect(entitledBlockIds(makePaidEntitlement(), all)).toEqual(all)
  const free = makeFreeEntitlement(['b4', 'b1'])   // 故意乱序传入
  expect(entitledBlockIds(free, all)).toEqual(['b1', 'b4'])
})

test('entitledCards：只留有权块的卡（喂 schedule() 的 cards[]，§7）', () => {
  const cards = [
    { id: 'c1', blockId: 'b1' },
    { id: 'c2', blockId: 'b3' },
    { id: 'c3', blockId: 'b2' },
  ]
  expect(entitledCards(makeFreeEntitlement(['b1', 'b2']), cards).map(c => c.id))
    .toEqual(['c1', 'c3'])
  expect(entitledCards(makePaidEntitlement(), cards)).toHaveLength(3)
})

test('crossBlockPoolFor：免费只留 public，付费全量（§4.3/§11 泄露边界）', () => {
  const kps = [
    { id: 'p1', public: true },
    { id: 'h1', public: false },
    { id: 'p2', public: true },
    { id: 'h2', public: false },
  ]
  expect(crossBlockPoolFor(makeFreeEntitlement(['b1']), kps).map(k => k.id))
    .toEqual(['p1', 'p2'])
  expect(crossBlockPoolFor(makePaidEntitlement(), kps)).toHaveLength(4)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/entitlement/entitlement.test.ts`
Expected: FAIL —— 无法解析 `entitlement.js`

- [ ] **Step 3: 实现 `src/lib/entitlement/entitlement.ts`**

```ts
/**
 * 免费/付费边界（§10.1）：排期免费，题量付费。
 * 免费层是"完整的 2 个块"（约 30-50 题），不是"分散的 300 道"——后者每块
 * 3-5 题，恰好演示产品**不能**做什么，且超出 §5.6 的 157 道容量上限。
 */
export type Plan = 'free' | 'paid'

export type Entitlement = {
  plan: Plan
  /** 仅 free 生效：用户勾选的块。paid 恒为空数组 */
  freeBlockIds: readonly string[]
}

export const FREE_BLOCK_LIMIT = 2

export function makeFreeEntitlement(blockIds: readonly string[]): Entitlement {
  const unique = [...new Set(blockIds)]
  if (unique.length > FREE_BLOCK_LIMIT) {
    throw new Error(`免费层最多 ${FREE_BLOCK_LIMIT} 个块，收到 ${unique.length} 个（§10.1）`)
  }
  return { plan: 'free', freeBlockIds: unique }
}

export function makePaidEntitlement(): Entitlement {
  return { plan: 'paid', freeBlockIds: [] }
}

export function isEntitled(ent: Entitlement, blockId: string): boolean {
  return ent.plan === 'paid' || ent.freeBlockIds.includes(blockId)
}

/** 已解锁块全集。paid = 全部；free = 交集，按 allBlockIds 顺序输出——确定 */
export function entitledBlockIds(ent: Entitlement, allBlockIds: readonly string[]): string[] {
  if (ent.plan === 'paid') return [...allBlockIds]
  const free = new Set(ent.freeBlockIds)
  return allBlockIds.filter(id => free.has(id))
}

/**
 * 供 schedule() 的 cards[] 用（§7：entitlement 决定 cards[] 里能放哪些块）。
 * 泛型按 blockId 过滤，不耦合内容类型。
 */
export function entitledCards<T extends { blockId: string }>(
  ent: Entitlement,
  cards: readonly T[],
): T[] {
  return cards.filter(c => isEntitled(ent, c.blockId))
}

/**
 * 跨块干扰项池（§4.3 免费层）：免费用户只从**公开要点池**抽（约 200-400 条）
 * ——公开要点本来就在 SEO 页可见，泄露为零；未解锁块的非 public 要点
 * 绝不进入下发语料（§11）。付费 = 整个大类（他买了）。
 */
export function crossBlockPoolFor<T extends { public: boolean }>(
  ent: Entitlement,
  sameCategoryKeyPoints: readonly T[],
): T[] {
  return ent.plan === 'paid' ? [...sameCategoryKeyPoints] : sameCategoryKeyPoints.filter(kp => kp.public)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/entitlement/entitlement.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlement/entitlement.ts tests/lib/entitlement/entitlement.test.ts
git commit -m "feat(entitlement): 免费两块/付费全量 + 公开要点池边界"
```

---

### Task 8: §11 验收套件与 ROADMAP 收尾

**Files:**
- Test: `tests/lib/options/acceptance.test.ts`
- Modify: `docs/superpowers/ROADMAP.md`

**Interfaces:**
- Consumes: 三库全部导出（唯一一个跨库组合的测试文件——§11 的免费用户泄露边界本来就是 entitlement × options 的组合性质）。本任务是纯验收，不加新生产代码——除非某条失败暴露实现 bug（那就修实现，不改验收）。

**验收场景夹具**：大类 `mysql` 含 b1/b2/b3 三块各 3 卡，目标卡 `t1` ∈ b1；b3（未解锁）每条要点一半 public 一半非 public；b2 有一条要点登记了 `excludeAsDistractorFor: ['t1']`；相邻大类备 5 条要点。

- [ ] **Step 1: 写测试 `tests/lib/options/acceptance.test.ts`**

```ts
import { prepareOptions } from '../../../src/lib/options/prepare.js'
import { drawDistractors, sameBlockPoolOf } from '../../../src/lib/options/draw.js'
import type { OptionCard, OptionKeyPoint, DistractorPools } from '../../../src/lib/options/types.js'
import { crossBlockPoolFor, makeFreeEntitlement } from '../../../src/lib/entitlement/entitlement.js'
import { seedRng } from '../../../src/lib/options/rng.js'

const S0 = { num: 0, den: 1 }

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function card(id: string, blockId: string, cardType: OptionCard['cardType'], points: OptionKeyPoint[]): OptionCard {
  return { id, blockId, cardType, keyPoints: points }
}

/** 大类 mysql：b1/b2/b3 各 3 卡 × 每卡 3 要点；b3 未解锁，其要点 1 public + 2 私有 */
function buildCategory() {
  const mk = (blockId: string, n: number, publicFirst = false) =>
    Array.from({ length: n }, (_, i) =>
      card(`${blockId}-c${i}`, blockId, 'enumeration', [
        kp(`${blockId}-c${i}-p`, { public: publicFirst }),
        kp(`${blockId}-c${i}-x1`, { public: !publicFirst }),
        kp(`${blockId}-c${i}-x2`),
      ]),
    )
  const all = [...mk('b1', 3), ...mk('b2', 3), ...mk('b3', 3, true)]
  // b2 那条 public 要点对目标卡 t1 也成立：互斥登记。选 public 那条（b2-c0-x1）
  // 是刻意的——非 public 要点根本进不了免费跨块池，断言会空洞通过
  all[3]!.keyPoints[1] = { ...all[3]!.keyPoints[1]!, excludeAsDistractorFor: ['t1'] }
  // 目标卡固定用 b1 第一张，id 改为 t1
  all[0] = { ...all[0]!, id: 't1' }
  return all
}

function poolsFor(target: OptionCard, all: OptionCard[]): DistractorPools {
  const ent = makeFreeEntitlement(['b1', 'b2'])
  const otherBlocksPoints = all
    .filter(c => c.blockId !== target.blockId)
    .flatMap(c => c.keyPoints)
    .filter(p => !p.retiredAt)
  return {
    sameBlock: sameBlockPoolOf(target, all),
    crossBlock: crossBlockPoolFor(ent, otherBlocksPoints),
    // 相邻大类池同样过 public——免费用户手里不该有任何未解锁语料（§4.3
    // 「客户端永远不持有未解锁内容」，server 装配约定，计划 4 落实）
    neighbor: crossBlockPoolFor(
      ent,
      Array.from({ length: 5 }, (_, i) => kp(`nb${i}`, { public: true })),
    ),
  }
}

test('§11 免费用户：跨块干扰项只来自公开要点池，未解锁块的非 public 要点零出现', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  // 夹具自检：跨块池确实含 b3 的 public 要点且不含其私有要点
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && p.public)).toBe(true)
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && !p.public)).toBe(false)

  const forbidden = new Set(
    all.filter(c => c.blockId === 'b3').flatMap(c => c.keyPoints).filter(p => !p.public).map(p => p.text),
  )
  const r = prepareOptions(t1, pools, S0, 'u-free', 0, 21)   // 21 次复习全扫
  for (const v of r.variants) {
    expect(v.optionTexts).toHaveLength(9)
    for (const text of v.optionTexts) {
      expect(forbidden.has(text)).toBe(false)   // 泄露边界：一次都不许出现
    }
  }
})

test('§11 互斥项永不被抽中', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  const r = prepareOptions(t1, pools, S0, 'u1', 0, 21)
  for (const v of r.variants) {
    expect(v.distractorKeyPointIds).not.toContain('b2-c0-x1')
  }
})

test('§11 同一 seed 输出可复现：两次调用 JSON 逐字节相等', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  const a = prepareOptions(t1, pools, S0, 'u1', 0, 5)
  const b = prepareOptions(t1, pools, S0, 'u1', 0, 5)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
})

test('§11 选项总数恒定：五种 cardType 全型扫描', () => {
  const all = buildCategory()
  const pools = poolsFor(all[0]!, all)
  const cards: Array<{ card: OptionCard; wantTotal: number }> = [
    { card: card('e', 'b1', 'enumeration', [kp('a'), kp('b'), kp('c')]), wantTotal: 9 },
    { card: card('e4', 'b1', 'enumeration', [kp('a'), kp('b'), kp('c'), kp('d')]), wantTotal: 9 },
    { card: card('cmp', 'b1', 'comparison', [kp('a'), kp('b'), kp('c')]), wantTotal: 9 },
    { card: card('jd', 'b1', 'judgment', [kp('a'), kp('b')]), wantTotal: 9 },   // 2 要点 → 7 干扰项
    { card: card('at', 'b1', 'atomic', [kp('a')]), wantTotal: 4 },
    {
      card: card('seq', 'b1', 'sequence', [kp('a', { order: 1 }), kp('b', { order: 2 }), kp('c', { order: 3 }), kp('d', { order: 4 })]),
      wantTotal: 4,   // sequence = 要点数，不打乱
    },
  ]
  for (const { card: c, wantTotal } of cards) {
    const r = prepareOptions(c, pools, S0, 'u1', 0, 2)
    for (const v of r.variants) expect(v.optionTexts).toHaveLength(wantTotal)
  }
})

test('§11 池不足降级不断供：两层枯竭走相邻大类，总数仍 9', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const starved: DistractorPools = {
    sameBlock: [],
    // 挑一条无互斥登记的 public 要点——夹具里 b2-c0-x1 恰好对 t1 互斥禁抽，
    // 直接 slice(0,1) 会拿到它，跨块层可用实为 0 条，测试含义就变了
    crossBlock: poolsFor(t1, all).crossBlock.filter(p => p.id !== 'b2-c0-x1').slice(0, 1),
    neighbor: Array.from({ length: 8 }, (_, i) => kp(`nb${i}`)),
  }
  const d = drawDistractors(t1, starved, 6, S0, seedRng(11))
  expect(d.degradedTo).toBe('neighbor')
  expect(d.keyPoints).toHaveLength(6)
  const r = prepareOptions(t1, starved, S0, 'u1', 0, 1)
  expect(r.variants[0]!.optionTexts).toHaveLength(9)
})
```

- [ ] **Step 2: 运行确认通过（若失败，修实现而不是改断言）**

Run: `pnpm vitest run tests/lib/options/acceptance.test.ts`
Expected: 5 passed

- [ ] **Step 3: 全量回归**

Run: `pnpm test` 然后 `pnpm typecheck`
Expected: 计划 1+2 的 183 条 + 本计划 46 条 = 229 条全部 passed；typecheck 无输出

- [ ] **Step 4: 更新 ROADMAP**

`docs/superpowers/ROADMAP.md`：
1. 「五个实施计划」表中计划 3 的状态 `⬜ 未开始` → `✅ 已完成（lib/options + lib/mastery + lib/entitlement，纯函数零依赖）`；
2. 「一句话现状」「依赖关系图」与「下一步」按实际进度改写（计划 3 已交付，工程轨只剩计划 4 应用层与计划 5 支付；下一步指向计划 4）；
3. 文件头「最后更新」日期改为执行当日。

- [ ] **Step 5: Commit**

```bash
git add tests/lib/options/acceptance.test.ts docs/superpowers/ROADMAP.md
git commit -m "test(options): §11 验收——泄露边界、互斥、复现、总数恒定、降级不断供"
```

---

## 完成标准

- [ ] `pnpm test` 全绿（183 条基线不回归 + 46 条新增 = 229）
- [ ] `pnpm typecheck` 无输出
- [ ] §11 的 `lib/options` 行逐条落测：选项总数恒为 9（Task 4 + Task 8 全型扫描）、分层比例正确（Task 3 四档 + 余数）、互斥项永不被抽中（Task 3 + Task 8）、同 seed 可复现（Task 1/4 + Task 8）、池不足降级不断供（Task 3 + Task 8）、每种 cardType 各一组（Task 4 分型 + Task 8 扫描）、sequence 未被打乱（Task 4 明文断言）
- [ ] §11 的 `lib/mastery` 行：四种 cardType 公式各自正确且归一化 `[0,1]`（Task 5），块掌握度口径（Task 6）
- [ ] §11 的 `lib/entitlement` 行：免费跨块只 public、未解锁块的非 public 要点零出现（Task 7 + Task 8 组合验收）
- [ ] ROADMAP 已更新

## 与后续计划的衔接

- **计划 4（应用层）装配点**：取今日队列时对每卡调 `prepareOptions(card, pools, s, userId, reviewCount, K)`（K = 该卡剩余复习次数），`pools` 由 server 装配——`sameBlockPoolOf` + `crossBlockPoolFor(entitlement, …)` + 相邻大类池；`cards[]` 用 `entitledCards(ent, allCards)` 过滤后喂 `schedule()`。提交判分：按 `cardType` 分派 `scoreSelection`/`scoreSequence`/`scoreJudgment`/`scoreAtomic`，得分乘进 `weightedS`（lib/scheduler）更新 `s`；知识地图用 `blockMastery`。`degradedTo='neighbor'` 与 `drawDistractors` 抛错都要接 server 日志。
- **已知缺口（计划 4 前需内容侧补齐）**：① judgment 的正确结论（会/不会/取决于）目前没有内容字段承载——本计划不扩 schema，`scoreJudgment` 以 `conclusionCorrect: boolean` 为输入；计划 4 落地 UI 前要么在 `KeyPoint`/卡级补结论字段，要么以内容约定表示，届时再议。② comparison 的"干扰项优先抽'把两边说反'的变体"（§4.3 分型表）在选项层没有入口——反转对无法用现有字段表达，属内容模型缺口；第一版按"与枚举同构"实现（成对呈现是内容撰写期约定），若日后要机器化"优先抽反转变体"，需扩 `KeyPoint` 表达反转关系后再给 `drawDistractors` 加偏好。
- **`review_log.distractorIds` 复现**：seed 三元组 `(userId, cardId, reviewIndex)` 已定死，`reviewIndex` 由 server 的 `card_state.reviewCount` 提供；算法迭代时同 `algoVersion` 语义照搬计划 2 的约定。

---

## 执行期裁决与修订记录（2026-09-21 终审修复波）

分支全量终审裁定 7 项必修（实修 8 处 + 本记录），一次修完、每项带覆盖测试、全量回归后分主题提交。逐条记录如下：

1. **draw.ts 缺口双向回填**：终审发现缺口滚动单向——跨块不足时直接进 neighbor，同块有剩余也会错误降级甚至抛错。裁决：进 neighbor 前先 `takeFrom(pools.sameBlock, shortfall)` 回捞同块剩余（takeFrom 按 taken 去重天然只用剩余）；注释说明"块 ⊂ 大类，同块剩余属于同大类补足"（spec §4.3"优先从同大类补足"）。落点：`src/lib/options/draw.ts`；测试：draw-layer.test.ts"缺口双向回填""双向回填也去重"。
2. **score.ts scoreJudgment 输入校验**：终审发现 pointsScore 不校验，非法分数会产出越界结果。裁决：入口校验 den>0、0≤num≤den、均为整数，非法抛错且消息带实际值（结论错也先过校验）。落点：`src/lib/mastery/score.ts`；测试：score.test.ts"非法 pointsScore 抛错"。
3. **entitlement.ts 冻结防突变**：终审发现返回可突变数组，push 会静默改写付费边界。裁决：`makeFreeEntitlement`/`makePaidEntitlement` 返回 `Object.freeze` 对象，`freeBlockIds` 用 `Object.freeze(unique)`。落点：`src/lib/entitlement/entitlement.ts`；测试：entitlement.test.ts"冻结防突变"。
4. **prepare.ts 活要点校验**：终审发现退役要点过滤可能清空正确项（atomic 单要点退役即空集）。裁决：过滤后按 cardType 校验——各型 ≥1 条活要点、sequence 活要点全部有 order，不满足抛错（消息带 cardId 与 cardType）。落点：`src/lib/options/prepare.ts`（`assertLiveKeyPoints`）；测试：prepare.test.ts"活要点校验"两则。
5. **prepare.ts sequence 呈现序非答案化（最重要）**：终审发现 optionTexts 按 order 升序排成 canonical 序，用户不动手就满分。裁决：呈现序 = `shuffle(canonical, seedRng(hashSeed(userId, card.id, -1)))`——reviewIndex=-1 为保留哨兵，跨 K 份变体、跨天恒定；恒等置换时循环左移 1 位兜底（永不是答案本身）；`correctIndices` 升级为"按 canonical 顺序读出的呈现下标序列"，`distractorKeyPointIds` 仍为 `[]`；一切经注入 rng（哨兵 seed），不新增随机源。旧断言 `optionTexts === ['T-k0'..'T-k3']`、`correctIndices === [0,1,2,3]` 删除（锁的是错误行为）。落点：`src/lib/options/prepare.ts`（buildVariant sequence 分支）；测试：prepare.test.ts"呈现序非答案化""呈现序恒定""呈现序参与 seed"三则。
6. **prepare.ts degradedTo 上浮**：终审 Ruling——降级标记应收敛为聚合字段，server 不必翻 K 份变体。裁决：`PreparedOptions` 增加顶层 `degradedTo: 'none' | 'neighbor'`（任一变体走 neighbor 即 'neighbor'），variants 内部结构不动；sequence 无抽取恒 'none'。落点：`src/lib/options/prepare.ts`；测试：prepare.test.ts"degradedTo 上浮"。
7. **acceptance.test.ts neighbor 池过 public**：终审发现 starved 夹具的 neighbor 池装了非 public 要点，与 server 装配约定不符。裁决：夹具 8 条 neighbor 全部改 `kp(\`nb${i}\`, { public: true })` 并加注释"免费用户 neighbor 层同样只该装 public"。落点：`tests/lib/options/acceptance.test.ts`。
8. **rng.ts fnv1a 注释澄清**：终审提醒 fnv1a 按 UTF-16 码元哈希是 JS 稳定变体，非 JS 端复算 seed 时易踩坑。裁决：仅补注释——与按字节的规范 FNV-1a 在非 ASCII 输入上不同，非 JS 端需按此语义复算。落点：`src/lib/options/rng.ts`。

修复后全量回归：`pnpm test` 238 条全绿（229 基线 + 9 条新增），`pnpm typecheck` 无输出。
