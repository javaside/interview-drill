# 计划评审 2 · 测试质量与可执行性

**被评审对象：** `docs/superpowers/plans/2026-09-18-content-toolchain.md`（第 1 轮修正后的版本）
**核对基准：** `docs/superpowers/specs/2026-09-15-interview-drill-design.md`
**视角：** 对测试质量挑剔的技术负责人 + "零上下文的人能不能把它执行完"

---

## 我做了什么

没有重跑第 1 轮做过的事。我做的是**变异测试**：把计划最终状态的全部源码和全部 78 条测试敲进 `/tmp/plan-review-2`，然后逐个把实现替换成**明显错误但类型正确**的版本，看测试挂不挂。

```
基线（计划原样）：
  Test Files  1 failed | 10 passed (11)
       Tests  3 failed | 75 passed (78)
```

**注意基线就不是绿的**（见 E2）。下面每个变异体的判据是"相对基线是否产生**新的**失败"。

| # | 变异体 | 结果 |
|---|---|---|
| M1 | `auditLibrary` 只返回第一条错误 | **全部通过** |
| M2 | `registerDecision` 永远写进**第一条**要点，无视 `keyPointId` | **全部通过** |
| M3 | `buildPairs` 的 `keyPointText` / `targetQuestion` 全返回空串 | **全部通过** |
| M4 | 两个 schema 的 `.strict()` 全部删掉 | **全部通过** |
| M5 | `checkIdLock` 忽略 `blockId` 前缀，只比要点裸 id | **全部通过** |
| M6 | 要点长度边界 off-by-one（正好 30 字被误拒） | **全部通过** |
| M7 | 池容量把退役卡的要点也算进可用池 | **全部通过** |
| M8 | 池容量误把 `confirmedIndependentOf` 也扣掉 | **全部通过** |
| M9 | Task 7 的 `status` 门控反了（`ready` 块反而不查池） | **全部通过** |
| M10 | Task 12 的两条审计检查整段删除 | **全部通过** |
| M11 | `parseCard` 的 schema 报错退化成「path: 不合法」 | **全部通过** |
| M12 | 缺 frontmatter 时返回 `issues: []`（审计静默跳过该文件） | **全部通过** |
| M13 | 删掉"`detail` 不能写进 frontmatter"检查 | **全部通过** |
| M14 | `screenPairs` 把人工队列顺序反过来 | **全部通过** |
| M15 | `checkBlockName` 的报错退化成 `'bad'` | **全部通过** |

**15 个变异体，15 个活下来。** 这不是"有几条测试弱"，是这套测试整体不具备鉴别力。

第 1 轮发现的 `registerExclusion` 事件（三条绿灯掩护一个污染 25-60 小时成果的 bug）不是偶发，是这套测试的**默认输出**。M2 就是同一个 bug 换了个位置重演。

---

## 1. 测试是不是真的在测东西

### T1 · `registerDecision` 写错要点，8 条测试一条都不响 —— 严重

**Task 11 Step 1 / Step 3**

夹具 `SRC` 只有**一条**要点 `kp-1`。于是"按 `keyPointId` 定位"这件事从来没被测过。

能骗过全部 8 条测试的实现（实测 `8 passed`）：

```ts
export function registerDecision(
  raw: string, keyPointId: string, targetCardId: string, decision: Decision,
): string {
  const fm = matter(raw, MATTER_OPTS)
  const data = detachedData(fm.data) as { keyPoints?: RawKeyPoint[] }
  const kps = data.keyPoints
  if (!Array.isArray(kps)) throw new Error('frontmatter 缺少 keyPoints 数组')

  const kp = kps.find(k => k.id === keyPointId)
  if (!kp) throw new Error(`要点 id 不存在：${keyPointId}`)   // ← 这行还在，第 7 条测试照过

  const kpBug = kps[0]!                                      // ← 但写的是第一条
  const field = decision === 'exclude' ? 'excludeAsDistractorFor' : 'confirmedIndependentOf'
  const cur = Array.isArray(kpBug[field]) ? (kpBug[field] as string[]) : []
  kpBug[field] = Array.from(new Set([...cur, targetCardId])).sort()

  return matter.stringify(fm.content, data, MATTER_OPTS)
}
```

真实后果：每一条人工互斥判定都写到卡的第一条要点上。`content:audit` **查不出来**——id 都是合法的，外键都对得上。25-60 小时的判断全部错位，且在出题引擎上线前无法发现。

**修正**：夹具换成三条要点，并断言"只有目标那条变了"。直接替换 Task 11 Step 1 的 `SRC` 与新增两条测试：

```ts
const SRC = `---
id: c1
blockId: b1
relatedBlocks: []
question: 问题？
cardType: enumeration
appliesTo: JDK 8+
frequency: mid
followUps: []
keyPoints:
  - id: kp-a
    text: 要点一
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/a
      locator: x
  - id: kp-b
    text: 要点二
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/b
      locator: y
  - id: kp-c
    text: 要点三
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/c
      locator: z
---

正文`

test('登记只落在指定的那条要点上，其余要点逐字节不变', () => {
  const out = registerDecision(SRC, 'kp-b', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints.map(k => k.excludeAsDistractorFor)).toEqual([[], ['c2'], []])
  expect(r.card.keyPoints.map(k => k.confirmedIndependentOf)).toEqual([[], [], []])
})

test('写回最后一条要点也正确 —— 不是只有 index 0 能用', () => {
  const out = registerDecision(SRC, 'kp-c', 'c9', 'independent')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints.map(k => k.confirmedIndependentOf)).toEqual([[], [], ['c9']])
})
```

`Expected` 从 `8 passed` 改成 `10 passed`。

---

### T2 · `auditLibrary` 只报第一条错误也全绿 —— 严重

**Task 6 Step 1、Task 7 Step 1**

全部审计测试的断言只有两种形态：`expect(r.errors).toEqual([])`，或 `expect(r.errors.join()).toContain('某个词')`。**没有一条断言错误的条数。** 而每个用例的夹具都只制造一类错误，且那类错误恰好排在第一位。

能骗过全部审计测试的实现（实测无新增失败）：

```ts
export function auditLibrary(cards: Card[], blocks: Block[] = []): AuditResult {
  // ...（函数体一字不改）
  return { errors: errors.slice(0, 1), warnings }   // ← 只报第一条
}
```

这正是任务书点名要查的"多个错误同时出现时会不会只报第一个"。答案是：**会，而且测试完全看不见**。真实后果是内容作者一次只能修一个问题，跑一次 CI 修一条，1345 张卡的批量导入变成逐条打地鼠。

**修正**：加一条明确的组合场景测试（放在 Task 7 Step 1 末尾，此时三类检查都已就位）：

