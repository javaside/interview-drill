# 排期引擎实现计划（计划 2/5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `src/lib/scheduler` —— 为面试当天记忆强度最大化的排期引擎：计划生成（plan-once）、容量装箱、前缀和超载检测、重生成与维持模式，全部纯函数、零依赖、可完整单测。

**Architecture:** 四个模块自底向上：`plan.ts` 管 §5.2 的阶梯数学（窗口、起始档、铺阶梯、错峰、末端窗口）；`capacity.ts` 管 §5.3 装箱与 §5.4 前缀和判据；`regenerate.ts` 管 §5.5 重生成/终止/§5.7 维持模式/§5.8 临时加密；`schedule.ts` 是主入口与收窄建议。日期一律 `YYYY-MM-DD` 字符串，日差按日历天；`s` 一律精确有理数（整数分子/分母），比较用交叉相乘。

**Tech Stack:** TypeScript 5 · Node 20 · vitest。**不新增任何依赖。**

**Spec:** `docs/superpowers/specs/2026-09-15-interview-drill-design.md` §5 全部、§4.4 的 `s` 定义、§11 验收表。敌意评审 `docs/superpowers/reviews/round1-scheduler-correctness.md`（其结论已吸收进 spec §5，本计划不再重复）。

**上游依赖:** 无。不 import `lib/content`——排期只需要 `id` 与 `frequency`，自带最小输入类型，保持零依赖。

---

## 全局约束（每个任务隐含遵守）

- **纯函数**：无 IO、无副作用、不读系统时钟（§5.1）。`today` 是参数，不是 `new Date()`。
- **日期类型钉死**：`LocalDate = string`（`YYYY-MM-DD`），日差按**日历天**（UTC 午夜构造再相减），**禁止**毫秒差除以 86400000 的跨 DST 写法（§5.1）。
- **`s` 是精确有理数**：`{ num, den }` 整数对，比较一律交叉相乘（`a.num * b.den` vs `b.num * a.den`），**禁止**浮点阈值——`2/3 = 0.6667 < 0.67` 是 spec 记录在案的真实事故（§5.2 ②）。
- **排序必须确定**：所有排序键末尾追加 `cardId`（§5.1、评审 S7）。
- **plan-once**：计划一次生成并持久化，之后只消费；只有 §5.5 的四种条件（答错 / `readyByDate` 变 / `dailyCapacity` 变 / 选中块集变）触发重生成，且作用域是"变更的卡"，不是全量（§5.2、§5.5）。
- **往后推，不往前推**；唯一允许突破 `dailyCapacity` 的是 `E = 0`，且必须告警（§5.3、§5.4）。
- **默认 `dailyCapacity = 45`**（§5.4）。
- 答错重排**从明天起**，绝不当天（§5.5，评审 F5 的同日死循环）。
- 计划的表示：**相对 `today` 的整数天偏移**，严格递增；负数 = 逾期未刷。调用方（计划 4 的 server 层）负责与绝对日期互转，转换只准用 `date.ts` 的工具。
- tsconfig 已开 `strict` + `noUncheckedIndexedAccess`；import 一律带 `.js` 后缀；测试放 `tests/lib/scheduler/`。

## 算法规格速览（实现时照抄，不要发明）

```
窗口      R = readyByDate - today（日历天）；R < 0 → 维持模式 + 提示更新日期
buffer    1 (R<30) | 2 (30≤R<50) | 3 (R≥50)      // 查表，不是公式
E         = R - buffer（末次复习目标日偏移）；E ≤ 0 时钳为 0
阶梯      INTERVALS = [1,2,4,8,16,32,64]
起始档    phase=new 或 3s<1 → 0 | 3s<2 → 1 | s<1 → 2 | s=1 → 3   // 分数比较
铺阶梯    a=[offset]; while a.last<E' && idx<len: a.push(a.last+INTERVALS[idx]); idx++
          plan = [x∈a | x<E'] ∪ [E']
新卡错峰  newPerDay = max(1, floor(C×0.35))；按 (frequency↓, cardId↑) 排位第 j 张
          offset = min(floor(j/newPerDay), E)
末端窗口  fw 从 ceil(n/C) 起；末次分配到 [E-fw+1, E]，高频最靠近 E；
          分配按 (frequency↓, cardId↑) 贪心从 E 往前填，每天 ≤ C 个末次
装箱      末次不可移动优先占位；中间次当天满 → +1 天，最多推到末次前一天；
          推到无处可去 → 丢弃，计入 overloadWarning.dropped
前缀和    for t∈0..E: Σload(0..t) > (t+1)×C → 告警，报最早违反的 t
收窄      按 (frequency↓, cardId↑) 找最大可行前缀 k（生成后无 drop 且前缀和通过），
          收窄结果必须重跑判据验证
维持模式  间隔表 [1,3,7,15,30,60,120]，到表尾停 120；得分比例 ≥1/2 → k+1，<1/2 → k=0
```

**五条不变量（§5.1，每组一组单测）**：I1 末次落在 `[E-fw+1, E]`，高频优先占 `E`；I2 计划内日期严格递增、同卡不同天；I3 `R ≥ 0` 且有计划内卡时 `todayQueue` 非空；I4 计划不重算（除 §5.5 四条件）；I5 任一天负载 ≤ 容量，唯一例外 `E=0` 且必告警。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/scheduler/types.ts` | 领域类型 + 有理数运算（`rat`/`cmpRat`/`weightedS`）+ 确定性排序 |
| `src/lib/scheduler/date.ts` | `LocalDate` 工具：`diffDays`/`addDays`（UTC 午夜，免 DST）|
| `src/lib/scheduler/plan.ts` | §5.2：`INTERVALS`、`bufferOf`、`startTier`、`layLadder`、错峰、末端窗口 |
| `src/lib/scheduler/capacity.ts` | §5.3 装箱 `binIntermediates`；§5.4 `prefixCheck` |
| `src/lib/scheduler/regenerate.ts` | §5.5 答错重排/终止；§5.7 `maintenanceStep`；§5.8 `cramForInterview` |
| `src/lib/scheduler/schedule.ts` | 主入口 `schedule` + `reservedLoadOf` + `narrowSuggestion` |
| `tests/lib/scheduler/*.test.ts` | 每模块一组 + Task 9 的 §11 边界套件 |

---

### Task 1: 日期工具与领域类型

**Files:**
- Create: `src/lib/scheduler/date.ts`
- Create: `src/lib/scheduler/types.ts`
- Test: `tests/lib/scheduler/date.test.ts`
- Test: `tests/lib/scheduler/types.test.ts`

**Interfaces:**
- Produces: `LocalDate`（string 别名）、`diffDays(a, b): number`（a−b 的日历天数）、`addDays(d, n): LocalDate`；`Frequency`、`Rational`、`rat(num, den): Rational`（约分到最简）、`cmpRat(a, b): number`、`weightedS(scores: Rational[]): Rational`（最近 3 次 3:2:1 加权，`scores[0]` 最新）、`Phase`、`SchedulableCard = { id, frequency }`、`CardState`、`sortForScheduling(cards): SchedulableCard[]`。后续所有任务 import 这些名字。

- [ ] **Step 0: 提交本计划文档**

```bash
git add docs/superpowers/plans/2026-09-21-scheduler.md
git commit -m "docs: 计划 2（排期引擎）实施计划"
```

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/date.test.ts`**

```ts
import { diffDays, addDays } from '../../../src/lib/scheduler/date.js'

test('同日差为 0', () => {
  expect(diffDays('2026-09-21', '2026-09-21')).toBe(0)
})

test('日差按日历天，跨月正确', () => {
  expect(diffDays('2026-10-01', '2026-09-21')).toBe(10)
  expect(diffDays('2026-09-21', '2026-10-01')).toBe(-10)
})

test('闰年二月：2024-02-28 → 2024-03-01 是 2 天', () => {
  expect(diffDays('2024-03-01', '2024-02-28')).toBe(2)
})

test('addDays 跨月与回退', () => {
  expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  expect(addDays('2026-09-21', -5)).toBe('2026-09-16')
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
})

test('日期字符串全程走 UTC 午夜——DST 切换日也是整数天', () => {
  // 美 DST 2026-03-08 切换。禁令（§5.1）针对的是「本地时区构造再取毫秒差」——
  // 那才会在 23/25 小时日得到 0.96/1.04。本实现两端都走 Date.UTC 午夜，
  // 毫秒差恒为 86400000 的整数倍，Math.round 是精确的。这条测试锁住
  // 「全程 UTC 构造」，跨 DST 日的 diff 仍是精确整数天。
  expect(diffDays('2026-03-10', '2026-03-08')).toBe(2)
})

test('非法格式被拒', () => {
  expect(() => diffDays('2026-9-1', '2026-09-01')).toThrow()
  expect(() => addDays('2026/09/21', 1)).toThrow()
})

test('不存在的日历日被拒（2026-02-30）', () => {
  expect(() => addDays('2026-02-30', 1)).toThrow()
})
```

- [ ] **Step 2: 写失败测试 `tests/lib/scheduler/types.test.ts`**

```ts
import {
  rat, cmpRat, weightedS, sortForScheduling, FREQ_ORDER,
} from '../../../src/lib/scheduler/types.js'
import type { SchedulableCard } from '../../../src/lib/scheduler/types.js'

test('有理数约分到最简', () => {
  expect(rat(6, 9)).toEqual({ num: 2, den: 3 })
  expect(rat(0, 5)).toEqual({ num: 0, den: 1 })
})

test('分母为 0 或负数直接抛错', () => {
  expect(() => rat(1, 0)).toThrow()
  expect(() => rat(1, -3)).toThrow()
})

test('交叉相乘比较：没有浮点陷阱', () => {
  expect(cmpRat(rat(1, 2), rat(2, 3))).toBeLessThan(0)
  expect(cmpRat(rat(2, 3), rat(2, 3))).toBe(0)
  expect(cmpRat(rat(1, 1), rat(5, 6))).toBeGreaterThan(0)
})

test('weightedS：空历史为 0', () => {
  expect(weightedS([])).toEqual({ num: 0, den: 1 })
})

test('weightedS：单次即自身', () => {
  expect(weightedS([rat(2, 3)])).toEqual({ num: 2, den: 3 })
})

test('weightedS：三次满分 = 1', () => {
  expect(weightedS([rat(1, 1), rat(1, 1), rat(1, 1)])).toEqual({ num: 1, den: 1 })
})

test('weightedS：3:2:1 加权且顺序敏感（最新一次权重最大）', () => {
  // [新→旧] = [满分, 0, 0] → (3·1)/(3+2+1) = 1/2
  expect(weightedS([rat(1, 1), rat(0, 1), rat(0, 1)])).toEqual(rat(1, 2))
  // [新→旧] = [0, 满分, 0] → 2/6 = 1/3 —— 同样一次满分，位置不同结果不同
  expect(weightedS([rat(0, 1), rat(1, 1), rat(0, 1)])).toEqual(rat(1, 3))
})

test('weightedS：不足 3 次按已有次数归一', () => {
  // 两次各 1/2 → (3·1/2 + 2·1/2)/(3+2) = (3/2+1)/5 = 5/2 / 5 = 1/2
  expect(weightedS([rat(1, 2), rat(1, 2)])).toEqual(rat(1, 2))
})

test('排序：frequency 降序，同频 cardId 升序', () => {
  const cards: SchedulableCard[] = [
    { id: 'b', frequency: 'mid' },
    { id: 'a', frequency: 'low' },
    { id: 'd', frequency: 'high' },
    { id: 'c', frequency: 'high' },
  ]
  expect(sortForScheduling(cards).map(c => c.id)).toEqual(['c', 'd', 'b', 'a'])
})

test('排序不修改输入数组', () => {
  const cards: SchedulableCard[] = [
    { id: 'x2', frequency: 'low' },
    { id: 'x1', frequency: 'high' },
  ]
  sortForScheduling(cards)
  expect(cards.map(c => c.id)).toEqual(['x2', 'x1'])
})

test('FREQ_ORDER 权重：high=3 mid=2 low=1', () => {
  expect(FREQ_ORDER).toEqual({ high: 3, mid: 2, low: 1 })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/date.test.ts tests/lib/scheduler/types.test.ts`
Expected: FAIL —— 无法解析 `date.js` / `types.js`

- [ ] **Step 4: 实现 `src/lib/scheduler/date.ts`**

```ts
/**
 * 本地日历日，YYYY-MM-DD。§5.1：日差按日历天计算。
 *
 * 为什么全程走 UTC 午夜：字符串拆分 + Date.UTC 构造根本不经过任何本地时区，
 * DST 切换那天（23 或 25 小时）也是精确的整数天。早期设计的
 * `ms / 86400000` 在 DST 日会得到 0.96 / 1.04，取整少一天——spec 明令禁止。
 */