```ts
test('多类错误同时出现时全部报出，不是只报第一条', () => {
  const kps = () => [kp('x1'), kp('x2'), kp('x3')]
  const cards = [
    card('dup', 'b1', kps()),                                       // 卡 id 重复
    card('dup', 'b1', [kp('y1'), kp('y2'), kp('y3')]),
    card('c3', 'b1', [kp('z1', { excludeAsDistractorFor: ['ghost'] }), kp('z2'), kp('z3')]),
    card('c4', 'b1', kps(), { relatedBlocks: ['no-such-block'] }),   // 注意 kps() 与 dup 撞 id
  ]
  const errs = auditLibrary(cards).errors
  expect(errs.some(e => e.includes('卡 id 重复'))).toBe(true)
  expect(errs.some(e => e.includes('要点 id 在块'))).toBe(true)
  expect(errs.some(e => e.includes('ghost'))).toBe(true)
  expect(errs.some(e => e.includes('no-such-block'))).toBe(true)
  expect(errs.some(e => e.includes('干扰项池不足'))).toBe(true)
  expect(errs.length).toBeGreaterThanOrEqual(5)
})
```

---

### T3 · `.strict()` 是全计划被论证得最重的一行，零测试 —— 严重

**Task 3 Step 3**

schema.ts 里为 `.strict()` 写了三行注释论证它有多重要（`retiredAT` 拼错 → 作者以为下线了，卡继续出题给用户）。**然后没有一条测试碰它。**

实测：把两个 `.strict()` 全删掉，78 条测试相对基线**零新增失败**。

能骗过的实现就是删掉两处 `.strict()`。等价地，下面这份"内容"在计划的测试体系下是完全合法的：

```yaml
retiredAT: 2026-01-01     # 大小写错 —— 无字段被拒，无警告，卡继续出题
movedFrm: old-id          # 拼错 —— CI 报"id 消失了"，作者去找不存在的删除操作
```

**修正**：加进 Task 3 Step 1：

```ts
test('卡级未知字段被拒 —— retiredAT 拼错必须有信号', () => {
  const r = cardSchema.safeParse({ ...card(), retiredAT: '2026-01-01' })
  expect(r.success).toBe(false)
  if (r.success) return
  expect(JSON.stringify(r.error.issues)).toContain('retiredAT')
})

test('要点级未知字段被拒', () => {
  const bad = { ...kp(), confirmedIndependentOff: [] }
  const r = cardSchema.safeParse(card({ keyPoints: [bad as never, kp({ id: 'b' }), kp({ id: 'c' })] }))
  expect(r.success).toBe(false)
})

test('detail 写进 frontmatter 被 parseCard 显式拒绝，不是静默覆盖', () => {
  // 这条放进 parse.test.ts
  const bad = SRC.replace('---\n\nAQS', 'detail: 我把 detail 写在了 frontmatter\n---\n\nAQS')
  const r = parseCard(bad, 'x.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('detail')
})
```

`Expected` 从 `7 passed` 改成 `9 passed`（Task 3）、`6 passed` 改成 `7 passed`（Task 5）。

---

### T4 · `checkIdLock` 的 `blockId` 前缀作用域从未被测 —— 严重

**Task 8 Step 1**

lockfile 用 `kp:<blockId>/<keyPointId>` 格式，是因为要点 id 只保证**块内**唯一——这是第 1 轮 S5 的全部理由。但两条相关测试（`kp:b1/kp-1` 放行、`kp:b1/kp-gone` 拦下）里只有一个块 `b1`，作用域从来没有被验证。

能骗过全部 8 条测试的实现（实测 `8 passed`）：

```ts
const liveKeyPoints = new Set(
  cards.flatMap(c => c.keyPoints.map(kp => kp.id)),     // ← 丢掉 blockId
)
// ...
} else if (kind === 'kp') {
  if (liveKeyPoints.has(id.split('/').pop()!)) continue  // ← 只比裸 id
```

后果：把一张卡从 `mysql/mvcc-undo` 移到 `mysql/isolation`，守卫认为要点还在（裸 id 没变），实际 `review_log` 里的 `blockId/kpId` 已经全部悬空。

**修正**：加一条跨块用例：

```ts
test('要点 id 的作用域是块 —— 卡换了块就算消失', () => {
  const moved = card('c1', { blockId: 'b2' })
  const errs = checkIdLock([moved], ['card:c1', 'kp:b1/kp-1'])
  expect(errs.join()).toContain('b1/kp-1')
})

test('不同块的同名要点 id 互不顶替', () => {
  const a = card('c1')                        // b1/kp-1
  const b = card('c2', { blockId: 'b2' })     // b2/kp-1
  expect(checkIdLock([a, b], ['card:c1', 'card:c2', 'kp:b1/kp-1', 'kp:b2/kp-1'])).toEqual([])
  expect(checkIdLock([b], ['card:c2', 'kp:b1/kp-1']).join()).toContain('b1/kp-1')
})
```

`Expected` 从 `8 passed` 改成 `10 passed`。

**顺带一个设计缺口**：`Card` 有 `movedFrom` 放行开关，`KeyPoint` **没有**。要点 id 一旦进了 lockfile 就永远不能删改，而报错文案只说"删改会让历史记录无法解释"，**不给任何出路**（卡级报错是给了的）。作者在复审时判定一条要点写错了要删掉——这是常态——会撞上一个没有解法的 CI 红灯。要么在 `KeyPoint` 上加 `movedFrom?: string` 和 `retiredAt?: string`，要么把报错文案改成明确的操作指引。**这一条现在两者都没有。**

---

### T5 · `buildPairs` 把文本字段清空也全绿 —— 严重

**Task 10 Step 1**

6 条测试全部只断言 `ownerCardId` / `keyPointId` / `targetCardId` 和数组长度。`keyPointText` 和 `targetQuestion` **一条断言都没有**——而这两个字段是预筛打分器的全部输入，也是人工确认界面上唯一显示的东西。

能骗过全部 6 条测试的实现（实测 `6 passed`）：

```ts
out.push({
  ownerCardId: owner.id,
  keyPointId: kp.id,
  keyPointText: '',        // ← 人工确认界面上永远空白
  targetCardId: target.id,
  targetQuestion: '',      // ← 打分器永远拿到空串
})
```

**修正**：把 Task 10 Step 1 的 `要点不与自己所属的卡配对` 一条扩成：

```ts
test('每组都带上要点原文与目标题面 —— 它们是人工确认界面上唯一的信息', () => {
  const cards = [card('c1', 'b1', [kp('k1')]), card('c2', 'b1', [kp('k2')])]
  const pairs = buildPairs(cards, 'b1')
  expect(pairs).toHaveLength(2)
  expect(pairs.map(p => [p.keyPointText, p.targetQuestion]).sort()).toEqual([
    ['要点 k1', '问题 c2？'],
    ['要点 k2', '问题 c1？'],
  ])
})
```

`Expected` 从 `6 passed` 改成 `7 passed`。

---

### T6 · `parseCard` 的失败路径只测"返回了 false" —— 严重

**Task 5 Step 1**

对 1345 张卡 × 约 4.5 条要点的人工产线来说，**报错信息就是产品**。而两条失败路径测试是这样的：

```ts
test('schema 不合法时返回错误而非抛异常，且带上文件路径', () => {
  const bad = SRC.replace('cardType: enumeration', 'cardType: essay')
  // ...
  expect(r.issues.join()).toContain('content/x/y.md')   // ← 只查了路径
})

test('缺 frontmatter 时报错不崩', () => {
  const r = parseCard('只有正文没有 frontmatter', 'content/x/y.md')
  expect(r.ok).toBe(false)                              // ← 只查了 false
})
```

第一条能被这个实现骗过（实测 `6 passed`）：

```ts
if (!parsed.success) {
  return { ok: false, issues: [`${path}: 不合法`] }   // ← 字段名、错误原因全丢
}
```

第二条更糟，能被这个实现骗过（实测 `6 passed`）：

```ts
if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
  return { ok: false, issues: [] }    // ← 空 issues
}
```

空 `issues` 在 `tools/audit-cli.ts` 里的行为是：`if (r.ok) cards.push(...) else issues.push(...r.issues)`——**推进去零条**。于是这个文件既不在库里，也不产生任何报错，`content:audit` 打印"内容审计通过"。一张卡凭空消失。

**修正**：两条测试都补上内容断言：

```ts
test('schema 不合法时报错指出字段名与非法取值', () => {
  const bad = SRC.replace('cardType: enumeration', 'cardType: essay')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  const msg = r.issues.join()
  expect(msg).toContain('content/x/y.md')
  expect(msg).toContain('cardType')
})

test('缺 frontmatter 时返回非空的、说人话的报错', () => {
  const r = parseCard('只有正文没有 frontmatter', 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.length).toBeGreaterThan(0)
  expect(r.issues.join()).toContain('frontmatter')
})
```

并在 `audit-cli.ts` / `cli.ts` 里加一道断言防线（见 E5）。

---

### T7 · 剩下的弱断言，逐条列出

| 变异体 | Task | 现状 | 一句话修正 |
|---|---|---|---|
| M6 长度边界 `n >= 30` | 4 | 只测了 31 字被拒，**没测 30 字被放行**，off-by-one 双向都活 | 加 `expect(checkKeyPointText('在'.repeat(30))).toEqual([])` |
| M7 退役卡进池 | 7 | 池容量测试里**没有任何退役卡**，两处 `retiredAt` 跳过全是死代码 | 加"退役卡的要点不计入可用池"用例 |
| M8 误扣 `confirmedIndependentOf` | 7 | 没有夹具填过这个字段，"答否的要点仍可当干扰项"这条语义无测试 | 加一条 `confirmedIndependentOf` 被填满、池仍然充足的用例 |
| M14 `screenPairs` 顺序反转 | 13 | 只断言集合，不断言顺序；人工队列的次序是重跑恢复的唯一依据 | 三组夹具、断言 `.map(f => f.pair.keyPointId)` 全序 |
| M15 报错退化成 `'bad'` | 4 | `checkBlockName` 只断言 `toHaveLength(1)`，不查消息内容（`checkKeyPointText` 查了，不一致） | 改成 `expect(checkBlockName(\`MySQL ${word}\`)[0]).toContain(word)` |
| `screenPairs` 阈值边界 | 13 | 分数 0.9/0.3/0.1 对阈值 0.5/0.2，**没有相等的情形**，`>=` 还是 `>` 未定义 | 加 `score = async () => 0.5`、阈值 `0.5`，断言保留 |
| `Flagged.score` | 13 | 三条测试没有一条读 `.score`，恒返回 0 也全绿 | 断言 `flagged[0]!.score` 等于打分器返回值 |
| `countHanChars` | 4 | 导出了，零直接测试 | 加中英混排、emoji、标点的计数用例 |
| `block.status: 'ready'` | 12 | 只测了 `wip` 和缺省，`ready` 从未被解析过 | 加 `status: ready` 的解析用例 |

---

### T8 · 关键行为完全没有测试

**a) Task 12 的两条审计检查零覆盖 —— 严重**

Task 12 Step 4 往 `auditLibrary` 里加了"卡的 blockId 没有对应 block.yml"和"块 id 重复"，然后 Step 5 写：

> Expected: 全部 passed（既有测试因 `blocks` 有默认值而不受影响）

这句话本身就是自白：**新加的代码没有任何测试会执行到它**。实测把这整段删掉，78 条测试零新增失败（M10）。

**b) Task 7 的 `status` 门控零覆盖 —— 严重**

`blocks.filter(b => b.status === 'ready')` 决定整个池容量检查跑不跑。没有任何测试给 `auditLibrary` 传过第二个参数。把它改成 `=== 'wip'`（语义完全反过来：在建块查池、完善块不查）——实测零新增失败（M9）。这个错误要等到第一个块标 `ready` 时才暴露，那是几个月以后。

**修正**：Task 12 Step 4 后面加 Step，并把这两组一起补上：

```ts
// tests/lib/content/audit-blocks.test.ts —— 新文件
import { auditLibrary } from '../../../src/lib/content/audit.js'
import type { Block } from '../../../src/lib/content/block.js'
// card / kp 夹具同 audit-pool.test.ts，但 blockId 可传

const block = (id: string, status: 'wip' | 'ready'): Block =>
  ({ id, name: `块 ${id}`, category: 'mysql', status })

test('卡的 blockId 没有对应 block.yml 时报错', () => {
  const errs = auditLibrary([card('c1', 'b1', K3('a'))], [block('b2', 'wip')]).errors
  expect(errs.some(e => e.includes('没有对应的 block.yml'))).toBe(true)
})

test('块 id 重复被报出', () => {
  const errs = auditLibrary([], [block('b1', 'wip'), block('b1', 'ready')]).errors
  expect(errs.some(e => e.includes('块 id 重复'))).toBe(true)
})

test('wip 块不受池容量校验', () => {
  const cards = [card('c1', 'b1', K3('a')), card('c2', 'b1', K3('b'))]   // 池 = 3 < 12
  expect(auditLibrary(cards, [block('b1', 'wip')]).errors).toEqual([])
})

test('ready 块受池容量校验 —— 门控方向不能反', () => {
  const cards = [card('c1', 'b1', K3('a')), card('c2', 'b1', K3('b'))]
  const errs = auditLibrary(cards, [block('b1', 'ready')]).errors
  expect(errs.some(e => e.includes('干扰项池不足'))).toBe(true)
})
```

**c) `exclude` 与 `independent` 可以同时成立，没人拦 —— 一般**

实测：对同一个 `(要点, 目标题)` 先答 y 再答 n（复审时改主意，是常态），结果是

```
excludeAsDistractorFor: [ 'c2' ]
confirmedIndependentOf: [ 'c2' ]
→ auditLibrary 完全不报
```