export type LocalDate = string

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toUtc(d: string): Date {
  if (!DATE_RE.test(d)) throw new Error(`非法日期格式：${d}（应为 YYYY-MM-DD）`)
  const [ys, ms, ds] = d.split('-')
  const y = Number(ys), m = Number(ms), day = Number(ds)
  const t = new Date(Date.UTC(y, m - 1, day))
  // 回读校验：2026-02-30 会被 Date.UTC 滚动成 3 月 2 日，必须当非法输入拒掉
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== day) {
    throw new Error(`不存在的日历日：${d}`)
  }
  return t
}

function fromUtc(ms: number): LocalDate {
  const t = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/** a − b 的日历天数。a 晚于 b 为正。 */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000)
}

/** d 加 n 天（可为负）。 */
export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d).getTime() + n * 86_400_000)
}
```

- [ ] **Step 5: 实现 `src/lib/scheduler/types.ts`**

```ts
/** 排期需要的卡的最小形状。故意不 import lib/content —— scheduler 零依赖（§7） */
export type Frequency = 'high' | 'mid' | 'low'

export const FREQ_ORDER: Record<Frequency, number> = { high: 3, mid: 2, low: 1 }

export type SchedulableCard = { id: string; frequency: Frequency }

/**
 * 精确有理数。§5.2 ②：s 必须以整数分子/分母存储，比较用交叉相乘。
 * s 是 3:2:1 加权平均，分母 3-6，通分后分母不超过 6³×6，整数运算绰绰有余。
 */
export type Rational = { num: number; den: number }

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function rat(num: number, den: number): Rational {
  if (den <= 0) throw new Error(`分母必须为正：${num}/${den}`)
  const g = gcd(Math.abs(num), den) || 1
  return { num: num / g, den: den / g }
}

/** 交叉相乘比较。负 = a<b，0 = 相等，正 = a>b。 */
export function cmpRat(a: Rational, b: Rational): number {
  return a.num * b.den - b.num * a.den
}

/**
 * 最近 3 次得分的 3:2:1 加权平均（§4.4）。scores[0] 最新；不足 3 次按已有
 * 次数归一。取加权平均而非"最近一次"：单次观测方差太大（§4.4）。
 */
export function weightedS(scores: Rational[]): Rational {
  const take = scores.slice(0, 3)
  if (take.length === 0) return rat(0, 1)
  const weights = [3, 2, 1]
  let den = 1
  for (const s of take) den *= s.den
  let acc = 0
  for (let i = 0; i < take.length; i++) {
    acc += weights[i]! * take[i]!.num * (den / take[i]!.den)
  }
  const wSum = weights.slice(0, take.length).reduce((a, b) => a + b, 0)
  return rat(acc, den * wSum)
}

/** §4.4：new 是独立状态，不是 s=0 —— 从没见过的卡和见过但说不出的卡干预不同 */
export type Phase = 'new' | 'learning' | 'done' | 'paused'

export type CardState = {
  cardId: string
  phase: Phase
  /** phase='new' 时无意义，约定 0/1 */
  s: Rational
  /**
   * 已生成的计划：相对 today 的天偏移，严格递增（I2）。负数 = 逾期未刷（§5.5）。
   * 调用方在 DB 里存绝对日期 + planGeneratedAt，调 scheduler 前用 diffDays 转偏移。
   */
  plan: number[]
  /** 维持模式档位（§5.7），冲刺模式不参与。新卡 k=0 */
  phaseIndex: number
  reviewCount: number
}

export function compareCardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 全库唯一允许的卡片排序：(frequency 降序, cardId 升序)。
 * §5.1：排序键末尾必须追加 cardId，否则同键顺序取决于数据库返回顺序，
 * "输入确定则输出确定"就是假的。
 */
export function sortForScheduling(cards: SchedulableCard[]): SchedulableCard[] {
  return [...cards].sort(
    (a, b) => FREQ_ORDER[b.frequency] - FREQ_ORDER[a.frequency] || compareCardId(a.id, b.id),
  )
}
```

- [ ] **Step 6: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/date.test.ts tests/lib/scheduler/types.test.ts`
Expected: 18 passed

- [ ] **Step 7: Commit**

```bash
git add src/lib/scheduler/date.ts src/lib/scheduler/types.ts tests/lib/scheduler/date.test.ts tests/lib/scheduler/types.test.ts
git commit -m "feat(scheduler): LocalDate 工具与精确有理数类型基座"
```

---

### Task 2: 阶梯数学 —— 窗口、起始档、铺阶梯

**Files:**
- Create: `src/lib/scheduler/plan.ts`
- Test: `tests/lib/scheduler/plan-ladder.test.ts`

**Interfaces:**
- Consumes: `Phase`、`Rational`（Task 1）。
- Produces: `INTERVALS`（readonly `[1,2,4,8,16,32,64]`）、`bufferOf(R): number`、`startTier(phase, s): number`（0-3）、`layLadder(offset, tier, target): number[]`（首项 `offset`，末项 `target`，严格递增）。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/plan-ladder.test.ts`**

```ts
import { INTERVALS, bufferOf, startTier, layLadder } from '../../../src/lib/scheduler/plan.js'
import { rat } from '../../../src/lib/scheduler/types.js'

test('绝对间隔阶梯', () => {
  expect(INTERVALS).toEqual([1, 2, 4, 8, 16, 32, 64])
})

test('buffer 是查表：主场景恒 1，长窗口最多 3', () => {
  expect(bufferOf(0)).toBe(1)
  expect(bufferOf(7)).toBe(1)
  expect(bufferOf(29)).toBe(1)
  expect(bufferOf(30)).toBe(2)
  expect(bufferOf(49)).toBe(2)
  expect(bufferOf(50)).toBe(3)
  expect(bufferOf(120)).toBe(3)
})

test('起始档：new 是独立状态，直接第 0 档', () => {
  expect(startTier('new', rat(1, 1))).toBe(0)
})

test('起始档：分数比较，2/3 必须落在第 2 档（旧浮点 0.67 的回归守卫）', () => {
  expect(startTier('learning', rat(0, 1))).toBe(0)
  expect(startTier('learning', rat(1, 3))).toBe(1)
  expect(startTier('learning', rat(1, 2))).toBe(1)
  expect(startTier('learning', rat(2, 3))).toBe(2)   // 0.6667 < 0.67 曾把它挤去下一档
  expect(startTier('learning', rat(5, 6))).toBe(2)
  expect(startTier('learning', rat(1, 1))).toBe(3)
})

test('spec §5.2 的实测样例逐一对上（offset=0，新卡）', () => {
  expect(layLadder(0, 0, 20)).toEqual([0, 1, 3, 7, 15, 20])
  expect(layLadder(0, 0, 6)).toEqual([0, 1, 3, 6])
  expect(layLadder(0, 0, 4)).toEqual([0, 1, 3, 4])
  expect(layLadder(0, 0, 2)).toEqual([0, 1, 2])
  expect(layLadder(0, 0, 0)).toEqual([0])
})

test('起始档越高，铺出的复习越少', () => {
  // 同样 E=20：tier 1 有 +2/+4/+8 三跳；tier 3 只有一跳 8 天
  //（下一跳 8+16=24 已越窗，被截断——末项由 target 补上）
  expect(layLadder(0, 1, 20)).toEqual([0, 2, 6, 14, 20])
  expect(layLadder(0, 3, 20)).toEqual([0, 8, 20])
})

test('错峰起点：offset 平移整条阶梯', () => {
  expect(layLadder(3, 0, 10)).toEqual([3, 4, 6, 10])
  expect(layLadder(1, 0, 6)).toEqual([1, 2, 4, 6])
})

test('target ≤ offset 时只有一次复习', () => {
  expect(layLadder(5, 0, 5)).toEqual([5])
})