两张表在语义上互斥。`buildPairs` 两边都跳过，所以工具再也不会问第二遍——这条矛盾会永久留在源文件里。

**修正**：`auditLibrary` 加一条检查 + 一条测试：

```ts
for (const c of cards) {
  for (const kp of c.keyPoints) {
    const both = kp.excludeAsDistractorFor.filter(t => kp.confirmedIndependentOf.includes(t))
    for (const t of both) {
      errors.push(
        `卡 ${c.id} 要点 ${kp.id} 对题 ${t} 同时登记了「互斥」和「不成立」，` +
        `两者语义相反。请删掉其中一条 —— 保留哪条是人工判断，工具不替你猜。`,
      )
    }
  }
}
```

**d) 两个 CLI 零测试、零手动验证步骤 —— 一般**

`tools/review/cli.ts`（Task 13 Step 4，76 行）和 `tools/audit-cli.ts`（Task 14 Step 1，65 行）都是"一个 Step 写完整个文件"。Task 13 **没有任何步骤运行过 `review:pairs`**——它第一次执行是在 Task 15 Step 5。Task 13 Step 5 只跑 `review-recall.test.ts`，与 cli.ts 无关。

至少给 Task 13 补一个手动验证 Step（此时 `content/` 里有 Task 9 留下的卡，能跑）：

```
- [ ] **Step 5: 手动跑一次 CLI，确认它能读盘、能预筛**

Run: `pnpm review:pairs mysql/mvcc-undo`
Expected: 打印"组合总数 0，其中未登记 0 组"（此刻块内只有一张卡，
countPairs 对 live.length < 2 返回 0）。**看到 0 是对的**，
说明读盘与组合生成都通了；真实组合数要等 Task 15 填满块。
```

**e) 中断恢复**（任务书点名）：结论是**数据层面成立、交互层面有一个洞**。答 `y`/`n` 都立即写盘，重跑时 `buildPairs` 跳过两类已决组合，所以 `q` 退出不丢进度——这一点设计是对的。但 **`s`（跳过）不留痕**：跳过的组合下次原样再问，与全新组合混在一起，没有任何标记。人工队列上千组时，"我上次跳过了但还没查资料"这个状态是刚需。要么去掉 `s`，要么给它一个 `deferred` 落点。

---

## 2. 修改后的内部一致性

### E1 · Task 7 引用了 Task 12 才创建的 `blocks` —— 致命

**Task 7 Step 4 ↔ Task 12 Step 4**

Task 7 Step 4 插入的代码里有：

```ts
const readyBlocks = new Set(blocks.filter(b => b.status === 'ready').map(b => b.id))
for (const [blockId, blockCards] of byBlock) {
  if (blocks.length > 0 && !readyBlocks.has(blockId)) continue
```

但此时 `auditLibrary` 的签名是 Task 6 定的 `auditLibrary(cards: Card[])`——**`blocks` 这个标识符不存在**，`Block` 类型也要等 Task 12 才有。实测 `tsc --noEmit`：

```
src/lib/content/audit.ts(56,31): error TS2552: Cannot find name 'blocks'. Did you mean 'blockIds'?
src/lib/content/audit.ts(56,45): error TS7006: Parameter 'b' implicitly has an 'any' type.
src/lib/content/audit.ts(56,76): error TS7006: Parameter 'b' implicitly has an 'any' type.
src/lib/content/audit.ts(59,9): error TS2552: Cannot find name 'blocks'. Did you mean 'blockIds'?
```

vitest 走 esbuild 只剥类型不做检查，所以运行时是 `ReferenceError: blocks is not defined`——**Task 7 Step 5 写的 "Expected: 全部 passed" 不可能达到**，五个测试文件全炸。

`Did you mean 'blockIds'?` 是额外的陷阱：`blockIds` 确实在作用域里（`Set<string>`），零上下文的执行者极可能顺着编译器的建议改，或者干脆把那两行删掉——**删掉的后果是 `status` 门控永远不生效**，而没有任何测试会告诉他（见 T8-b）。

这是 `block.status` 那次批量修改留下的。`status` 是 Task 12 的概念，被塞进了 Task 7 的代码块。

**修正（推荐）**：把 `status` 门控整段从 Task 7 挪到 Task 12。Task 7 Step 4 的插入代码改成不带门控的版本：

```ts
  // 干扰项池容量：对每张卡，同块其他卡的要点里有多少是可用的
  const byBlock = new Map<string, Card[]>()
  for (const c of cards) {
    const list = byBlock.get(c.blockId)
    if (list) list.push(c)
    else byBlock.set(c.blockId, [c])
  }

  for (const [blockId, blockCards] of byBlock) {
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

然后 Task 12 Step 4 在改签名的同时，把门控加回去，措辞给出可定位的锚点：

```
把第一行 `for (const [blockId, blockCards] of byBlock) {` 之前插入：

    // 池容量只校验已完善的块。内容生产要持续 4-9 个月，期间绝大多数块是半成品，
    // 让在建块把 CI 一直染红等于让所有人学会忽略它。
    const readyBlocks = new Set(blocks.filter(b => b.status === 'ready').map(b => b.id))

并把那一行循环体的第一句改成：

      if (blocks.length > 0 && !readyBlocks.has(blockId)) continue
```

### E2 · Task 6 的测试夹具在 Task 7 之后必挂 3 条 —— 致命

**Task 6 Step 1**

```ts
const K3 = () => [kp('kp-1'), kp('kp-2'), kp('kp-3')]

test('干净的库通过审计', () => {
  const r = auditLibrary([card('c1', 'b1', K3()), card('c2', 'b1', K3())])
  expect(r.errors).toEqual([])
})
```

同一个块 `b1` 里两张卡都用 `kp-1/kp-2/kp-3`，直接触发同一个 Step 刚写的块内唯一性检查；Task 7 加上池容量后又多一重（池 = 3 < 12）。实测计划最终状态：

```
❯ tests/lib/content/audit-identity.test.ts  (8 tests | 3 failed)
   × 干净的库通过审计
   × 要点 id 跨块重复是允许的
   × 退役卡仍算存在，指向它的外键不算悬空
```

**这条第 1 轮报过（F3）、修正也给了（改夹具 + 补 filler 卡），但没有落到计划里。** 我核了 `9a9f12f fix(plan): 按实跑评审修正内容工具链计划` 之后的文件，夹具原封未动。

**修正**：替换 Task 6 Step 1 的夹具与四条受影响的测试：

```ts
const K3 = (p: string) => [kp(`${p}-1`), kp(`${p}-2`), kp(`${p}-3`)]

// 池容量下界是 12，即每张卡需要同块另外 4 张卡（4 × 3 = 12）。
// 这些 filler 与本文件要测的 id 语义无关，只是把池填到及格线。
const filler = (blockId: string) =>
  [1, 2, 3].map(i => card(`f${i}-${blockId}`, blockId, K3(`f${i}${blockId}`)))

test('干净的库通过审计', () => {
  const r = auditLibrary([card('c1', 'b1', K3('a')), card('c2', 'b1', K3('b')), ...filler('b1')])
  expect(r.errors).toEqual([])
})

test('要点 id 跨块重复是允许的', () => {
  const a = card('c1', 'b1', K3('same'))
  const b = card('c2', 'b2', K3('same'))
  expect(auditLibrary([a, b, ...filler('b1'), ...filler('b2')]).errors).toEqual([])
})

test('退役卡仍算存在，指向它的外键不算悬空', () => {
  const dead = card('c-dead', 'b1', K3('d'), { retiredAt: '2026-01-01' })
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['c-dead'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([dead, live, ...filler('b1')]).errors).toEqual([])
})
```

注意 `退役卡仍算存在` 这条还要补一张 filler——退役卡不计入可用池，`live` 的池只剩 filler 的 9 条，仍不足 12。**这正说明夹具与 `MIN_BLOCK_POOL` 的耦合已经失控**，第 1 轮的"修正 B（把 `auditLibrary` 拆成四个独立导出的检查）"是更该采纳的那个：Task 6 测 `checkIdentity` / `checkForeignKeys`，Task 7 测 `checkDistractorPools`，Task 12 测 `checkBlockBinding`，后加的规则不会再把前面的测试打翻，E1 的插入位置歧义也一起消失。

### E3 · 两处 markdown 代码围栏没闭合，Task 8-11 的渲染整体错位 —— 严重

**Task 8 Step 1（第 1093 行后）、Task 11 Step 1（第 1587 行后）**

两处测试代码块都少了收尾的 ` ``` `。全文 106 个围栏虽然是偶数，但配对是错的：从 Task 8 Step 1 一直到 Task 11 Step 3，**散文被渲染成代码块、代码块被渲染成散文**。任何按 markdown 阅读的人（以及任何按围栏提取代码的工具）拿到的是一份错乱的文档。

这两处恰好就是批量修改新增测试的位置（Task 8 加 `无法识别的 lockfile 行`、Task 11 改 `registerDecision`）。

**修正**：第 1093 行 `})` 之后、第 1587 行 `})` 之后各补一行 ` ``` `。改完用 `grep -c '^```'` 复核仍是偶数，并逐个核对开闭语言标记。

### E4 · `pnpm-lock.yaml` 从未提交，CI 第一步必挂 —— 严重

**Task 1 Step 7 ↔ Task 14 Step 3**

Task 14 的 workflow 是 `- run: pnpm install --frozen-lockfile`。但全计划的 `git add` 路径里**没有任何一条包含 `pnpm-lock.yaml`**：

| Task | `git add` |
|---|---|
| 1 | `package.json tsconfig.json vitest.config.ts src tests` |
| 5 | `src/lib/content/yaml.ts src/lib/content/parse.ts tests/... package.json` |

`--frozen-lockfile` 在 lockfile 缺失时直接 `ERR_PNPM_NO_LOCKFILE` 退出，`pnpm typecheck` / `pnpm test` / `pnpm content:audit` 一条都跑不到。CI 从建立那天起就是红的。

**修正**：Task 1 Step 7 改成

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts src tests
git commit -m "chore: 项目骨架与测试环境"
```

Task 5 Step 6 同样补 `pnpm-lock.yaml`（那一步新增了 `js-yaml` 依赖）。

顺带：计划从头到尾没有 `.gitignore`。现在靠"每次 `git add` 都写显式路径"躲过 `node_modules`，能撑住，但第一个手滑 `git add .` 就完了。Task 1 应当加一步建 `.gitignore`（`node_modules/`、`.DS_Store`）。

### E5 · `review/cli.ts` 静默丢弃解析失败的卡 —— 严重

**Task 13 Step 4**

```ts
for (const f of walk('content')) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) { cards.push(r.card); fileOf.set(r.card.id, f) }
}
```

**没有 `else`。** 解析失败的卡直接从这个工具的世界里消失——它的要点不进组合，它也不作为目标题被问。

实测（试点块 5 张卡，把其中一条要点改成含「等待队列」使其解析失败）：

```
改之前: 块 mysql/mvcc-undo：组合总数 52，其中未登记 52 组
改之后: 块 mysql/mvcc-undo：组合总数 30，其中未登记 30 组
```

**52 → 30，零提示。** 人工确认完 30 组，以为这个块做完了，实际 22 组从未被问过。CLI 末尾那句"记得跑 `pnpm content:audit`"是在损失发生之后。

**修正**：解析失败必须**中止**，不是跳过：

```ts
const fileOf = new Map<string, string>()
const cards: Card[] = []
const parseIssues: string[] = []
for (const f of walk('content')) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) { cards.push(r.card); fileOf.set(r.card.id, f) }
  else parseIssues.push(...r.issues)
}
if (parseIssues.length > 0) {
  // 不能跳过。少一张卡就少一批组合，而人工确认的进度看不出缺口 ——
  // 审核者会以为这个块做完了。
  console.error(`有 ${parseIssues.length} 个问题导致部分卡无法解析，互斥检查会漏组合：`)
  for (const i of parseIssues) console.error(`  - ${i}`)
  console.error('\n请先跑 pnpm content:audit 修完再回来。')
  process.exit(1)
}
```

`audit-cli.ts` 那边同理，虽然它确实把 issues 收集了，但建议加一条防御：`if (!r.ok && r.issues.length === 0) issues.push(\`${f}: 解析失败但未给出原因（parseCard 的 bug）\`)`。

### E6 · Task 14 Step 4 与 Task 15 Step 1/4 的因果关系写反了 —— 一般

Task 14 Step 4 说：

> 这是**预期结果，不是 bug**：此刻 `content/` 里只有 Task 9 Step 6 生成的那一张占位卡……**Task 15 填满试点块之后它才会转绿。**

但 Task 15 Step 1 自己写着：

> `status: wip` 让本块暂不受干扰项池容量校验——**五张卡的试点本来就凑不满 12 条可用池**

审计转绿**不是因为块被填满，是因为 Task 15 建了一个 `status: wip` 的 block.yml 把这条检查关掉了**。两处说法互相矛盾，而且 Task 15 Step 4 的"若报干扰项池不足，说明 5 张卡撑不起池下界——这本身是有效发现，记进校准笔记"是一句**永远不会触发**的死话。

**修正**：Task 14 Step 4 末句改成

> Task 15 建 `block.yml` 时把该块标成 `status: wip`，池容量检查对在建块不生效，审计随即转绿。**注意这意味着从 Task 15 起，池下界这条检查在真实内容上一次都没跑过**——第一个块标 `ready` 时才会第一次生效。

Task 15 Step 4 的 Expected 改成

> Expected: `内容审计通过`。**这条通过不代表内容合格**——`status: wip` 关掉了池容量检查，而其余检查（id 唯一性、外键、块归属）都不看内容质量。见 V2。