test('结果永远严格递增（I2 的构造性保证）', () => {
  for (let offset = 0; offset <= 8; offset++) {
    for (let tier = 0; tier <= 3; tier++) {
      for (let target = offset; target <= 25; target++) {
        const p = layLadder(offset, tier, target)
        expect(p[0]).toBe(Math.min(offset, target))
        expect(p[p.length - 1]).toBe(target)
        for (let i = 1; i < p.length; i++) {
          expect(p[i]! - p[i - 1]!).toBeGreaterThan(0)
        }
      }
    }
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/plan-ladder.test.ts`
Expected: FAIL —— 无法解析 `plan.js`

- [ ] **Step 3: 实现 `src/lib/scheduler/plan.ts`（本任务只写阶梯部分）**

```ts
import type { Phase, Rational } from './types.js'

/** 绝对间隔阶梯（§5.2 ②）。复习次数是输出不是输入——由窗口长度决定刷几遍 */
export const INTERVALS = [1, 2, 4, 8, 16, 32, 64] as const

/**
 * buffer 查表（§5.2 ①）。早期写成 clamp(round(R×0.05),1,3)，实测在 R≤29 恒 1、
 * R≥50 恒 3，只在 [30,49] 起作用——主场景（1-3 周备考）全落在常数区。
 * 查表更诚实，也免掉 round 半值方向的歧义。
 */
export function bufferOf(R: number): number {
  if (R < 30) return 1
  if (R < 50) return 2
  return 3
}

/**
 * 起始档（§5.2 ②）。全部用整数交叉相乘，禁止浮点：
 * s=2/3 时 3·2 = 2·3，既不 <1 也不 <2，落进"大部分对了"的第 2 档——
 * 旧写法 s≥0.67 因 0.6667<0.67 把三要点卡用户平白多排一遍。
 */
export function startTier(phase: Phase, s: Rational): number {
  if (phase === 'new') return 0
  if (3 * s.num < 1 * s.den) return 0
  if (3 * s.num < 2 * s.den) return 1
  if (s.num < s.den) return 2
  return 3
}

/**
 * 铺阶梯，末端截断到 target（该卡的末次目标日 E'，§5.2 ③）。
 *
 * a = [offset]; idx = 起始档
 * while a.last < target and idx < len(INTERVALS): a.push(a.last + INTERVALS[idx]); idx += 1
 * plan = [x for x in a if x < target] + [target]
 *
 * 末项永远是 target（I1 的构造性来源）；过滤保证中间次永不与末次同天（I2）。
 * target ≤ offset（末端窗口把末次分到了首次曝光之前）时整条计划只剩末次一次。
 */
export function layLadder(offset: number, tier: number, target: number): number[] {
  if (target <= offset) return [target]
  const a: number[] = [offset]
  let idx = tier
  while (a[a.length - 1]! < target && idx < INTERVALS.length) {
    a.push(a[a.length - 1]! + INTERVALS[idx]!)
    idx++
  }
  return [...a.filter(x => x < target), target]
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/plan-ladder.test.ts`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/plan.ts tests/lib/scheduler/plan-ladder.test.ts
git commit -m "feat(scheduler): 窗口查表、分数比较起始档、绝对间隔阶梯"
```

---

### Task 3: 首次曝光错峰 + 末端窗口

**Files:**
- Modify: `src/lib/scheduler/plan.ts`（追加导出）
- Test: `tests/lib/scheduler/plan-stagger.test.ts`

**Interfaces:**
- Consumes: `SchedulableCard`、`sortForScheduling`（Task 1）。
- Produces: `newPerDayOf(capacity): number`、`firstExposureOffset(rank, capacity, E): number`、`assignFinalDays(cards, capacity, E): ReadonlyMap<string, number>`（cardId → 末次目标日）。

**为什么必须有这两个函数（评审 F1/F2 的直接修法）**：`d` 若只由 `(E, n)` 决定，同一批新卡拿到逐字节相同的计划，150 张全堆在 4 个尖峰日；而所有卡的末次都落在 `E` 那天必然爆。错峰把首次曝光摊开，末端窗口把末次摊到 `[E-fw+1, E]`。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/plan-stagger.test.ts`**

```ts
import { newPerDayOf, firstExposureOffset, assignFinalDays } from '../../../src/lib/scheduler/plan.js'
import type { SchedulableCard } from '../../../src/lib/scheduler/types.js'

function cards(ids: string[], freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return ids.map(id => ({ id, frequency: freq }))
}

test('新卡配额 = max(1, floor(容量×0.35))', () => {
  expect(newPerDayOf(45)).toBe(15)
  expect(newPerDayOf(100)).toBe(35)
  expect(newPerDayOf(2)).toBe(1)    // 极小容量也至少 1，保证 I3
})

test('首次曝光按排位错峰：容量 45 → 每 15 张一天', () => {
  expect(firstExposureOffset(0, 45, 20)).toBe(0)
  expect(firstExposureOffset(14, 45, 20)).toBe(0)
  expect(firstExposureOffset(15, 45, 20)).toBe(1)
  expect(firstExposureOffset(45, 45, 20)).toBe(3)
})

test('offset 永不超过 E —— 短窗口时不把首次曝光排到窗口外', () => {
  expect(firstExposureOffset(1000, 45, 5)).toBe(5)
})

test('末次窗口：高频最靠近 E，从 E 往前按容量贪心填', () => {
  const cs = [
    ...cards(['h1', 'h2'], 'high'),
    ...cards(['m1', 'm2'], 'mid'),
    ...cards(['l1'], 'low'),
  ]
  const finals = assignFinalDays(cs, 2, 6)
  expect(finals.get('h1')).toBe(6)
  expect(finals.get('h2')).toBe(6)
  expect(finals.get('m1')).toBe(5)
  expect(finals.get('m2')).toBe(5)
  expect(finals.get('l1')).toBe(4)
})

test('同频内按 cardId 升序占位 —— 输出确定', () => {
  const cs = cards(['b', 'a', 'c'], 'high')
  const finals = assignFinalDays(cs, 1, 6)
  expect(finals.get('a')).toBe(6)
  expect(finals.get('b')).toBe(5)
  expect(finals.get('c')).toBe(4)
})

test('100 张 / 容量 45：末次摊到 4 天，每天 ≤ 45', () => {
  const cs = cards(Array.from({ length: 100 }, (_, i) => `c${String(i).padStart(3, '0')}`))
  const finals = assignFinalDays(cs, 45, 20)
  const perDay = new Map<number, number>()
  for (const day of finals.values()) perDay.set(day, (perDay.get(day) ?? 0) + 1)
  expect(perDay.get(20)).toBe(45)
  expect(perDay.get(19)).toBe(45)
  expect(perDay.get(18)).toBe(10)
  expect(Math.max(...perDay.values())).toBeLessThanOrEqual(45)
})

test('E = 0：全部末次落在今天（唯一容量豁免路径的构造）', () => {
  const finals = assignFinalDays(cards(['a', 'b', 'c'], 'high'), 1, 0)
  expect([...finals.values()]).toEqual([0, 0, 0])
})

test('fw 起始 = ceil(n/C)：n 张卡恰好摊满窗口', () => {
  // 91 张 / 容量 45 → fw=3 → 最早末次日在 E-2
  const cs = cards(Array.from({ length: 91 }, (_, i) => `c${i}`))
  const finals = assignFinalDays(cs, 45, 20)
  expect(Math.min(...finals.values())).toBe(18)   // 20-3+1
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/plan-stagger.test.ts`
Expected: FAIL —— `newPerDayOf` 未导出

- [ ] **Step 3: 在 `src/lib/scheduler/plan.ts` 末尾追加**

```ts
/**
 * 新卡配额（§5.2 ④）。不加配额的话，150 张新卡各自还带一次"+1 天"复习，
 * day0 必然拥塞。剩余容量留给复习。
 */
export function newPerDayOf(capacity: number): number {
  return Math.max(1, Math.floor(capacity * 0.35))
}

/**
 * 第 rank 张新卡（0 起，已按 (frequency 降序, cardId 升序) 排位）的首次曝光日。
 * min(…, E)：短窗口时不把首次曝光排到窗口之外。
 */
export function firstExposureOffset(rank: number, capacity: number, E: number): number {
  return Math.min(Math.floor(rank / newPerDayOf(capacity)), E)
}

/**
 * 末次目标日分配（§5.2 ④ 末端窗口）。所有卡的末次都想落在 E，那天必然爆——
 * 分散到 [E-fw+1, E]，fw 从 ceil(n/C) 起；按 (frequency 降序, cardId 升序)
 * 从 E 往前贪心填，每天最多 capacity 个末次。高频卡天然拿到最靠近 E 的日子。
 *
 * 这是对早期"末次严格落在 E"的明确降级（spec §5.2 ④）：单日末端对齐与容量
 * 约束在满载时互斥，互斥的保证必须明着选一个。
 */
export function assignFinalDays(
  cards: SchedulableCard[],
  capacity: number,
  E: number,
): ReadonlyMap<string, number> {
  const ordered = sortForScheduling(cards)
  const finals = new Map<string, number>()
  if (E <= 0) {
    // E=0 是唯一容量豁免路径（§5.4）：全部排今天并告警，由调用方负责告警
    for (const c of ordered) finals.set(c.id, 0)
    return finals
  }
  let day = E
  let slots = capacity
  for (const c of ordered) {
    while (slots === 0) {
      day -= 1
      slots = capacity
    }
    if (day < 0) {
      // 超载是常态而非异常（§5.6）：窗口装不下所有末次时堆到 day 0，
      // 由前缀和判据捕获并触发收窄建议——绝不在引擎里抛异常打断排期。
      finals.set(c.id, 0)
      continue
    }
    finals.set(c.id, day)
    slots--
  }
  return finals
}
```

（同时把 `import type { Phase, Rational } from './types.js'` 改为 `import type { Phase, Rational, SchedulableCard } from './types.js'`，并补 `import { sortForScheduling } from './types.js'`。）

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/plan-stagger.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/plan.ts tests/lib/scheduler/plan-stagger.test.ts
git commit -m "feat(scheduler): 新卡错峰配额与末端窗口分配"
```

---

### Task 4: 容量装箱与前缀和判据

**Files:**
- Create: `src/lib/scheduler/capacity.ts`
- Test: `tests/lib/scheduler/capacity.test.ts`

**Interfaces:**
- Produces: `DayLoad = Map<number, number>`（天偏移 → 已占容量）、`DroppedReview = { cardId, reviewIndex, plannedDay }`、`binIntermediates(intermediates, finalDay, cardId, load, capacity): { plan: number[]; dropped: DroppedReview[] }`（**约定**：调用方先把所有末次占位写进 `load`，本函数只排中间次，返回的 `plan` 末尾追加 `finalDay`）、`prefixCheck(load, capacity, E): number | undefined`（最早违反前缀和的天，无违反为 `undefined`）。

**规则（§5.3，逐字实现）**：中间次遇到当天已满 → **往后推一天**，最多推到末次的前一天；若该卡已占用目标日则继续后推（保 I2）；推到无处可去 → 丢弃该次复习。**往后推而非往前推**：往前推会挤爆今天，且提前复习等于缩短间隔，对间隔重复没有价值。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/capacity.test.ts`**

```ts
import { binIntermediates, prefixCheck } from '../../../src/lib/scheduler/capacity.js'
import type { DayLoad } from '../../../src/lib/scheduler/capacity.js'

function load(entries: Array<[number, number]>): DayLoad {
  return new Map(entries)
}

test('空负载时中间次直接落位，末尾追加末次日', () => {
  const l = load([])
  const r = binIntermediates([1, 2, 3], 6, 'c1', l, 45)
  expect(r.plan).toEqual([1, 2, 3, 6])
  expect(r.dropped).toEqual([])
  expect(l.get(1)).toBe(1)
  expect(l.get(6)).toBeUndefined()   // 末次占位是调用方的职责，这里不动它
})

test('当天已满则往后推一天', () => {
  const l = load([[2, 1]])
  const r = binIntermediates([1, 2, 3], 6, 'c1', l, 1)
  // target 2 被占 → 推到 3；下一个 target 3 又被自己占 → 推到 4
  expect(r.plan).toEqual([1, 3, 4, 6])
  expect(r.dropped).toEqual([])
})

test('自己已占用的日子也要跳过（I2）', () => {
  const l = load([])
  const r = binIntermediates([3, 3], 9, 'c1', l, 45)
  // 第二个 target 3 已被自己的首个中间次占住（usedDays）→ 推到 4
  expect(r.plan).toEqual([3, 4, 9])
  expect(r.dropped).toEqual([])
})

test('推到末次前一天为止，无处可去则丢弃并记录目标日', () => {
  const l = load([[4, 1], [5, 1]])
  const r = binIntermediates([4], 6, 'c1', l, 1)
  expect(r.plan).toEqual([6])
  expect(r.dropped).toEqual([{ cardId: 'c1', reviewIndex: 0, plannedDay: 4 }])
})

test('目标日就是末次日时直接丢弃（中间次永不与末次同天）', () => {
  const l = load([])
  const r = binIntermediates([6], 6, 'c1', l, 45)
  expect(r.plan).toEqual([6])
  expect(r.dropped[0]!.plannedDay).toBe(6)
})

test('被推到极限的整条链：中间次全部挤在末次前', () => {
  // 容量 1，day 0..2 都被占，末次 4：中间 [0,1] 只能挤 3，另一条丢弃
  const l = load([[0, 1], [1, 1], [2, 1]])
  const r = binIntermediates([0, 1], 4, 'c1', l, 1)
  expect(r.plan).toEqual([3, 4])
  expect(r.dropped).toEqual([{ cardId: 'c1', reviewIndex: 1, plannedDay: 1 }])
})

test('前缀和：铺得开则不告警', () => {
  expect(prefixCheck(load([[0, 45], [1, 45]]), 45, 1)).toBeUndefined()
})

test('前缀和：首日就超 → 报 0', () => {
  expect(prefixCheck(load([[0, 50]]), 45, 5)).toBe(0)
})

test('前缀和：总量可行但前缀卡死 —— 报最早违反的 t', () => {
  // 评审 F3 反例的形状：总量 390 ≤ 29×30，但 day0 就有 90
  const l = load([[0, 90], [28, 300]])
  expect(prefixCheck(l, 30, 28)).toBe(0)
})

test('前缀和：违反发生在中段', () => {
  const l = load([[0, 45], [1, 46]])
  expect(prefixCheck(l, 45, 3)).toBe(1)
})

test('前缀和：恰好等于容量的边界不告警', () => {
  expect(prefixCheck(load([[0, 45], [1, 45], [2, 45]]), 45, 2)).toBeUndefined()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/capacity.test.ts`
Expected: FAIL —— 无法解析 `capacity.js`

- [ ] **Step 3: 实现 `src/lib/scheduler/capacity.ts`**

```ts
/** 天偏移 → 已占用容量。含 reservedLoad 与已放置的末次占位 */
export type DayLoad = Map<number, number>

export type DroppedReview = {
  cardId: string
  /** 被丢弃的是该卡计划的第几个中间次（0 起） */
  reviewIndex: number
  /** 原本想排的那天 */
  plannedDay: number
}

/**
 * 装箱一张卡的中间次（§5.3）。约定：调用方已把末次占位写进 load。
 *
 * 往后推而非往前推：今天没有"前一天"可继续推，往前挤只会把溢出转移到
 * 唯一无法再推的日子；且提前复习等于缩短间隔，对间隔重复没有价值。
 * 少刷一遍，好过把一遍刷在没用的位置上。
 */
export function binIntermediates(
  intermediates: number[],
  finalDay: number,
  cardId: string,
  load: DayLoad,
  capacity: number,
): { plan: number[]; dropped: DroppedReview[] } {
  const placed: number[] = []
  const usedDays = new Set<number>([finalDay])   // I2：同卡不同天，末次日先占住
  const dropped: DroppedReview[] = []

  for (let i = 0; i < intermediates.length; i++) {
    let day = intermediates[i]!
    while (day < finalDay) {
      const full = (load.get(day) ?? 0) >= capacity
      if (!full && !usedDays.has(day)) break
      day++
    }
    if (day >= finalDay) {
      // 推到末次前一天仍无槽位：丢弃，不硬塞（§5.3）
      dropped.push({ cardId, reviewIndex: i, plannedDay: intermediates[i]! })
      continue
    }
    load.set(day, (load.get(day) ?? 0) + 1)
    usedDays.add(day)
    placed.push(day)
  }
  return { plan: [...placed, finalDay], dropped }
}

/**
 * 前缀和超载判据（§5.4）。总量判据只查了可行性里最松的一项，而负载天然
 * 堆在前端，卡死的永远是前缀。返回最早违反的 t（"你前 3 天就已经排不下了"）。
 */
export function prefixCheck(load: DayLoad, capacity: number, E: number): number | undefined {
  let cumulative = 0
  for (let t = 0; t <= E; t++) {
    cumulative += load.get(t) ?? 0
    if (cumulative > (t + 1) * capacity) return t
  }
  return undefined
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/capacity.test.ts`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/capacity.ts tests/lib/scheduler/capacity.test.ts
git commit -m "feat(scheduler): 容量装箱往后推 + 前缀和超载判据"
```

---

### Task 5: 主入口 `schedule`

**Files:**
- Create: `src/lib/scheduler/schedule.ts`
- Test: `tests/lib/scheduler/schedule.test.ts`

**Interfaces:**
- Consumes: Task 1-4 的全部导出。
- Produces: `DEFAULT_CAPACITY = 45`、`QueueItem = { cardId, reason: 'overdue' | 'due' }`、`OverloadWarning = { earliestOverloadDay?: number; dropped: DroppedReview[] }`、`ScheduleResult = { mode: 'sprint' | 'maintenance'; needsDateUpdate: boolean; todayQueue: QueueItem[]; plans: ReadonlyMap<string, number[]>; overloadWarning: OverloadWarning }`、`schedule(cards, cardStates, readyByDate, dailyCapacity, today, reservedLoad?): ScheduleResult`（签名与参数顺序照抄 spec §5.1）。`plans` **只含本次新生成的计划**——已有计划的卡不在其中也不被改动（I4）。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/schedule.test.ts`**

```ts
import { schedule, DEFAULT_CAPACITY } from '../../../src/lib/scheduler/schedule.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'   // R=21 → buffer 1 → E=20

function cards(n: number, freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(3, '0')}`, frequency: freq,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
function states(cs: SchedulableCard[], over?: (id: string) => Partial<CardState>): CardState[] {
  return cs.map(c => newState(c.id, over?.(c.id)))
}

test('默认容量 45（§5.4）', () => {
  expect(DEFAULT_CAPACITY).toBe(45)
})

test('I3：R≥0 且有新卡时 todayQueue 非空，首日量 = 新卡配额', () => {
  const cs = cards(30)
  const r = schedule(cs, states(cs), READY_R21, 45, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.todayQueue).toHaveLength(15)          // newPerDay = floor(45×0.35)
  expect(r.todayQueue.every(q => q.reason === 'due')).toBe(true)
})

test('30 张 / R=21：不告警，无丢弃', () => {
  const cs = cards(30)
  const r = schedule(cs, states(cs), READY_R21, 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r.overloadWarning.dropped).toEqual([])
})

test('R < 0：走维持模式并提示更新日期', () => {
  const cs = cards(3)
  const st = states(cs, () => ({ phase: 'learning', plan: [-2, 4] }))
  const r = schedule(cs, st, '2026-09-20', 45, TODAY)
  expect(r.mode).toBe('maintenance')
  expect(r.needsDateUpdate).toBe(true)
  // 三张卡都逾期 2 天，按 (最早逾期, cardId) 排
  expect(r.todayQueue).toEqual([
    { cardId: 'c000', reason: 'overdue' },
    { cardId: 'c001', reason: 'overdue' },
    { cardId: 'c002', reason: 'overdue' },
  ])
  expect(r.plans.size).toBe(0)
})

test('未设就绪日：维持模式，不提示更新', () => {
  const cs = cards(3)
  const r = schedule(cs, states(cs, () => ({ phase: 'new', plan: [] })), null, 45, TODAY)
  expect(r.mode).toBe('maintenance')
  expect(r.needsDateUpdate).toBe(false)
  // 无计划的新卡首次曝光就是今天（I3 在维持模式同样成立）
  expect(r.todayQueue).toHaveLength(3)
})

test('E=0（就绪日就在明天）：全部排今天，唯一容量豁免且必告警', () => {
  const cs = cards(10)
  const r = schedule(cs, states(cs), '2026-09-22', 3, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.plans.size).toBe(10)
  for (const plan of r.plans.values()) expect(plan).toEqual([0])
  expect(r.todayQueue).toHaveLength(10)
  expect(r.overloadWarning.earliestOverloadDay).toBe(0)
})

test('I4：已有计划的卡不被重算，plans 里没有它们', () => {
  const cs = cards(5)
  const st = states(cs, () => ({ phase: 'learning', s: rat(1, 2), plan: [1, 5] }))
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.plans.size).toBe(0)
  expect(r.todayQueue).toEqual([])   // plan [1,5]：无今天、无逾期
})

test('逾期卡排在队首且剩余计划不变', () => {
  const cs = cards(3)
  const st = [
    newState('c000', { phase: 'learning', plan: [-5, 3] }),
    newState('c001', { phase: 'learning', plan: [-1, 2] }),
    newState('c002', { phase: 'learning', plan: [0, 4] }),
  ]
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['c000', 'c001', 'c002'])
  expect(r.todayQueue.map(q => q.reason)).toEqual(['overdue', 'overdue', 'due'])
  expect(r.plans.size).toBe(0)      // 逾期不触发重排（§5.5）
})

test('paused 卡不进队列也不重排，plan 保留', () => {
  const cs = cards(2)
  const st = [
    newState('c000', { phase: 'paused', plan: [0, 3] }),
    newState('c001', { phase: 'learning', plan: [0, 3] }),
  ]
  const r = schedule(cs, st, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['c001'])
})

test('超载：100 张 / R=3 / 容量 10 → 前缀和告警报出最早违反日', () => {
  const cs = cards(100)
  const r = schedule(cs, states(cs), '2026-09-24', 10, TODAY)   // R=3 → E=2
  expect(r.overloadWarning.earliestOverloadDay).toBe(0)
})

test('输入确定则输出确定', () => {
  const cs = cards(40, 'high').map((c, i) =>
    i % 3 === 0 ? c : { ...c, frequency: i % 3 === 1 ? 'mid' as const : 'low' as const })
  const st = states(cs)
  const a = schedule(cs, st, READY_R21, 45, TODAY)
  const b = schedule(cs, st, READY_R21, 45, TODAY)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  // JSON.stringify 把 Map 序列化成 {}——plans 内容必须单独比，否则确定性测试名不副实
  expect([...a.plans.entries()]).toEqual([...b.plans.entries()])
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/schedule.test.ts`
Expected: FAIL —— 无法解析 `schedule.js`

- [ ] **Step 3: 实现 `src/lib/scheduler/schedule.ts`**

```ts
import { diffDays } from './date.js'
import type { LocalDate } from './date.js'
import { bufferOf, startTier, layLadder, firstExposureOffset, assignFinalDays } from './plan.js'
import { binIntermediates, prefixCheck } from './capacity.js'
import type { DayLoad, DroppedReview } from './capacity.js'
import { rat, sortForScheduling, compareCardId } from './types.js'
import type { CardState, SchedulableCard } from './types.js'

export const DEFAULT_CAPACITY = 45

export type QueueItem = { cardId: string; reason: 'overdue' | 'due' }

export type OverloadWarning = {
  /** 前缀和判据最早违反的天；E=0 豁免路径恒为 0 */
  earliestOverloadDay?: number
  dropped: DroppedReview[]
}

export type ScheduleResult = {
  mode: 'sprint' | 'maintenance'
  /** R<0 时为 true，调用方应提示用户更新就绪日 */
  needsDateUpdate: boolean
  todayQueue: QueueItem[]
  /** 只含本次新生成的计划（plan-once：已有计划的卡不出现、不被改动） */
  plans: ReadonlyMap<string, number[]>
  overloadWarning: OverloadWarning
}

/**
 * 为"无计划的卡"生成计划：错峰 → 末端窗口 → 装箱。
 * reservedLoad 先进 load（§5.1：不在 cards[] 里但已有计划的卡仍占容量）。
 */
function generatePlans(
  fresh: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  capacity: number,
  E: number,
  reservedLoad: ReadonlyMap<number, number>,
): { plans: Map<string, number[]>; load: DayLoad; dropped: DroppedReview[] } {
  const load: DayLoad = new Map(reservedLoad)
  const ordered = sortForScheduling(fresh)
  const finals = assignFinalDays(ordered, capacity, E)
  for (const day of finals.values()) load.set(day, (load.get(day) ?? 0) + 1)

  const plans = new Map<string, number[]>()
  const dropped: DroppedReview[] = []
  let newRank = 0
  for (const c of ordered) {
    const st = states.get(c.id)
    const phase = st?.phase ?? 'new'
    const s = st?.s ?? rat(0, 1)
    // 错峰配额只属于 new 卡（§5.2 ④）；learning 且无计划的卡是调用方
    // 重排路径的兜底，offset 0。已知取舍：维持模式批量转冲刺（§5.7"从空变为
    // 有值"）时这类卡全堆 day0——由 §5.4 告警与收窄兜底，不在引擎里特判。
    const offset = phase === 'new' ? firstExposureOffset(newRank++, capacity, E) : 0
    const target = finals.get(c.id)!
    const ladder = layLadder(offset, startTier(phase, s), target)
    const r = binIntermediates(ladder.slice(0, -1), target, c.id, load, capacity)
    plans.set(c.id, r.plan)
    dropped.push(...r.dropped)
  }
  return { plans, load, dropped }
}

/**
 * 组装今日队列：逾期卡在前（§5.5，最早逾期者最先），当天卡按
 * (frequency 降序, cardId 升序)。计划来源：新生成的 plans 优先，否则用存量。
 */
function buildQueue(
  cards: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  plans: ReadonlyMap<string, number[]>,
): QueueItem[] {
  const overdue: Array<{ key: number; cardId: string }> = []
  const due: SchedulableCard[] = []
  for (const c of cards) {
    const st = states.get(c.id)
    if (st && (st.phase === 'paused' || st.phase === 'done')) continue
    const plan = plans.get(c.id) ?? st?.plan ?? []
    const past = plan.filter(d => d < 0)
    if (past.length > 0) {
      overdue.push({ key: Math.min(...past), cardId: c.id })
    } else if (plan.includes(0)) {
      due.push(c)
    } else if (plan.length === 0 && (!st || st.phase === 'new')) {
      due.push(c)   // 维持模式下的无计划新卡：首次曝光就是今天
    }
  }
  overdue.sort((a, b) => a.key - b.key || compareCardId(a.cardId, b.cardId))
  return [
    ...overdue.map(o => ({ cardId: o.cardId, reason: 'overdue' as const })),
    ...sortForScheduling(due).map(c => ({ cardId: c.id, reason: 'due' as const })),
  ]
}

/**
 * 主入口（§5.1）。纯函数：无 IO、不读时钟，today 由参数传入。
 */
export function schedule(
  cards: SchedulableCard[],
  cardStates: CardState[],
  readyByDate: LocalDate | null,
  dailyCapacity: number,
  today: LocalDate,
  reservedLoad: ReadonlyMap<number, number> = new Map(),
): ScheduleResult {
  const stateMap = new Map(cardStates.map(s => [s.cardId, s] as const))

  // §5.7：readyByDate 为空或已过期 → 日常维持模式。R<0 必须提示更新（§5.2 ①）
  if (readyByDate === null || diffDays(readyByDate, today) < 0) {
    return {
      mode: 'maintenance',
      needsDateUpdate: readyByDate !== null,
      todayQueue: buildQueue(cards, stateMap, new Map()),
      plans: new Map(),
      overloadWarning: { dropped: [] },
    }
  }

  const R = diffDays(readyByDate, today)
  const E = Math.max(0, R - bufferOf(R))

  // plan-once：只为"没有计划的卡"生成；已有计划的一律不动（I4）
  const fresh = cards.filter(c => {
    const st = stateMap.get(c.id)
    if (st && (st.phase === 'paused' || st.phase === 'done')) return false
    return !st || st.phase === 'new' || st.plan.length === 0
  })

  const plans = new Map<string, number[]>()
  let warning: OverloadWarning = { dropped: [] }

  if (fresh.length > 0) {
    const gen = generatePlans(fresh, stateMap, dailyCapacity, E, reservedLoad)
    if (E === 0) {
      // §5.4：E=0 是唯一允许突破容量的情况——所有卡排今天并告警
      warning = { earliestOverloadDay: 0, dropped: [] }
    } else {
      const violation = prefixCheck(gen.load, dailyCapacity, E)
      if (violation !== undefined || gen.dropped.length > 0) {
        warning = { earliestOverloadDay: violation, dropped: gen.dropped }
      }
    }
    for (const [id, plan] of gen.plans) plans.set(id, plan)
  }

  return {
    mode: 'sprint',
    needsDateUpdate: false,
    todayQueue: buildQueue(cards, stateMap, plans),
    plans,
    overloadWarning: warning,
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/schedule.test.ts`
Expected: 11 passed

- [ ] **Step 5: 全量回归 + typecheck**

Run: `pnpm test` 然后 `pnpm typecheck`
Expected: 全部 passed，typecheck 无输出

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduler/schedule.ts tests/lib/scheduler/schedule.test.ts
git commit -m "feat(scheduler): schedule 主入口——plan-once、E=0 豁免、逾期队首"
```

---

### Task 6: 收窄建议与 reservedLoad 汇总

**Files:**
- Modify: `src/lib/scheduler/schedule.ts`
- Test: `tests/lib/scheduler/narrow.test.ts`

**Interfaces:**
- Produces: `narrowSuggestion(cards, states, readyByDate, dailyCapacity, today, reservedLoad): SchedulableCard[]`——按 (frequency 降序, cardId 升序) 的**最大可行前缀**，可行 = 生成后无 drop 且前缀和通过（§5.4：收窄后必须重跑判据，本函数的可行性定义就是重跑）；`reservedLoadOf(cardStates): Map<number, number>`——把存量计划的每日占用汇总成 reservedLoad（§5.1：调用方职责的纯函数实现）。`OverloadWarning` 增加两个可选字段 `narrowTo`、`suggestedCount`。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/narrow.test.ts`**

```ts
import { schedule, reservedLoadOf } from '../../../src/lib/scheduler/schedule.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'

function cards(n: number): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(4, '0')}`, frequency: 'mid' as const,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}

test('reservedLoadOf：存量计划的每日占用被汇总', () => {
  const sts = [
    newState('a', { phase: 'learning', plan: [0, 3] }),
    newState('b', { phase: 'learning', plan: [3, 7] }),
  ]
  expect(reservedLoadOf(sts)).toEqual(new Map([[0, 1], [3, 2], [7, 1]]))
})

test('reservedLoadOf：paused 的计划不占容量，负偏移（逾期）不计入', () => {
  const sts = [
    newState('a', { phase: 'paused', plan: [1, 4] }),
    newState('b', { phase: 'learning', plan: [-3, 5] }),
  ]
  expect(reservedLoadOf(sts)).toEqual(new Map([[5, 1]]))
})

test('1200 张 / 3 周 / 容量 45：前缀和告警 + 收窄建议（§11 边界）', () => {
  const cs = cards(1200)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeDefined()
  const n = r.overloadWarning.narrowTo!.length
  // spec §5.6 的 157 是槽位上界（945÷6）；阶梯结构（day18 末次挤占
  // offset-3 队列的末条中间次）使实际可行前缀低于上界。设计推导确认
  // k=120 干净可行，故下界 100 是安全的。
  expect(n).toBeGreaterThanOrEqual(100)
  expect(n).toBeLessThanOrEqual(170)
  expect(r.overloadWarning.suggestedCount).toBe(n)
})

test('收窄建议执行后重跑：真的可行，不再告警（§11 边界）', () => {
  const cs = cards(1200)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  const narrowed = r.overloadWarning.narrowTo!
  const r2 = schedule([...narrowed], narrowed.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r2.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r2.overloadWarning.dropped).toEqual([])
  expect(r2.overloadWarning.narrowTo).toBeUndefined()
})

test('不超载时没有收窄建议', () => {
  const cs = cards(20)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY)
  expect(r.overloadWarning.narrowTo).toBeUndefined()
})

test('窗口被 reservedLoad 全占满：收窄只能为空，且告警不静默', () => {
  const reserved = new Map(Array.from({ length: 21 }, (_, t) => [t, 45]))
  const cs = cards(5)
  const r = schedule(cs, cs.map(c => newState(c.id)), READY_R21, 45, TODAY, reserved)
  expect(r.overloadWarning.earliestOverloadDay).toBeDefined()
  expect(r.overloadWarning.narrowTo).toEqual([])
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/narrow.test.ts`
Expected: FAIL —— `reservedLoadOf` 未导出

- [ ] **Step 3: 在 `src/lib/scheduler/schedule.ts` 中扩展 `OverloadWarning` 并接线**

3a. 类型改为：

```ts
export type OverloadWarning = {
  /** 前缀和判据最早违反的天；E=0 豁免路径恒为 0 */
  earliestOverloadDay?: number
  dropped: DroppedReview[]
  /** 收窄建议（§5.4/§5.6）：按 (frequency 降序, cardId 升序) 的最大可行前缀 */
  narrowTo?: readonly SchedulableCard[]
  /** §5.6 口径文案的数字："这三周你能刷透约 N 道" */
  suggestedCount?: number
}
```

3b. `schedule()` 里 `else` 分支（前缀和告警处）替换为：

```ts
    } else {
      const violation = prefixCheck(gen.load, dailyCapacity, E)
      if (violation !== undefined || gen.dropped.length > 0) {
        // §5.4：收窄建议必须重跑判据验证——narrowSuggestion 的可行性定义
        // 就是"生成后无 drop 且前缀和通过"，建议即验证
        const narrowTo = narrowSuggestion(
          fresh, stateMap, readyByDate, dailyCapacity, today, reservedLoad,
        )
        warning = {
          earliestOverloadDay: violation,
          dropped: gen.dropped,
          narrowTo,
          suggestedCount: narrowTo.length,
        }
      }
    }
```

- [ ] **Step 4: 在文件末尾追加两个导出**

```ts
/**
 * 把存量计划的每日占用汇总成 reservedLoad（§5.1 的调用方职责，这里给出
 * 纯函数实现）。paused 卡的计划保留但不消费，不再占容量；负偏移是逾期，
 * 属于过去，不占未来容量。
 */
export function reservedLoadOf(cardStates: CardState[]): Map<number, number> {
  const load = new Map<number, number>()
  for (const st of cardStates) {
    if (st.phase === 'paused') continue
    for (const day of st.plan) {
      if (day < 0) continue
      load.set(day, (load.get(day) ?? 0) + 1)
    }
  }
  return load
}

/**
 * 收窄建议（§5.4/§5.6）：这不是异常兜底，是核心交互——它回答产品最有
 * 价值的问题："从 1200 道里，我这三周该刷哪些"。
 *
 * 按 (frequency 降序, cardId 升序) 取最大前缀 k，使前 k 张重新生成后
 * 无 drop 且前缀和通过。负载随 k 单调不减，二分查找。
 *
 * 单调性说明：前 k 张的末次分配与错峰排位在增大 k 后不变（贪心从 E 往前、
 * 排位按前缀），新增卡只添负载，贪心右推只会更挤——这是结构性质而非构造性
 * 证明，「收窄建议执行后重跑」测试是它的直接守卫。
 */
export function narrowSuggestion(
  cards: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  readyByDate: LocalDate,
  dailyCapacity: number,
  today: LocalDate,
  reservedLoad: ReadonlyMap<number, number>,
): SchedulableCard[] {
  const ordered = sortForScheduling(cards)
  const R = diffDays(readyByDate, today)
  const E = Math.max(0, R - bufferOf(R))
  if (E < 1) return []

  const feasible = (k: number): boolean => {
    const gen = generatePlans(ordered.slice(0, k), states, dailyCapacity, E, reservedLoad)
    return gen.dropped.length === 0 && prefixCheck(gen.load, dailyCapacity, E) === undefined
  }

  let lo = 0
  let hi = ordered.length
  let best: SchedulableCard[] = []
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (feasible(mid)) {
      best = ordered.slice(0, mid)
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}
```

- [ ] **Step 5: 运行确认通过（含全量回归）**

Run: `pnpm vitest run tests/lib/scheduler` 然后 `pnpm typecheck`
Expected: 全部 passed，typecheck 无输出

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduler/schedule.ts tests/lib/scheduler/narrow.test.ts
git commit -m "feat(scheduler): 收窄建议——二分最大可行前缀，建议即验证"
```

---

### Task 7: 答错重排、终止状态与维持模式

**Files:**
- Create: `src/lib/scheduler/regenerate.ts`
- Test: `tests/lib/scheduler/regenerate.test.ts`

**Interfaces:**
- Consumes: `layLadder`、`binIntermediates`、`Rational`、`rat`、`DayLoad`、`DroppedReview`。
- Produces: `failed(score: Rational): boolean`（得分比例 `< 1/2`，交叉相乘）、`RegenContext = { E: number; load: DayLoad; capacity: number }`、`regenerateAfterFailure(card, state, ctx): { plan: number[]; dropped: DroppedReview[] }`、`shouldMarkDone(plan): boolean`、`MAINTAIN_INTERVALS = [1,3,7,15,30,60,120]`、`maintenanceStep(k, ratio): { k: number; nextInDays: number }`。

**关键约束**：答错重排**从明天起**（§5.5，评审 F5 的同日死循环——`R≤1` 时当天重排会无限循环，发生在面试前一天）。作用域是**这一张卡**，不是整个选中集合。终止：**计划项全部消费完（`plan` 为空）→ `phase = done`**（§5.5）。注意两条边界都不能提前置 done——含今天（0）的项今天还要刷；只剩逾期项（负数）也不算完，因为 done 的卡退出 `todayQueue`，而 §5.5 要求逾期卡并入队列，提前置 done 会把那次逾期复习永久丢掉（spec 原文「已无 > today 的项」按字面会把 `[0]` 也判成 done，这里取更严的读法）。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/regenerate.test.ts`**

```ts
import {
  failed, regenerateAfterFailure, shouldMarkDone, maintenanceStep, MAINTAIN_INTERVALS,
} from '../../../src/lib/scheduler/regenerate.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const CARD: SchedulableCard = { id: 'c1', frequency: 'high' }
function state(over: Partial<CardState> = {}): CardState {
  return {
    cardId: 'c1', phase: 'learning', s: rat(1, 3), plan: [0, 5, 12],
    phaseIndex: 2, reviewCount: 6, ...over,
  }
}

test('failed：< 1/2 用交叉相乘判定', () => {
  expect(failed(rat(1, 2))).toBe(false)   // 恰好 1/2 不算失败
  expect(failed(rat(2, 5))).toBe(true)
  expect(failed(rat(1, 3))).toBe(true)
  expect(failed(rat(0, 1))).toBe(true)
  expect(failed(rat(5, 6))).toBe(false)
})

test('答错重排从明天起：plan 不含今天，首项是 1（§5.5 / 评审 F5）', () => {
  const load = new Map<number, number>()
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  expect(r.plan[0]).toBe(1)
  expect(r.plan).not.toContain(0)
  expect(r.plan).toEqual([1, 2, 4, 8, 16, 20])   // tier 退回 0
  expect(r.dropped).toEqual([])
})

test('新阶梯装进现有占用图：被占的天往后推（§5.5 只重排这一张）', () => {
  const load = new Map<number, number>([[1, 45]])   // 明天已满
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  expect(r.plan[0]).toBe(2)                          // 推到后天
  expect(r.dropped).toEqual([])
})

test('E=0（就绪日就是明天）：没有"明天"可排，返回空计划——绝不当天回队', () => {
  const r = regenerateAfterFailure(CARD, state(), { E: 0, load: new Map(), capacity: 45 })
  expect(r.plan).toEqual([])
})

test('E=1：重排就是明天（= 末次目标日）一次', () => {
  const r = regenerateAfterFailure(CARD, state(), { E: 1, load: new Map(), capacity: 45 })
  expect(r.plan).toEqual([1])
})

test('重排结果保持 I2 严格递增', () => {
  const load = new Map<number, number>([[2, 45], [3, 45], [4, 45]])
  const r = regenerateAfterFailure(CARD, state(), { E: 20, load, capacity: 45 })
  for (let i = 1; i < r.plan.length; i++) {
    expect(r.plan[i]! - r.plan[i - 1]!).toBeGreaterThan(0)
  }
})

test('shouldMarkDone：还有未消费项就未完成', () => {
  expect(shouldMarkDone([0, 5])).toBe(false)    // 今天还有
  expect(shouldMarkDone([-1, 5])).toBe(false)   // 逾期未刷 + 未来
  expect(shouldMarkDone([5])).toBe(false)
  expect(shouldMarkDone([-3])).toBe(false)      // 只剩逾期：还没刷完——done 会把它挡在 todayQueue 外（§5.5 逾期卡必须并入队列）
  expect(shouldMarkDone([])).toBe(true)         // 全部消费完才是 done
})

test('维持间隔表：到 120 天封顶不再增长（§5.7）', () => {
  expect(MAINTAIN_INTERVALS).toEqual([1, 3, 7, 15, 30, 60, 120])
})

test('maintenanceStep：≥1/2 进档，间隔取新档的值', () => {
  expect(maintenanceStep(0, rat(1, 2))).toEqual({ k: 1, nextInDays: 3 })
  expect(maintenanceStep(3, rat(5, 6))).toEqual({ k: 4, nextInDays: 30 })
})

test('maintenanceStep：<1/2 退回第 0 档，次日再刷', () => {
  expect(maintenanceStep(5, rat(2, 5))).toEqual({ k: 0, nextInDays: 1 })
})

test('maintenanceStep：表尾满分也停在 120 天（§5.7 封顶）', () => {
  expect(maintenanceStep(6, rat(1, 1))).toEqual({ k: 6, nextInDays: 120 })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/regenerate.test.ts`
Expected: FAIL —— 无法解析 `regenerate.js`

- [ ] **Step 3: 实现 `src/lib/scheduler/regenerate.ts`**

```ts
import { layLadder } from './plan.js'
import { binIntermediates } from './capacity.js'
import type { DayLoad, DroppedReview } from './capacity.js'
import type { CardState, Rational, SchedulableCard } from './types.js'

/**
 * 答错判定（§5.5 第 1 条）：得分比例 < 1/2 → 起始档退回 0 重新生成。
 * 分数比较：2·num < den，禁止浮点。
 */
export function failed(score: Rational): boolean {
  return 2 * score.num < score.den
}

export type RegenContext = {
  /** 末次复习目标日（相对 today 的偏移） */
  E: number
  /**
   * 现有占用图：其他卡的计划 + reservedLoad，**不含本卡旧计划**
   * （调用方先把本卡旧计划从占用图里减掉）。函数会原地累加新占位。
   */
  load: DayLoad
  capacity: number
}

/**
 * 答错重排（§5.5）：只重排这一张卡，起始档退回 0，**从明天起**。
 *
 * 为什么不是"当天稍后"：它与"每次提交重跑 schedule()"叠加会构成同日
 * 死循环——R≤1 时全部卡排今天，刷完重跑还是今天，无限循环，且发生在
 * 面试前一天这个产品最重要的日子。
 *
 * E=0 时窗口里没有明天：返回空计划（本周期收口），绝不当天回队。
 */
export function regenerateAfterFailure(
  card: SchedulableCard,
  state: CardState,
  ctx: RegenContext,
): { plan: number[]; dropped: DroppedReview[] } {
  if (ctx.E <= 0) return { plan: [], dropped: [] }
  const ladder = layLadder(1, 0, ctx.E)
  const intermediates = ladder.slice(0, -1)
  const target = ladder[ladder.length - 1]!
  return binIntermediates(intermediates, target, card.id, ctx.load, ctx.capacity)
}

/**
 * 终止状态判定（§5.5）：计划项全部消费完（plan 为空）→ phase = done，退出队列。
 * 两条边界都不能提前置 done：
 * - 含今天（0）的项：今天还要刷（spec 原文「已无 > today 的项」按字面会把 [0]
 *   也判成 done，这是取更严的读法）；
 * - 只含逾期项（负数）：逾期卡必须并入 todayQueue（§5.5），done 会把它挡在
 *   队列外，那次逾期复习就永久丢了。
 */
export function shouldMarkDone(plan: number[]): boolean {
  return plan.length === 0
}

/** 维持模式间隔表（§5.7）。到表尾后停在 120 天不再增长 */
export const MAINTAIN_INTERVALS = [1, 3, 7, 15, 30, 60, 120] as const

/**
 * 维持模式档位进退（§5.7）：得分比例 ≥ 1/2 → 进档；< 1/2 → 退回 0。
 * 返回新档位与下次复习距今天的天数。
 */
export function maintenanceStep(k: number, ratio: Rational): { k: number; nextInDays: number } {
  const passed = 2 * ratio.num >= ratio.den
  const nextK = passed ? Math.min(k + 1, MAINTAIN_INTERVALS.length - 1) : 0
  return { k: nextK, nextInDays: MAINTAIN_INTERVALS[nextK]! }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/lib/scheduler/regenerate.test.ts`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler/regenerate.ts tests/lib/scheduler/regenerate.test.ts
git commit -m "feat(scheduler): 答错重排从明天起 + 终止判定 + 维持模式档位"
```

---

### Task 8: 块级增减与临时加密

**Files:**
- Modify: `src/lib/scheduler/schedule.ts`（把私有 `generatePlans` 改名导出为 `generateFreshPlans`，函数体不变；文件内 2 处调用点——`schedule()` 与 `narrowSuggestion()`——同步改名）
- Modify: `src/lib/scheduler/regenerate.ts`（追加 `pauseCards`、`cramForInterview`）
- Test: `tests/lib/scheduler/blocks-cram.test.ts`

**Interfaces:**
- Produces: `generateFreshPlans(fresh, states, capacity, E, reservedLoad)`（原 `generatePlans`，签名不变，供 cram 复用）、`pauseCards(states, cardIds): CardState[]`（减块：置 `paused`，`plan` 原样保留）、`cramForInterview(selected, states, examDate, today, capacity, reservedLoad): { plans: ReadonlyMap<string, number[]>; excluded: SchedulableCard[] }`（§5.8：`readyByDate = 面试前一天`，按 `(s 升序, frequency 降序, cardId 升序)` 取最大可行前缀重排；**其余块的计划根本不出现在返回里，天然逐字节不变**）。
- **加块不需要新 API**：它就是 `schedule(newCards, newStates, readyBy, C, today, reservedLoadOf(已有计划))`——plan-once 保证老计划不被生成（I4），reservedLoad 保证装箱看得到全局负载。本任务用测试把这个组合方式钉死。

- [ ] **Step 1: 写失败测试 `tests/lib/scheduler/blocks-cram.test.ts`**

```ts
import { schedule, reservedLoadOf, generateFreshPlans } from '../../../src/lib/scheduler/schedule.js'
import { pauseCards, cramForInterview } from '../../../src/lib/scheduler/regenerate.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'
const READY_R21 = '2026-10-12'

function mkCards(prefix: string, n: number, freq: SchedulableCard['frequency'] = 'mid'): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${String(i).padStart(2, '0')}`, frequency: freq }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
function statesOf(cs: SchedulableCard[], over?: (c: SchedulableCard) => Partial<CardState>): CardState[] {
  return cs.map(c => newState(c.id, over?.(c)))
}

test('加块：已有卡的计划不在新 plans 里（逐字节不变由调用方保留），新卡进队列', () => {
  const a = mkCards('a', 2)
  const aStates = statesOf(a, () => ({ phase: 'learning', plan: [0, 3, 7] }))
  const b = mkCards('b', 10)
  const r = schedule(b, statesOf(b), READY_R21, 45, TODAY, reservedLoadOf(aStates))
  expect(r.plans.has('a00')).toBe(false)
  expect(r.todayQueue.some(q => q.cardId.startsWith('b'))).toBe(true)
  // 新卡装箱时看得见 A 块的占用：day0 已有 2 张，新卡配额仍照常错峰
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
})

test('加块撞容量：告警不静默（§5.5）', () => {
  const aStates = Array.from({ length: 21 }, (_, t) =>
    newState(`a${t}`, { phase: 'learning', plan: [t] }))
  const b = mkCards('b', 5)
  const r = schedule(b, statesOf(b), READY_R21, 45, TODAY, reservedLoadOf(aStates))
  // reservedLoad 每天恰好 1 张并非超载——构造真撞车：把容量调到 1
  const r2 = schedule(b, statesOf(b), READY_R21, 1, TODAY, reservedLoadOf(aStates))
  expect(r2.overloadWarning.earliestOverloadDay).toBeDefined()
})

test('减块：置 paused，不进 todayQueue，plan 原样保留（§5.5）', () => {
  const b = mkCards('b', 2)
  const st = [
    newState('b00', { phase: 'learning', plan: [0, 4] }),
    newState('b01', { phase: 'learning', plan: [0, 4] }),
    newState('a00', { phase: 'learning', plan: [0, 4] }),
  ]
  const paused = pauseCards(st, ['b00', 'b01'])
  expect(paused[0]).toMatchObject({ phase: 'paused' })
  expect(paused[0]!.plan).toEqual([0, 4])      // plan 保留
  const all = [...b, { id: 'a00', frequency: 'mid' as const }]
  const r = schedule(all, paused, READY_R21, 45, TODAY)
  expect(r.todayQueue.map(q => q.cardId)).toEqual(['a00'])
})

test('加→减→加 往返：计划与只加一次的结果一致（§11）', () => {
  const b = mkCards('b', 8)
  const r1 = schedule(b, statesOf(b), READY_R21, 45, TODAY)
  const persisted = [...r1.plans].map(([id, plan]) =>
    newState(id, { phase: 'learning', plan }))       // 调用方落盘
  // 减块
  const paused = pauseCards(persisted, b.map(c => c.id))
  // 重新勾选：续上保留的计划（不重排——I4），只是 phase 回到 learning
  const resumed = paused.map(st => ({ ...st, phase: 'learning' as const }))
  const r2 = schedule(b, resumed, READY_R21, 45, TODAY)
  expect(r2.plans.size).toBe(0)                       // 计划保留，未重新生成
  // todayQueue 来自保留下来的同一份计划 → 与只加一次时的语义一致
  expect(r2.todayQueue.map(q => q.cardId))
    .toEqual(r1.todayQueue.map(q => q.cardId))
})

test('临时加密：s 最低的卡被重排，其余不动，每天总负载 ≤ 容量（§5.8 / §11）', () => {
  const sValues = [rat(0, 1), rat(1, 6), rat(1, 3), rat(1, 2), rat(2, 3), rat(5, 6), rat(1, 1), rat(1, 1)]
  const cs = mkCards('c', 8)
  const stateMap = new Map(cs.map((c, i) => [c.id, newState(c.id, {
    phase: 'learning', s: sValues[i]!, plan: [3],
  })]))
  // 面试 2026-09-25 → readyBy 09-24 → R=3 → E=2；容量 2
  const r = cramForInterview(cs, stateMap, '2026-09-25', TODAY, 2, new Map())
  // 推演：k=3 时 c02 的末次落在 day1，c00 的中间次占掉 day1 最后一个槽，
  // c01 的中间次推到 day2=自己的末次 → drop → 不可行。k=2 干净：
  // 两张 [0,1,2]，负载 2/2/2。故可行前缀是 s 最低的两张。
  expect([...r.plans.keys()].sort()).toEqual(['c00', 'c01'])
  expect(r.excluded.map(c => c.id)).toEqual(['c02', 'c03', 'c04', 'c05', 'c06', 'c07'])
  const perDay = new Map<number, number>()
  for (const plan of r.plans.values()) {
    for (const d of plan) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(2)
})

test('临时加密的次日面试（E=0）：没有可排的窗口，全部保持原计划', () => {
  const cs = mkCards('c', 2)
  const stateMap = new Map(cs.map(c => [c.id, newState(c.id, { phase: 'learning', plan: [3] })]))
  const r = cramForInterview(cs, stateMap, '2026-09-22', TODAY, 45, new Map())
  expect(r.plans.size).toBe(0)
  expect(r.excluded).toHaveLength(2)   // 原计划由调用方保留，未被触碰
})

test('generateFreshPlans 已导出（cram 的依赖契约）', () => {
  expect(typeof generateFreshPlans).toBe('function')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/lib/scheduler/blocks-cram.test.ts`
Expected: FAIL —— `pauseCards` / `cramForInterview` / `generateFreshPlans` 未导出

- [ ] **Step 3: `src/lib/scheduler/schedule.ts`——把 `generatePlans` 改名导出**

```ts
export function generateFreshPlans(
  fresh: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  capacity: number,
  E: number,
  reservedLoad: ReadonlyMap<number, number>,
): { plans: Map<string, number[]>; load: DayLoad; dropped: DroppedReview[] } {
  // ……函数体不变（原私有 generatePlans），文件内 2 处调用点（schedule() 与
  // narrowSuggestion()）同步改名……
}
```

- [ ] **Step 4: `src/lib/scheduler/regenerate.ts` 末尾追加**

（import 区补充：`import { addDays, diffDays } from './date.js'`、`import { bufferOf } from './plan.js'`、`import { prefixCheck } from './capacity.js'`、`import { generateFreshPlans } from './schedule.js'`、`import { cmpRat, compareCardId, FREQ_ORDER, rat } from './types.js'`、`import type { LocalDate } from './date.js'`。）

```ts
/**
 * 减块（§5.5）：被取消块的卡置 phase = paused，plan[] 保留但不进
 * todayQueue。重新勾选时按剩余窗口续上，不从头再来——续上是调用方的
 * 职责（把保留的 plan 换算到新 today），这里只提供纯状态变换。
 */
export function pauseCards(states: CardState[], cardIds: readonly string[]): CardState[] {
  const ids = new Set(cardIds)
  return states.map(st => (ids.has(st.cardId) ? { ...st, phase: 'paused' as const } : st))
}

/**
 * 面试临时加密（§5.8）：用户真约到一场面试时（提前 2-5 天），
 * 对选中块里 s 最低的卡，在剩余窗口内按 §5.2 重新铺一遍。
 *
 * - readyByDate = 面试前一天（此时用户确实知道日期）
 * - 排序 (s 升序, frequency 降序, cardId 升序)：最薄弱的先救
 * - 二分取最大可行前缀（可行 = 无 drop 且前缀和通过，含 reservedLoad，
 *   直接满足 §11 "重排后每天总负载仍 ≤ 容量"）
 * - reservedLoad 含**其他块**的占用，但**不含本选中块的旧计划**——调用方先把
 *   它扣掉（与 regenerateAfterFailure 的 RegenContext 同一契约），否则本块
 *   容量被双计，正好踩中 §5.1 点名的静默超载
 * - excluded 的计划不出现在返回里——其余块逐字节不变是构造性保证
 * - E < 1（面试就在明后天）：没有可排的窗口，全部排除、原计划不动
 */
export function cramForInterview(
  selected: SchedulableCard[],
  states: ReadonlyMap<string, CardState>,
  examDate: LocalDate,
  today: LocalDate,
  capacity: number,
  reservedLoad: ReadonlyMap<number, number>,
): { plans: ReadonlyMap<string, number[]>; excluded: SchedulableCard[] } {
  const readyBy = addDays(examDate, -1)
  const R = diffDays(readyBy, today)
  const E = Math.max(0, R - bufferOf(R))
  if (E < 1) return { plans: new Map(), excluded: [...selected] }

  const ordered = [...selected].sort((a, b) => {
    const sa = states.get(a.id)?.s ?? rat(0, 1)
    const sb = states.get(b.id)?.s ?? rat(0, 1)
    return (
      cmpRat(sa, sb) ||
      FREQ_ORDER[b.frequency] - FREQ_ORDER[a.frequency] ||
      compareCardId(a.id, b.id)
    )
  })

  const feasible = (k: number): boolean => {
    const gen = generateFreshPlans(ordered.slice(0, k), states, capacity, E, reservedLoad)
    return gen.dropped.length === 0 && prefixCheck(gen.load, capacity, E) === undefined
  }
  let lo = 0
  let hi = ordered.length
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (feasible(mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  // 注意用新的 load 副本生成最终结果（feasible 探针改过 load）
  const gen = generateFreshPlans(ordered.slice(0, best), states, capacity, E, new Map(reservedLoad))
  return { plans: gen.plans, excluded: ordered.slice(best) }
}
```

- [ ] **Step 5: 运行确认通过（含全量回归）**

Run: `pnpm test` 然后 `pnpm typecheck`
Expected: 全部 passed，typecheck 无输出

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduler/schedule.ts src/lib/scheduler/regenerate.ts tests/lib/scheduler/blocks-cram.test.ts
git commit -m "feat(scheduler): 块级增减语义与临时加密——其余块逐字节不变"
```

---

### Task 9: §11 边界与不变量验收套件

**Files:**
- Test: `tests/lib/scheduler/acceptance.test.ts`
- Modify: `docs/superpowers/ROADMAP.md`（收尾）

**Interfaces:**
- Consumes: 全部前序导出。本任务是纯验收：spec §11 边界表逐条落成断言，不加新生产代码——除非某条失败暴露实现 bug（那就修实现，不改验收）。

- [ ] **Step 1: 写测试 `tests/lib/scheduler/acceptance.test.ts`**

```ts
import { schedule } from '../../../src/lib/scheduler/schedule.js'
import { addDays } from '../../../src/lib/scheduler/date.js'
import { rat } from '../../../src/lib/scheduler/types.js'
import type { CardState, SchedulableCard } from '../../../src/lib/scheduler/types.js'

const TODAY = '2026-09-21'

function mixed(n: number): SchedulableCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(3, '0')}`,
    frequency: (['high', 'mid', 'low'] as const)[i % 3]!,
  }))
}
function newState(id: string, over: Partial<CardState> = {}): CardState {
  return {
    cardId: id, phase: 'new', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0, ...over,
  }
}
const statesOf = (cs: SchedulableCard[]) => cs.map(c => newState(c.id))

test.each([0, 1, 2, 3])('边界 R=%i：不崩、不空队列、末次落在 E（§11）', R => {
  const cs = mixed(12)
  const readyBy = addDays(TODAY, R)
  const r = schedule(cs, statesOf(cs), readyBy, 45, TODAY)
  expect(r.mode).toBe('sprint')
  expect(r.todayQueue.length).toBeGreaterThan(0)
  const E = R <= 1 ? 0 : R - 1
  expect(r.plans.size).toBe(12)
  for (const plan of r.plans.values()) {
    expect(plan[plan.length - 1]).toBeLessThanOrEqual(E)
    // E=0 是豁免路径；E≥1 时 fw=1（12 张 ≤ 45），末次严格落在 E
    if (E >= 1) expect(plan[plan.length - 1]).toBe(E)
  }
})

test('I1：末次落在末端窗口内，高频卡最贴近 E（§11）', () => {
  const cs = mixed(100)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)  // E=20
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  const byId = new Map(cs.map(c => [c.id, c]))
  for (const [id, plan] of r.plans) {
    const last = plan[plan.length - 1]!
    expect(last).toBeGreaterThanOrEqual(18)   // fw = ceil(100/45) = 3
    expect(last).toBeLessThanOrEqual(20)
    if (byId.get(id)!.frequency === 'high') expect(last).toBe(20)
  }
})

test('I2 + I5：严格递增，同卡不同天；每天负载 ≤ 容量（§11）', () => {
  const cs = mixed(100)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)
  const perDay = new Map<number, number>()
  for (const plan of r.plans.values()) {
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]! - plan[i - 1]!).toBeGreaterThan(0)
    }
    for (const d of plan) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(45)
})

test('一张卡连续通过到面试：复习次数 = 计划长度，不发散（§11）', () => {
  const cs = mixed(30)
  const readyBy = addDays(TODAY, 21)
  const r0 = schedule(cs, statesOf(cs), readyBy, 45, TODAY)
  const live = [...r0.plans].map(([id, plan]) => ({ id, plan: [...plan] }))
  const initialTotal = live.reduce((a, p) => a + p.plan.length, 0)

  let consumed = 0
  for (let day = 0; day <= 20; day++) {
    const today = addDays(TODAY, day)
    const states = live.map(p => newState(p.id, {
      // 全部按时刷完：空计划即 done，防止被当成 fresh 重新生成
      phase: p.plan.length > 0 ? ('learning' as const) : ('done' as const),
      plan: p.plan.map(d => d - day),
    }))
    const r = schedule(cs, states, readyBy, 45, today)
    expect(r.plans.size).toBe(0)          // I4：通过从不触发重排
    for (const p of live) {
      consumed += p.plan.filter(d => d <= day).length
      p.plan = p.plan.filter(d => d > day)
    }
  }
  expect(consumed).toBe(initialTotal)     // 承诺几遍就刷几遍
})

test('只选 1 个块（20 题）：不告警，正常排满窗口（§11）', () => {
  const cs = mixed(20)
  const r = schedule(cs, statesOf(cs), addDays(TODAY, 21), 45, TODAY)
  expect(r.overloadWarning.earliestOverloadDay).toBeUndefined()
  expect(r.overloadWarning.dropped).toEqual([])
  // 新卡在 3 周窗口里至少铺出 5 次复习（[0,1,3,7,15,20]）
  expect([...r.plans.values()].every(p => p.length >= 5)).toBe(true)
})
```

- [ ] **Step 2: 运行确认通过（若失败，修实现而不是改断言）**

Run: `pnpm vitest run tests/lib/scheduler/acceptance.test.ts`
Expected: 8 passed（`test.each` 展开 4 条 + 具名 4 条）

- [ ] **Step 3: 全量回归**

Run: `pnpm test` 然后 `pnpm typecheck`
Expected: 计划 1 的 94 条 + 本计划的全部测试 passed；typecheck 无输出

- [ ] **Step 4: 更新 ROADMAP**

`docs/superpowers/ROADMAP.md` 两处：
1. 「五个实施计划」表中计划 2 的状态 `⬜ 未开始` → `✅ 已完成（src/lib/scheduler，纯函数零依赖）`；
2. 「一句话现状」与「下一步」按实际进度改写（计划 2 已交付，下一步指向计划 3 或内容批量生产）。
3. 文件头的「最后更新」日期改为执行当日。

- [ ] **Step 5: Commit**

```bash
git add tests/lib/scheduler/acceptance.test.ts docs/superpowers/ROADMAP.md
git commit -m "test(scheduler): §11 边界与 I1-I5 不变量验收套件全绿"
```

---

## 完成标准

- [ ] `pnpm test` 全绿（计划 1 的 94 条不回归 + 本计划新增全部通过）
- [ ] `pnpm typecheck` 无输出
- [ ] 五条不变量各有独立断言（Task 2 构造性 + Task 9 扫描性，双保险）
- [ ] spec §11 边界表逐条有对应测试：R=0/1/2/3（Task 9）、R<0（Task 5）、1200 题→收窄（Task 6）、单块 20 题（Task 9）、收窄后重跑（Task 6）、连续通过不发散（Task 9）、答错从明天起（Task 7）、逾期 5 天队首（Task 5）、维持模式进退与 120 封顶（Task 7）、临时加密（Task 8）、加块/减块/往返（Task 8）
- [ ] ROADMAP 已更新

## 与后续计划的衔接

- **计划 3（出题与掌握度）**：`weightedS` 已在 `types.ts`，掌握度侧的单次得分归一化到 `[0,1]` 后可直接 `rat()` 化喂给 `startTier` / `maintenanceStep`——排期引擎一行不用改（§4.4 的承诺由本计划兑现）。
- **计划 4（应用层）**：`card_state.plan` 在 DB 存绝对日期 + `planGeneratedAt`，调用 scheduler 前用 `diffDays(planDate, today)` 转偏移，返回后用 `addDays(today, offset)` 转回；`reservedLoadOf` 是加块与临时加密的必经之路；`review_log.algoVersion` 由调用方落盘，本库不感知。