### E7 · `MIN_BLOCK_POOL` 对 `sequence` / `atomic` 两型没有意义 —— 严重

**Task 7 Step 3**

池下界的推导是"9 选、正确要点最少 3 条 → 最多 6 条干扰项 → 取 2 倍余量 = 12"。但 spec §4.3 的题型表里：

| `cardType` | 出题形式 | 需要的同块干扰项 |
|---|---|---|
| `enumeration` / `comparison` | 9 选，3-6 条正确 | 最多 6 |
| `sequence` | **排序题**：4-6 个步骤拖动排序，选项就是它自己的要点 | **0** |
| `judgment` | 二段式：先选结论，再选支撑要点 | < 6 |
| `atomic` | **单选 4 选 1，不走 keyPoints 计分** | 最多 3 |

计划对**每一张卡**一视同仁地要求 12 条同块池。对 `sequence` 型这是定义上的错误——它根本不抽干扰项。按 spec §4.3 的目标占比（`sequence` ~20%、`atomic` ~8%），78 个块里约 28% 的卡被一条与它们无关的规则卡住，作者的应对只能是往块里注水凑题。

而且这条检查现在是 **error（构建失败）**，但 spec §4.3 明确给了运行时降级路径："池不足时的降级：优先从同大类补足；同大类也不够时从相邻大类抽并记日志告警"。把一个 spec 说明可以降级的约束做成硬失败，与 spec 不一致。

**修正**：按 `cardType` 分派下界，并把它降为 warning：

```ts
/**
 * 同块可用干扰项池下界，按 cardType 分派。§4.3 的出题形式决定需求：
 * - enumeration / comparison：9 选、正确最少 3 条 → 单次最多吃 6 条；s=1 档是 3:0
 *   （干扰项全来自同块），取 2 倍余量 = 12
 * - judgment：二段式，支撑要点部分同上但结论占一半，取 8
 * - atomic：4 选 1，单次 3 条干扰项，取 2 倍余量 = 6
 * - sequence：排序题，选项就是本卡自己的步骤，不抽同块干扰项 → 0
 */
export const MIN_BLOCK_POOL: Record<CardType, number> = {
  enumeration: 12, comparison: 12, judgment: 8, atomic: 6, sequence: 0,
}
```

对应的 Task 7 Step 1 测试也要重写（现在 `expect(MIN_BLOCK_POOL).toBe(12)` 这条断言本身就是任务书说的"无论实现怎么写都会通过"的反面——它把一个数字钉死了，但没有任何测试验证那个数字**被正确使用**）。补上：

```ts
test('sequence 型不要求同块干扰项池 —— 它的选项是自己的步骤', () => {
  const only = [seqCard('c1', 4)]      // 块里只有这一张
  expect(auditLibrary(only, [block('b1', 'ready')]).errors).toEqual([])
})

test('atomic 型的下界低于 enumeration', () => {
  expect(MIN_BLOCK_POOL.atomic).toBeLessThan(MIN_BLOCK_POOL.enumeration)
})
```

**如果你不想现在改数值**，最低限度是把这条检查降级成 warning 并在计划里写明"`sequence` / `atomic` 被这条规则误伤，等出题引擎计划确认各型的真实需求后再定"。现在的状态是一条会拦人、且拦错人的硬规则。

### E8 · "B5" 这个规则编号在 spec 里不存在 —— 一般

计划 6 处引用「B5」（文件结构表、`rules.ts` 注释、错误文案、两条 commit message、Task 12 测试名、Task 15 Step 1）。spec 全文 `grep -c B5` = **0**。spec §9.3 里块名黑名单是"三条机器校验规则"的第 3 条，没有编号；`KP1-KP6` 有编号，`B*` 没有。

后果最直接的是这行**会打给内容作者看**的文案：

```ts
issues.push(`块名含模糊词「${w}」，说明块的边界没定清楚（违反 B5）`)
```

作者去 spec 里搜 B5，搜不到。

**修正**：文案改成引 spec 里真实存在的位置：

```ts
issues.push(`块名含模糊词「${w}」，说明块的边界没定清楚（§9.3 机器校验规则 3）`)
```

其余 5 处一并替换。顺带：Task 15 Step 3 写"要点须符合 §9.3 的 KP1-KP6"，而"本计划明确不覆盖"表里写的是"§9.3 **KP1-KP4** 要点粒度的人工判据"——两处编号范围不一致，spec 里是 KP1-KP6。

### E9 · 数字与清单的零碎不一致 —— 一般

| 位置 | 写的 | 实际 |
|---|---|---|
| Task 6 Step 4 | `Expected: 7 passed` | 该文件有 **8** 条测试（且 3 条失败） |
| 文件结构表 | 列了 10 个文件 | 缺 `src/lib/content/yaml.ts`（Task 5 Step 3 创建，被 4 个模块依赖）、`.github/workflows/content.yml`、`pnpm-lock.yaml` |
| Task 4 Step 4 | `全部 passed（……以实际输出为准）` | 实测 **18**。"以实际输出为准"等于取消了这个 Expected 的作用——执行者无法区分"18 条全过"和"漏了一个 `test.each` 参数只跑了 17 条" |

`MIN_KEY_POINTS` / `confirmedIndependentOf` / `registerDecision` / 带前缀的 lockfile 这四项我逐处核了（类型、schema、夹具、脚手架模板、CLI、审计、测试、Task 15），**同步是完整的**，没有遗漏。`block.status` 的同步只差 E1 那一处。

---

## 3. 任务粒度与可执行性

### X1 · Task 15 Step 3 是整个计划里最大的一块，而它是一个复选框 —— 严重

> - [ ] **Step 3: 填写五张卡的真实内容，每张计时**

这一步要求：5 张卡、约 13 条要点，每条要点配一个指向英文一手资料并精确到章节号或类#方法的 `source`，全部符合 KP1-KP6，外加 5 段 `detail` 正文。这不是"一个动作、2-5 分钟"，按 spec §9.1 自己的 7-12 分钟/题也要接近一小时，而那个数字是"批量预生成之后"的审核工时，不是从零写作 + 查一手资料的工时。

更要命的是**它对零上下文的人不可执行**，有三个具体缺口：

**a) 没给一个正确 `source` 的样例。** 脚手架产出的是 `url: https://example.org/REPLACE-ME` / `locator: REPLACE-ME`，计划里唯一像样例的是测试夹具里的 `https://github.com/openjdk/jdk/blob/master/AQS.java` + `AbstractQueuedSynchronizer#state`——那是 Java，本任务是 MySQL。执行者不知道 MySQL 手册该填哪个 URL 形态、哪个版本、`locator` 写章节号还是锚点。

**修正**：在 Step 3 里给一张对照表：

```markdown
`source` 填写规范（本块用）：

| kind | url 形态 | locator 形态 | 例 |
|---|---|---|---|
| `official-doc` | `https://dev.mysql.com/doc/refman/8.0/en/<page>.html` | 手册的节号 | `15.7.2.3` |
| `source-code` | `https://github.com/mysql/mysql-server/blob/8.0/storage/innobase/<file>` | `类#方法` 或 `函数名` | `trx_undo_report_row_operation` |

统一钉 MySQL **8.0** 手册（`appliesTo` 相应写 `MySQL 8.0+`）。
禁止：中文博客、Stack Overflow、掘金/CSDN/知乎 —— `SourceKind` 枚举已经挡住它们，
但 `url` 字段不挡，别把博客链接填进 `official-doc`。
```

**b) KP1-KP6 的判据在 spec 里，计划没抄过来。** 执行者要么翻 spec §9.3，要么凭感觉。既然这是全计划唯一一次真正应用这六条的地方，应当把六条判据**原文抄进 Step 3**（一共不到 20 行），并在校准笔记模板里为每一条留一栏"这条判据好不好用"。

**c) `judgment` 型这张卡按现在的 schema 写不出来。** spec §9.1 自己说：

> 因果链和权衡型最难验证（"为什么不用跳表"在 MySQL 手册里根本没这一段，**是推理出来的**）

而计划推荐的 `judgment` 题面正是 **"RR 隔离级别下 MVCC 能完全避免幻读吗？"**——这是一个推理结论，MySQL 手册里没有哪一节说"MVCC 不能完全避免幻读"。但 `source` 是 `KeyPoint` 的**必填**字段，`kind` 只能取 `official-doc | source-code | rfc | jsr | spec`。执行者在第 4 张卡上只有两条路：编一个牵强的 locator，或者卡住。

**这是 schema 与 spec §9.1 的一个真实冲突，Task 15 是它第一次暴露的地方，而计划没有为它准备任何东西。** 三个选项，需要你拍板：

1. `SourceKind` 加一档 `derived`（推理得出），并要求 `locator` 写"从哪条一手事实推出来的"。代价是开了一个会被滥用的口子，要配一条审计规则（比如每卡 `derived` 不得超过 1 条）。
2. 保持 schema 不变，接受"`judgment` 型的要点必须能落到一手资料"这条硬约束，并**把它写进计划**——意味着某些真实高频的权衡题进不了题库，§4.3 的 `judgment ~12%` 配额可能达不到。
3. 换一道 `judgment` 题面，挑一个手册里有明确表述的（比如"RR 下的当前读会不会加间隙锁"）。**这是成本最低的**，但它只是把问题推迟到批量生产时。

我的建议是 **1**，并在 Task 15 的校准笔记里记录"五种题型中有几条要点找不到一手资料"——这个数字比工时更能决定 §4.3 配额能不能达成。

### X2 · 有 Step 藏了不止一个动作

| Task/Step | 问题 |
|---|---|
| Task 5 Step 3 | 标题是"创建共享 YAML 引擎"，正文末尾夹了一句"把 `js-yaml` 加进 dependencies……然后 `pnpm install`"。装依赖应当是独立 Step（第 1 轮已经证明 `pnpm install` 会因 build script 审批中断） |
| Task 13 Step 4 | 一个 Step 写完 76 行 CLI（读盘 + 预筛 + readline 循环 + 写回），没有验证 |
| Task 14 Step 1 | 一个 Step 写完 65 行 audit-cli（walk + 两种解析 + 审计 + lockfile 读写 + 退出码） |
| Task 15 Step 3 | 见 X1 |

### X3 · 有没有 Task 该拆

**Task 15 应当拆成两个。** 它现在同时承担三件互相独立的事：schema 的表达力验证（技术）、工时校准（数据采集）、真实内容产出（内容）。前两件是本计划的产出，第三件是内容轨的第一天工作。建议拆成：

- **Task 15a 工具链端到端验证**：用脚手架生成 5 张卡，只填到"能跑通 `content:new` → 填 → `content:audit` → `review:pairs --confirm` 一个完整回路"，产出是"工具链能用"的证据 + 一份对照 §9.3 KP1-KP6 的可操作性笔记。
- **Task 15b 单块试点与工时校准**：真实内容 + 计时 + 校准笔记。这一条的验收人应当是内容作者本人，不是执行计划的工程师。

**Task 6/7/12 应当合并或按第 1 轮的修正 B 重构。** 三个 Task 往同一个函数里插代码，每次都打翻前面的测试（E1、E2 都是这个结构的后果）。

---

## 4. 这个计划的"完成"是否可验证

现在的完成标准：

```
- [ ] pnpm test 全绿
- [ ] pnpm typecheck 无错误
- [ ] pnpm content:audit 通过
- [ ] 五种 cardType 各有一张真实内容的卡通过全部校验
- [ ] 校准笔记里有实测工时，且与 §9.1 的 145-220 小时估算做过对照
```

**照这五条逐条打勾之后，不能说"内容生产可以开工了"。** 三个理由：

### V1 · 第 1 条现在就达不到

实测基线 `3 failed | 75 passed`（E2）。这条在修掉 E1/E2 之前是假的。

### V2 · 第 3 条可以被"零内容"满足 —— 严重

我照 Task 15 的最终目录状态做了实验：`block.yml` + 5 张**一个字都没填**的脚手架卡。

```
$ npx tsx tools/audit-cli.ts
解析 5 张卡文件、1 个块
内容审计通过
exit=0
```

卡长这样：

```yaml
question: 待填写题面（面试官口吻的问法，不是教科书标题）
appliesTo: 待填写版本范围
keyPoints:
  - id: kp-kaf9ab-1
    text: 待填写要点 1
    source:
      kind: official-doc
      url: https://example.org/REPLACE-ME
      locator: REPLACE-ME
```

更糟的是，Task 9 Step 1 有一条测试**把这件事钉成了规格**：

```ts
test('生成的骨架能被 parseCard 解析（enumeration）', () => { ... expect(r.ok).toBe(true) })
```

于是"未填写的脚手架是合法内容"从一个疏漏变成了一条被测试保护的性质。在一个要持续 4-9 个月、1345 张卡的产线上，误提交一张没填完的卡是必然事件，而现在**没有任何机制能发现它**。

**修正**：加一条占位符审计（放进 `audit.ts`，Task 9 之后任意位置）：

```ts
/** 脚手架占位符。提交进 main 的卡里出现它们，说明有人漏填了 */
const PLACEHOLDERS = ['待填写', 'REPLACE-ME', 'example.org/REPLACE-ME'] as const

export function checkPlaceholders(cards: Card[]): string[] {
  const errors: string[] = []
  for (const c of cards) {
    const fields: Array<[string, string]> = [
      ['question', c.question], ['appliesTo', c.appliesTo], ['detail', c.detail],
      ...c.followUps.map((f, i) => [`followUps[${i}]`, f] as [string, string]),
      ...c.keyPoints.flatMap(kp => [
        [`要点 ${kp.id}.text`, kp.text],
        [`要点 ${kp.id}.source.url`, kp.source.url],
        [`要点 ${kp.id}.source.locator`, kp.source.locator],
      ] as Array<[string, string]>),
    ]
    for (const [name, value] of fields) {
      for (const ph of PLACEHOLDERS) {
        if (value.includes(ph)) {
          errors.push(`卡 ${c.id} 的 ${name} 仍是脚手架占位符「${ph}」—— 这张卡没填完`)
        }
      }
    }
  }
  return errors
}
```

并把 Task 9 Step 1 那条测试的语义**反过来**：

```ts
test('脚手架产物结构合法，但被占位符审计拦住 —— 未填完的卡不得进库', () => {
  const src = renderTemplate({ id: '01J8ZKQ7Y0000000000000000A', blockId: 'mysql/mvcc', cardType: 'enumeration', today: '2026-09-18' })
  const r = parseCard(src, 'x.md')
  expect(r.ok).toBe(true)            // 结构合法，作者才能在编辑器里边填边跑校验
  if (!r.ok) return
  expect(checkPlaceholders([r.card]).length).toBeGreaterThan(0)   // 但进不了库
})
```

这同时解决第 1 轮 S3 尾部提的"Task 9 Step 6 的占位卡没人删"——现在它会被审计拦下，执行者不得不处理它。

### V3 · 三件应当验证而完成标准里没有的事

**a) CI 从来没有真正跑过。** `.github/workflows/content.yml` 在 Task 14 Step 3 创建，之后没有任何步骤验证它能通过。考虑到 E4（lockfile 缺失），它开箱就是红的。完成标准应加：

```
- [ ] `.github/workflows/content.yml` 在一个真实 PR 上跑绿过一次
```

**b) 跨提交 id 守卫从来没有被证明能拦人。** 这是保护 25-60 小时人工成果的唯一机制，计划里只有单元测试，没有端到端演示。完成标准应加：

```
- [ ] 手工验证守卫真的会拦：删掉试点块里任意一张卡，跑
      `git stash && pnpm content:audit --write-lock && git stash pop && pnpm content:audit`，
      确认报"卡 id … 相对上一次 main 消失了"并退出 1；再给那张卡加 `retiredAt` 重跑，确认放行
```

**c) 互斥确认回路从来没有被走完一次。** `--confirm` 这条路径（readline 交互 + 写回 + 重跑跳过）在计划里一次都没执行过。完成标准应加：

```
- [ ] 跑 `pnpm review:pairs mysql/mvcc-undo --confirm`，至少答 1 个 y、1 个 n、1 个 q，
      然后重跑确认已答的三类都不再出现（y/n 不再问、q 之后的继续问）
```

### V4 · 预筛命中率这个产出仍然填不出来

Task 15 Step 6 的校准笔记模板要求填"命中率：__ %（设计文档假设 5-10%）"。实测占位打分器（中文字符集重合度）在试点块上的输出是 **100.0%**（52/52），不是 5-10%。第 1 轮提过（N8），计划没有采纳任何一种处理。现在这一栏是一个**一定填不出来的空**，而它是 Task 15 列的主要产出之一。

**修正**：模板那一行改成

```markdown
- 命中率：**本次不可测**。CLI 里是占位打分器（中文字符重合度），实测在本块上标出 100%，
  与语义相关性无关。设计文档假设的 5-10% 要等接入真实 LLM 打分后才能校准。
  本次记录的是**组合总数**与**单组人工确认耗时**，这两个数字与打分器无关，可外推到全库 12 万组。
```

---

## 修正清单（按执行顺序）

| # | 严重度 | Task | 改什么 |
|---|---|---|---|
| 1 | 致命 | 7 / 12 | 把 `status` 门控从 Task 7 挪到 Task 12（E1） |
| 2 | 致命 | 6 | 夹具改块内 id 互异 + 补 filler 卡（E2）；或按第 1 轮修正 B 拆 `auditLibrary` |
| 3 | 严重 | 8 / 11 | 补两处缺失的代码围栏（E3） |
| 4 | 严重 | 1 / 5 | `git add` 补 `pnpm-lock.yaml`；加 `.gitignore`（E4） |
| 5 | 严重 | 11 | 夹具换成三条要点 + 两条定位测试（T1） |
| 6 | 严重 | 3 / 5 | 补 `.strict()` 与 `detail` 的测试（T3） |
| 7 | 严重 | 13 | `cli.ts` 解析失败必须中止而非跳过（E5） |
| 8 | 严重 | 7 / 12 | 补 `blocks` 参数的四条测试（T8-a、T8-b） |
| 9 | 严重 | 9 / 新增 | 占位符审计 `checkPlaceholders` + 反转 Task 9 的那条测试（V2） |
| 10 | 严重 | 7 | `MIN_BLOCK_POOL` 按 `cardType` 分派，或降为 warning（E7）—— **需要你拍板** |
| 11 | 严重 | 15 | Step 3 补 `source` 规范表 + KP1-KP6 原文；`judgment` 的 source 冲突三选一（X1）—— **需要你拍板** |
| 12 | 严重 | 6 / 7 | 补组合场景测试，断言错误条数（T2） |
| 13 | 严重 | 8 | 补跨块作用域测试（T4）；`KeyPoint` 的 `movedFrom` 缺口 —— **需要你拍板** |
| 14 | 严重 | 10 | 断言 `keyPointText` / `targetQuestion`（T5） |
| 15 | 严重 | 5 | 失败路径断言报错内容与非空（T6） |
| 16 | 一般 | 4/7/12/13 | T7 表里的 9 条弱断言 |
| 17 | 一般 | 新增 | `exclude` / `independent` 矛盾检查（T8-c） |
| 18 | 一般 | 13 | 补 CLI 手动验证 Step（T8-d）；`s` 跳过不留痕（T8-e） |
| 19 | 一般 | 全文 | 「B5」改成 §9.3 的真实引用（E8） |
| 20 | 一般 | 6 / 4 / 表 | Expected 改 8；文件结构表补 `yaml.ts` 等（E9） |
| 21 | 一般 | 14 / 15 | 审计转绿原因写反（E6） |
| 22 | 一般 | 15 | 拆成 15a 工具链验证 / 15b 内容试点（X3） |
| 23 | 一般 | 完成标准 | 补 CI 跑绿、id 守卫端到端、互斥回路三条（V3）；命中率一栏改成不可测（V4） |

---

## 沙箱

变异测试工程在 `/tmp/plan-review-2`（计划最终状态原样 + 78 条测试）。

```
/tmp/plan-review-2          计划代码原样
/tmp/mutate.sh              变异体运行器
/tmp/m1.sh … /tmp/m15.sh    15 个变异体，可逐个复现
```

复现单个变异体：`/tmp/mutate.sh "M2" "tests/tools/review-register.test.ts" /tmp/m2.sh`
