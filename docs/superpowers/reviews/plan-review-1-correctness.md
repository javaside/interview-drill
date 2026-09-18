# 计划评审 1 · 代码正确性与可执行性

**被评审对象：** `docs/superpowers/plans/2026-09-18-content-toolchain.md`
**核对基准：** `docs/superpowers/specs/2026-09-15-interview-drill-design.md`
**视角：** 一个零上下文、照着计划逐步敲代码的工程师

---

## 我实际跑到了哪一步

**我把计划里 15 个 Task 的全部代码逐字敲进了 `/tmp/plan-review-1`，装依赖、跑测试、跑 typecheck、跑两个 CLI。** 下面每一条"失败表现"都是实测输出，不是阅读推断。

| 项 | 版本 |
|---|---|
| Node | v22.20.0 |
| pnpm | 11.7.0 |
| 实际装到的依赖 | gray-matter 4.0.3（内含 js-yaml 3.15.2）、zod 3.23.8、vitest 2.0.0、typescript 5.5.2、tsx 4.23.13、ulid 2.4.0 |
| 平台 | darwin 25.5.0 |

**结论先说：照计划原样敲完，跑不起来。** 需要 7 处修改才能走到"全绿"：

```
最终状态（修了 7 处之后）：
  Test Files  12 passed (12)
       Tests  66 passed (66)
  tsc --noEmit  OK
  pnpm content:audit  内容审计通过
```

修之前，按计划自己写的 Expected 逐个对：

| Task | 计划写的 Expected | 实测 |
|---|---|---|
| 1 Step 6 | `1 passed` | ❌ `pnpm install` 直接失败 |
| 4 Step 4 | `17 passed` | ⚠️ `18 passed` |
| 5 Step 4 | `4 passed` | ❌ `2 failed \| 2 passed` |
| 6 Step 4 | `7 passed` | ❌ `2 failed \| 5 passed` |
| 7 Step 5 | `全部 passed` | ❌ `3 failed \| 37 passed` |
| 11 Step 4 | `5 passed` | ❌ `3 failed \| 2 passed` |
| 14 Step 4 | `内容审计通过` | ❌ exit 1 |
| 15 Step 4 | `内容审计通过` | ❌ 13 个错误 |
| 15 Step 5 | `≈ 80 组` | ⚠️ 52 组，且预筛标出 100% |

**顺带确认：计划里我最怀疑的几处，有一半是虚惊。** 先说清楚，免得下面的篇幅误导轻重：

- `.js` 扩展名导入在 tsx 和 vitest 下**都能解析**，`moduleResolution: bundler` 与实际行为一致 —— 无问题
- `types: ["node", "vitest/globals"]` **够了**，测试文件里不 import 直接用 `test`/`expect` 能跑、能过 typecheck —— 无问题
- `cli.ts` 的顶层 `await` 在 tsx 下**能跑**，也能过 typecheck —— 无问题
- `exactOptionalPropertyTypes` 开与不开**都能过** —— 无问题
- `pnpm content:audit --write-lock` 的参数**能正确透传**给脚本 —— 无问题

真正出事的是别的地方。

---

## 致命

### F1 · YAML 把 `verifiedAt` 解析成 `Date`，整条内容管线一张卡都过不了

**Task 5 Step 4**（并连带 Task 9 / 11 / 13 / 14 / 15 全部失效）

`gray-matter` 用 js-yaml 的默认 schema，而 YAML 1.1 的 `tag:yaml.org,2002:timestamp` 类型会把裸写的 `2026-09-18` 变成 JS `Date` 对象。`keyPointSchema` 里是 `z.string().regex(ISO_DATE)`，于是每一条要点都被拒。

实测报错原文：

```
FAIL  tests/lib/content/parse.test.ts > 解析出完整的 Card
AssertionError: expected false to be true

FAIL  tests/lib/content/parse.test.ts > 触发 KP5 承载词的要点在解析阶段就被报出
- Expected: 承载词
+ Received: content/x/y.md: keyPoints.0.verifiedAt —— Expected string, received date,
            content/x/y.md: keyPoints.1.verifiedAt —— Expected string, received date,
            content/x/y.md: keyPoints.2.verifiedAt —— Expected string, received date
```

直接验证：

```
matter(SRC).data.keyPoints[0].verifiedAt
  typeof: object | constructor: Date | value: 2026-09-18T00:00:00.000Z
```

**为什么这条是致命而不是严重**：`verifiedAt` 是 `KeyPoint` 的必填字段，每张卡的每条要点都有。`parseCard` 是 Task 9（脚手架产物校验）、Task 11（写回后仍可解析）、Task 13（CLI 读盘）、Task 14（审计 CLI）、Task 15（试点）的公共入口。**这一条不修，1345 张卡一张也进不来。** 顺带，卡级的 `retiredAt: 2026-01-01` 同样中招 —— 退役机制也一起失效。

**修正**（实测通过）。先 `pnpm add js-yaml @types/js-yaml`（不能靠 gray-matter 的传递依赖，pnpm 严格 node_modules 下拿不到），新建 `src/lib/content/yaml.ts`：

```ts
import * as yaml from 'js-yaml'

/**
 * gray-matter 的 YAML 引擎。两件事必须自己接管，默认行为会出事：
 *
 * 1. `JSON_SCHEMA` 关掉 YAML 1.1 的 timestamp 类型。默认 schema 下
 *    `verifiedAt: 2026-09-18` 会被解析成 `Date`，`z.string()` 一律拒收。
 * 2. `lineWidth: -1` 关掉折行，否则长要点会被折成多行，diff 噪音巨大。
 *
 * 另有一个副作用是必需的：只要给 `matter()` 传了 options，gray-matter 就
 * 跳过它那个按原文缓存、且跨调用共享 data 对象的缓存（见 S2）。
 */
export const YAML_ENGINES = {
  yaml: {
    parse: (str: string): object => (yaml.load(str, { schema: yaml.JSON_SCHEMA }) ?? {}) as object,
    stringify: (obj: object): string =>
      yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
  },
}

export const MATTER_OPTIONS = { engines: YAML_ENGINES }
```

然后 `parse.ts` 改一行、`register.ts` 改两行、`block.ts` 改一行，全部把 `matter(x)` 换成 `matter(x, MATTER_OPTIONS)`、`matter.stringify(a, b)` 换成 `matter.stringify(a, b, MATTER_OPTIONS)`。

改完实测：

```
✓ tests/lib/content/parse.test.ts  (4 tests) 6ms
```

> 注意不要用"让作者给日期加引号（`verifiedAt: '2026-09-18'`）"这个替代方案。它要求 1345 张卡 × 约 4.5 条要点全部手工加引号，而且没有任何机制阻止作者忘记 —— 忘记的表现是一句 `Expected string, received date`，与日期格式写错的报错无法区分。更糟的是 `matter.stringify` 写回时仍会把 Date 输出成 `2026-09-18T00:00:00.000Z`，加引号防不住往返。

---

### F2 · 脚手架铸的要点 id 与"块内唯一"直接冲突，第二张卡就挂

**Task 9 Step 3 的 `template.ts` ↔ Task 6 Step 3 的 `auditLibrary`**

`keyPointBlock()` 永远生成 `kp-1 / kp-2 / kp-3 …`，而 `auditLibrary` 要求要点 id **块内唯一**（这是对的，spec §7 明写"`KeyPoint.id` 块内唯一"）。于是同一个块里只要有第二张卡，审计立刻报错。

实测 —— 就是 Task 15 的试点场景，一个块五张卡：

```
$ pnpm content:audit
解析 6 张卡文件、1 个块
发现 13 个问题：
  - 要点 id 在块 mysql/mvcc-undo 内重复：kp-1（卡 01M2SHHD1A6KFJCJT9QQKAF9WW）
  - 要点 id 在块 mysql/mvcc-undo 内重复：kp-2（卡 01M2SHHD1A6KFJCJT9QQKAF9WW）
  - 要点 id 在块 mysql/mvcc-undo 内重复：kp-3（卡 01M2SHHD1A6KFJCJT9QQKAF9WW）
  ...（共 13 条）
[ELIFECYCLE] Command failed with exit code 1.
```

**这条比看上去严重。** 一个照着计划干活的内容作者，撞上这个报错后最自然的修法是手工改成 `kp-4 / kp-5 / kp-6` —— 而那正好重演 spec §7 点名禁止的东西：*"序号派生 id 会让'在 001 和 002 之间插一道题'触发全部重编号，`card_state` 全对不上，用户复习进度静默归零"*。计划花了整个 Task 9 论证"id 由脚手架生成，不由人写"，然后让脚手架生成了一批注定撞车、必须人手改的 id。

**修正**（实测通过）：让要点 id 从卡的 ULID 派生。`tools/content-new/template.ts`：

```ts
function keyPointBlock(prefix: string, i: number, today: string, withOrder: boolean): string {
  const orderLine = withOrder ? `\n    order: ${i}` : ''
  return `  - id: ${prefix}-${i}
    text: 待填写要点 ${i}
    public: ${i === 1}
    verifiedAt: ${today}
    excludeAsDistractorFor: []${orderLine}
    source:
      kind: official-doc
      url: https://example.org/REPLACE-ME
      locator: REPLACE-ME`
}

export function renderTemplate(input: TemplateInput): string {
  const { id, blockId, cardType, today } = input
  const n = MIN_KEY_POINTS[cardType]
  const withOrder = cardType === 'sequence'
  // 要点 id 必须块内唯一（§7）。从卡的 ULID 尾 6 位派生，
  // 既保证唯一又不是序号 —— 插一道题不会触发任何重编号。
  const prefix = `kp-${id.slice(-6).toLowerCase()}`
  const kps = Array.from({ length: n }, (_, i) => keyPointBlock(prefix, i + 1, today, withOrder)).join('\n')
  // ...（return 部分不变）
}
```

改完实测（同一个五张卡的块）：

```
$ pnpm content:audit
解析 5 张卡文件、1 个块
内容审计通过
```

计划里 Task 9 的四条测试不受影响，仍然全过（它们只断言条数和 `order`，没断言 id 形状）。

---

### F3 · Task 6 的测试夹具和它自己的实现互相矛盾

**Task 6 Step 4，以及 Task 7 Step 5**

`K3 = () => [kp('kp-1'), kp('kp-2'), kp('kp-3')]`，然后 `card('c1','b1',K3())` 和 `card('c2','b1',K3())` —— 同一个块 `b1`，两张卡都用 `kp-1/kp-2/kp-3`。这恰好触发同一个 Step 里刚写的块内唯一性检查。

实测：

```
❯ tests/lib/content/audit-identity.test.ts  (7 tests | 2 failed)
   × 干净的库通过审计
     → expected [ '要点 id 在块 b1 内重复：kp-1（卡 c2）', …(2) ] to deeply equal []
   × 退役卡不参与外键存在性检查的目标集，但自身仍被解析
     → expected [ '要点 id 在块 b1 内重复：kp-1（卡 c1）', …(2) ] to deeply equal []
```

**Task 7 让情况更糟**：加了池容量检查之后，原本还能过的 `要点 id 跨块重复是允许的` 也挂了（`b1` 和 `b2` 各只有一张卡，池 = 0 < 6）。Task 7 Step 5 写的 "Expected: 全部 passed"，实测：

```
 Test Files  1 failed | 4 passed (5)
      Tests  3 failed | 37 passed (40)
```

**这是任务顺序问题，不只是夹具问题**：Task 7 往 `auditLibrary` 里加了一条新规则，就让 Task 6 写的三条测试失效。后面 Task 12 又往同一个函数里加第三条规则。每加一条，前面所有"断言 `errors` 为空"的测试都要重新配夹具。

**修正 A（最小改动，实测通过）** —— 夹具补全：

```ts
const K3 = (p: string) => [kp(`${p}-1`), kp(`${p}-2`), kp(`${p}-3`)]
// 每块至少 3 张卡，任一张卡的同块池才有 6 条
const filler = (blockId: string) => [
  card('f1-' + blockId, blockId, K3('f1' + blockId)),
  card('f2-' + blockId, blockId, K3('f2' + blockId)),
]

test('干净的库通过审计', () => {
  const r = auditLibrary([card('c1', 'b1', K3('a')), card('c2', 'b1', K3('b')), ...filler('b1')])
  expect(r.errors).toEqual([])
})

test('要点 id 跨块重复是允许的', () => {
  const a = card('c1', 'b1', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  const b = card('c2', 'b2', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([a, b, ...filler('b1'), ...filler('b2')]).errors).toEqual([])
})

test('excludeAsDistractorFor 指向不存在的卡被发现', () => {
  const c = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['ghost'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([c, ...filler('b1')]).errors.join()).toContain('ghost')
})

test('退役卡仍可作为 excludeAsDistractorFor 的目标', () => {   // 名字也一并改掉，见 N5
  const dead = card('c-dead', 'b1', K3('d'), { retiredAt: '2026-01-01' })
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['c-dead'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([dead, live, ...filler('b1')]).errors).toEqual([])
})
```

**修正 B（推荐，结构上根治）** —— 把 `auditLibrary` 拆成三个独立导出的检查，`auditLibrary` 只做组合：

```ts
export function checkIdentity(cards: Card[]): string[] { /* 卡 id 唯一 + 要点块内唯一 */ }
export function checkForeignKeys(cards: Card[]): string[] { /* relatedBlocks + excludeAsDistractorFor */ }
export function checkDistractorPools(cards: Card[]): string[] { /* 池容量 */ }
export function checkBlockBinding(cards: Card[], blocks: Block[]): string[] { /* Task 12 那段 */ }

export function auditLibrary(cards: Card[], blocks: Block[] = []): AuditResult {
  return {
    errors: [
      ...checkIdentity(cards),
      ...checkForeignKeys(cards),
      ...checkDistractorPools(cards),
      ...(blocks.length > 0 ? checkBlockBinding(cards, blocks) : []),
    ],
    warnings: [],
  }
}
```

这样 Task 6 的测试调 `checkIdentity`，Task 7 调 `checkDistractorPools`，Task 12 调 `checkBlockBinding`，**后加的规则不会再把前面的测试打翻**。也顺带消掉 Task 7 Step 4 和 Task 12 Step 4 那两条"在 return 之前插入"的指令歧义（见 N14）。

---

## 严重

### S1 · Task 11 声称的"diff 稳定"是假的，且 3/5 测试挂掉

**Task 11 Step 3 / Step 4**

`matter.stringify(fm.content, data)` 会把整块 frontmatter 用 js-yaml 重新 dump 一遍。**没被工具碰过的字段也会被改写。**

实测往返 —— 输入 `verifiedAt: 2026-09-18` 和 `url: https://example.org/a`，只登记了一条 `excludeAsDistractorFor`：

```
  verifiedAt: 2026-09-18T00:00:00.000Z        ← 日期被换成 ISO 全格式
  excludeAsDistractorFor:
      - c2
  source:
      kind: official-doc
      url: 'https://example.org/a'            ← 平白加上引号
      locator: x
```

对应的测试失败：

```
❯ tests/tools/review-register.test.ts  (5 tests | 3 failed)
   × 写回后源文件仍可解析，且登记生效
   × 重复登记不产生重复项
   × 登记目标按字典序保持稳定，便于 diff 审查
```

注意第三条测试的**名字和它的断言不是一回事**：它叫"登记目标按字典序保持稳定，便于 diff 审查"，但断言的是 `parseCard` 之后数组元素有序 —— 它**从来没有检查过 diff**。计划正文那句"目标列表排序后写回，保证 diff 稳定"因此没有任何测试保护，而实测它是错的。

后果放到真实规模上看：25-60 小时的人工互斥登记，每登记一条就会把那张卡的**所有**日期和 URL 重写一遍。PR diff 里真正要人看的是"多了一行 `- c2`"，实际看到的是整个 frontmatter 变红变绿。计划自己写的理由——"diff 噪音会让 review 变得不可读"——正是它自己造成的结果。

**修正**：F1 的 `MATTER_OPTIONS` 一并解决（`JSON_SCHEMA` 让日期保持字符串，`lineWidth: -1` 阻止长要点被折行）：

```ts
import matter from 'gray-matter'
import { MATTER_OPTIONS } from '../../src/lib/content/yaml.js'

export function registerExclusion(raw: string, keyPointId: string, targetCardId: string): string {
  const fm = matter(raw, MATTER_OPTIONS)
  // ...（中间不变）
  return matter.stringify(fm.content, data, MATTER_OPTIONS)
}
```

实测改完的往返输出，逐字节保持原样、且**幂等**（第二次写回与第一次一致）：

```
  verifiedAt: 2026-09-18
  excludeAsDistractorFor:
      - c2
  source:
      kind: official-doc
      url: https://example.org/a
      locator: x

idempotent? true
✓ tests/tools/review-register.test.ts  (5 tests) 9ms
```

**另外建议补一条真正测 diff 的测试**，把计划的口头承诺钉死：

```ts
test('只登记一条时，除目标列表外整个文件逐字节不变', () => {
  const out = registerExclusion(SRC, 'kp-1', 'c2')
  const changed = out.split('\n').filter(l => !SRC.split('\n').includes(l))
  expect(changed).toEqual(['    excludeAsDistractorFor:', '      - c2'])
})
```

---

### S2 · `registerExclusion` 被注释成"纯函数"，但它不是

**Task 11 Step 3**

`matter(input)` **不传 options 时会走 gray-matter 的内部缓存**，缓存按原文字符串索引，命中时只做 `Object.assign({}, cached)` 这一层浅拷贝 —— `data` 是**同一个对象引用**。而 `registerExclusion` 恰恰是原地改写 `kp.excludeAsDistractorFor`。

实测：

```
a = matter(SRC);  b = matter(SRC)
a.data === b.data ?  true
mutate a 之后 b 看到: ["MUTATED"]
```

用计划里那份 `register.ts` 原样跑，同一个输入字符串调两次：

```
第 1 次 registerExclusion(SRC, 'kp-1', 'c2')
    excludeAsDistractorFor:
      - c2

第 2 次 registerExclusion(SRC, 'kp-1', 'c9')  ← 同一个输入，应当只含 c9
    excludeAsDistractorFor:
      - c2        ← 上一次的结果漏进来了
      - c9

结论：第 2 次的结果里混进了第 1 次的 c2 ?  true
```

函数签名是"字符串进、字符串出"，注释写"纯函数：字符串进、字符串出，不碰文件系统"，**但它对同一输入返回不同输出**。计划把这个函数做成纯函数的全部理由（可单测、不碰 fs）因此落空 —— 测试之间会串味，跑测试的顺序会影响结果。

**修正**：同样由 F1 的 `MATTER_OPTIONS` 解决 —— 只要传了 options，gray-matter 就跳过缓存。实测确认：

```
传 options 后: a.data === b.data ?  false
```

---

### S3 · Task 14 Step 4 必然失败

**Task 14 Step 4**

Step 4 写 "Run: `pnpm content:audit` / Expected: `内容审计通过`"。但走到 Task 14 时，`content/` 里唯一的东西是 Task 9 Step 6 手工验证脚手架时生成、并在 Step 7 提交进去的**那一张占位卡**。一个块里只有一张卡，池容量必然是 0。

实测：

```
$ pnpm content:audit
解析 1 张卡文件、0 个块

发现 1 个问题：
  - 块 mysql/mvcc-undo 卡 01M2SHH1QY9M4E932T266EKKWE 的同块干扰项池不足：可用 0 条，下界 6
[ELIFECYCLE] Command failed with exit code 1.
```

**修正**：把 Task 14 Step 4 的 Expected 改成实话，并说明这是预期的：

```
- [ ] **Step 4: 本地验证审计能跑通、且确实会拦住不合格内容**

Run: `pnpm content:audit`
Expected: exit 1，报 `同块干扰项池不足：可用 0 条，下界 6`。

这是**正确行为**：此刻 content/ 里只有 Task 9 Step 6 留下的一张占位卡，
撑不起干扰项池。真正的"审计通过"要等 Task 15 的试点把块填到 5 张卡。
```

顺带：Task 9 Step 6 那张占位卡（`待填写要点`、`url: https://example.org/REPLACE-ME`）**计划从头到尾没说要删**，Task 9 Step 7 的 `git add content` 会把它提交，Task 15 Step 7 会再提交一次。试点块最后是 6 张卡，其中一张是全是占位符的垃圾。Task 9 Step 6 后面应该加一句 `rm -rf content/mysql/mvcc-undo`。

---

### S4 · CI 的跨提交 id 守卫 fail-open —— 任何异常都让它静默变成空操作

**Task 14 Step 3**

```yaml
- name: 用 main 的 lockfile 做跨提交 id 守卫
  run: |
    git show origin/main:content/.ids.lock > content/.ids.lock 2>/dev/null || true
    pnpm content:audit
```

shell 的重定向**在命令执行之前**就把目标文件截断了。于是 `git show` 一旦失败（`origin/main` 拿不到、路径首次引入时该文件在 main 上还不存在、仓库改名…），`content/.ids.lock` 就变成**空文件**，`|| true` 再把非零退出码吞掉。`audit-cli.ts` 随后读到空的 id 集合，`checkIdLock(cards, [])` 一条都不检查，CI 照常绿。

实测（`origin/main` 不存在的情形）：

```
=== lockfile 原始内容 ===
id-A
id-B

=== 跑完计划里那行之后（字节数 0）===
<<< EOF
```

**这条守卫是 spec §7 给那 25-60 小时人工互斥登记安排的唯一保护机制**，而它的失败模式是静默放行。

**修正**：

```yaml
- name: 用 main 的 lockfile 做跨提交 id 守卫
  run: |
    set -euo pipefail
    # 先写临时文件，确认非空再覆盖 —— 重定向会在 git show 执行前就截断目标，
    # 直接写 content/.ids.lock 会让任何失败都退化成"空锁 = 不检查"。
    git show origin/main:content/.ids.lock > /tmp/main.ids.lock
    test -s /tmp/main.ids.lock
    mv /tmp/main.ids.lock content/.ids.lock
    pnpm content:audit
```

**另有一个配套缺口**：计划只在 Task 14 Step 2 和 Task 15 Step 7 手工跑过两次 `--write-lock`，此后 `.ids.lock` **没有任何机制保持更新**。新加的卡进不了锁文件，也就永远不受守卫保护。建议在 CI 里加一条 PR 侧的一致性检查：

```yaml
- name: lockfile 必须与本 PR 的内容一致
  run: |
    pnpm content:audit --write-lock
    git diff --exit-code content/.ids.lock \
      || { echo "content/.ids.lock 过期，请跑 pnpm content:audit --write-lock 并提交"; exit 1; }
```

---

### S5 · lockfile 只锁卡 id，不锁要点 id

**Task 14 Step 1 / Task 8**

```ts
writeFileSync(LOCK_FILE, cards.map(c => c.id).sort().join('\n') + '\n', 'utf8')
```

只有 `cardId`。但 spec §8.1 明写 `review_log.distractorIds` 存的是"**本次抽中的干扰项要点 id**"，spec §4.2 也写 `KeyPoint.id` 是"互斥登记、漏点统计、干扰项引用都指向它"。**要点 id 改名 / 删除，`review_log.distractorIds` 一样变悬空，而守卫看不见。**

spec §7 的原话是"上一次 `main` 的**全量 id 集合**"，计划只实现了其中一半。

**修正**：lockfile 存两类 id，加前缀区分：

```ts
// tools/audit-cli.ts
if (process.argv.includes('--write-lock')) {
  const ids = [
    ...cards.map(c => `card:${c.id}`),
    ...cards.flatMap(c => c.keyPoints.map(kp => `kp:${c.blockId}/${kp.id}`)),
  ].sort()
  writeFileSync(LOCK_FILE, ids.join('\n') + '\n', 'utf8')
  console.log(`已写入 ${LOCK_FILE}（${ids.length} 个 id）`)
}
```

`checkIdLock` 相应改成接收带前缀的集合，要点 id 按 `blockId/kpId` 比对（因为要点 id 只保证块内唯一）。要点级的"改名放行"可以沿用卡级 `movedFrom` 的思路，在 `KeyPoint` 上加 `movedFrom?: string`。

---

### S6 · `MIN_BLOCK_POOL = 6` 的推导方向算反了，注释里的"余量"不存在

**Task 7 Step 3**

计划的注释：

> 选项总数固定 9，最多 6 条正确要点时需要 3 条干扰项，分层规则下同块层最多要 3 条；留一倍余量防止连续抽到重复，取 6。

两处都取了**最好情况**，该取最坏情况：

1. 干扰项数 = `9 − 正确要点数`。正确要点最少是 3 条（spec §8.3 的 `enumeration`/`comparison` 下界），所以干扰项**最多 6 条**，不是 3 条。
2. spec §4.3 的分层比例表里，`s = 1` 那一档是 **3 : 0** —— 掌握度满时干扰项**全部从同块抽**。所以"同块层最多要 3 条"是错的，最多要 6 条。

即：单次出题在最坏情况下就要吃掉 6 条同块要点，而 spec §4.3 同时规定"**绝不允许少给干扰项**——那会让选项总数变化，直接泄露正确条数"、"也不允许重复抽同一条"。`MIN_BLOCK_POOL = 6` 是**刚好够一次**，余量为零；再叠上 §4.3 要求的"每次出现重抽"和服务端预生成 K 份 variants，6 条池必然反复抽到同一批。

这条的后果不在内容阶段暴露，在出题引擎上线后暴露成"选项总数不是 9"，而那正是 spec 花了一整段论证必须堵死的泄露。

**修正**：

```ts
/**
 * 同块可用干扰项池下界。
 *
 * 最坏情况：3 条正确要点 → 需要 9 − 3 = 6 条干扰项；而 §4.3 的分层比例表
 * 在 s = 1 时是 3 : 0，即干扰项全部来自同块。所以单次出题最多吃 6 条。
 * §4.3 同时要求"绝不允许少给干扰项"且"不允许重复抽同一条"，再叠上
 * "每次出现重抽" + 服务端预生成 K 份 variants，6 条池会立刻重复。
 * 取 3 倍余量。
 */
export const MIN_BLOCK_POOL = 18
```

**18 是有代价的**：spec §4.3 假设"一个块约 20 题 × 4.5 要点 = 90 条要点池"，18 对应块内约 5 张卡，绝大多数块能满足。但 Task 15 的五卡试点会**刚好卡在边界**（5 张卡，13 条要点，任一张卡的可用池是 9-12 条）。这本身是有价值的发现，应当写进校准笔记——如果试点块撑不起池下界，说明"每块 15-25 题"的配额是硬约束而不是建议。**这个取值需要和出题引擎计划一起定**，我的建议是先按 18 落地并在 Task 15 记录实测，而不是留着一个推导错误的 6。

---

### S7 · 计划完全没覆盖 §4.3 的题型配额，也没把它列进"明确不覆盖"

spec §4.3 的原话：

> **目标占比必须是配额，不是倡议。** §2 的配额表需按大类再声明各题型的目标条数，审核时按型收题——**这是唯一能对抗上面那三条漂移力的机制**。

计划的 Task 3 把这三条漂移力当成自己存在的理由（"统一 3 条会自动挡掉 17.5% 的真实高频题…这是把题库推向列举题的三条漂移力里最硬的一条"），**然后只修了第一条**（CI 硬拒），把 spec 明说是"唯一能对抗"的那个机制漏掉了，而且末尾"本计划明确不覆盖"的表里也没有它。

按 spec 的预估，不做配额的收敛结果是 **70-85% 列举题**，对上真实世界的 33.6%。这不是运行时才发现的问题——**它要在 1345 题写完之后才看得出来，那时已经无法补救**。配额检查恰恰是内容工具链最该管的事：它是纯函数、数据齐备（`Card.cardType` + `Block.category`）、跑一次全库就出结果。

**修正**：加一个 Task，或至少在 `audit.ts` 里加 warning 级检查：

```ts
/** §4.3 的题型目标占比。上界是硬配额，下界是告警线。 */
export const CARD_TYPE_QUOTA: Record<CardType, { max: number; min: number }> = {
  enumeration: { max: 0.45, min: 0.30 },
  comparison:  { max: 0.20, min: 0.10 },
  sequence:    { max: 0.25, min: 0.15 },
  judgment:    { max: 0.18, min: 0.08 },
  atomic:      { max: 0.14, min: 0.04 },
}

/** 按大类统计题型分布。§4.3：配额不是倡议，审核时按型收题。 */
export function checkCardTypeQuota(cards: Card[], blocks: Block[]): AuditResult {
  const categoryOf = new Map(blocks.map(b => [b.id, b.category]))
  const byCategory = new Map<string, Card[]>()
  for (const c of cards) {
    if (c.retiredAt) continue
    const cat = categoryOf.get(c.blockId)
    if (!cat) continue
    const list = byCategory.get(cat)
    if (list) list.push(c)
    else byCategory.set(cat, [c])
  }

  const errors: string[] = []
  const warnings: string[] = []
  for (const [cat, list] of byCategory) {
    // 大类没写够 30 题时占比噪音太大，不判
    if (list.length < 30) continue
    for (const [type, { max, min }] of Object.entries(CARD_TYPE_QUOTA)) {
      const share = list.filter(c => c.cardType === type).length / list.length
      if (share > max) {
        errors.push(
          `大类 ${cat} 的 ${type} 型占 ${(share * 100).toFixed(1)}%，超过配额上界 ${(max * 100).toFixed(0)}%。` +
          `§4.3：配额是对抗题型漂移的唯一机制，超了要换题型补，不是调配额。`,
        )
      } else if (share < min) {
        warnings.push(`大类 ${cat} 的 ${type} 型只占 ${(share * 100).toFixed(1)}%，低于目标下界 ${(min * 100).toFixed(0)}%`)
      }
    }
  }
  return { errors, warnings }
}
```

> 上面的 min/max 是我从 spec §4.3 的"目标占比"列（≤45% / ~15% / ~20% / ~12% / ~8%）推的带宽，**具体数值需要你确认**——spec 只给了目标点值，没给容差。

---

### S8 · schema 不是 `strict()`，字段拼错会被静默丢弃

**Task 3 Step 3**

zod 的 `z.object()` 默认**剥离**未知字段。实测：

```
写成 retiredAT（大小写错）=> 通过，字段被静默丢弃
  解析结果里 retiredAt = undefined
卡级未知字段            => 通过，静默丢弃
```

必填字段拼错还能靠"缺字段"报出来，**可选字段拼错就完全没有信号**。`retiredAt` 和 `movedFrom` 恰好都是可选的，而它们俩正是 spec §7 那套 id 守卫的两个放行开关：

- `retiredAT` 拼错 → 作者以为下线了，卡继续出题给用户
- `movedFrm` 拼错 → CI 守卫拦下，但报错指向"id 消失了"，作者会去找不存在的删除操作

**修正**：`cardSchema` 和 `keyPointSchema` 都加 `.strict()`。注意 `cardSchema` 已经是 `ZodEffects`（`.superRefine` 的产物），`.strict()` 要加在 `z.object({...})` 上、`.superRefine()` 之前：

```ts
export const keyPointSchema = z.object({
  // ...
}).strict()

export const cardSchema = z
  .object({
    // ...
  })
  .strict()          // ← 未知字段直接报错。retiredAt / movedFrom 拼错必须有信号
  .superRefine((card, ctx) => { /* ... */ })
```

---

### S9 · 互斥确认只登记"是"，不登记"否" —— 每次重跑都把否决过的重问一遍

**Task 10 Step 3 + Task 13 Step 4**

`buildPairs` 的注释是"待人工确认的组合：跳过已登记的，避免重复确认"，但它跳过的判据是 `kp.excludeAsDistractorFor.includes(target.id)` —— **只有回答"是"才会写进那个数组**。回答"否"的组合没有任何地方记录。

spec §4.3 的规模：单块约 1710 组，预筛标出 5-10% 即 85-170 组进人工队列，其中真正成立的按经验只是一部分。假设 30% 答"是"，**剩下 70% 每次重跑 CLI 都会原样再问一遍**。而重跑是常态：块里加了新题要重跑、预筛阈值调了要重跑、`--confirm` 中途按 q 退出要重跑。

这条直接侵蚀计划存在的理由。计划开头写"25-60 小时的人工互斥登记"是要保护的资产，Task 13 建的工具会反复消耗它。

**修正**：加一份否决登记。最省事的做法是在要点上加一个平行字段：

```ts
// types.ts
export type KeyPoint = {
  // ...
  /** 本要点对这些题也成立，不得抽作它们的干扰项 */
  excludeAsDistractorFor: string[]
  /** 人工已确认"对这些题不成立"。仅用于避免重复确认，不参与出题 */
  confirmedIndependentOf?: string[]
}
```

`buildPairs` 同时跳过两个集合：

```ts
if (kp.excludeAsDistractorFor.includes(target.id)) continue
if (kp.confirmedIndependentOf?.includes(target.id)) continue
```

`cli.ts` 在答 `n` 时也写回（把 `registerExclusion` 泛化成 `registerDecision(raw, kpId, targetId, decision: 'exclude' | 'independent')`）。

> 代价是源文件里多一个只服务于工具流程的字段。替代方案是单独存一份 `content/.review-decisions.jsonl`，但那份文件和卡片 id 的绑定又需要自己的守卫。**两种都行，得选一个** —— 现在的计划是两个都没有。

---

## 一般

### N1 · `sequence` 的 `order` 只校验"存在"，不校验取值

实测：

```
order 全是 1      => 通过（BUG：排序题的答案全是同一个序号）
order = 5,9,2,77  => 通过（BUG：不是 1..N）
```

spec §4.3 说 sequence 是"4-6 个步骤拖动排序"、"全序正确满分，或按逆序对数量给部分分"，`types.ts` 自己的注释也写"该步骤在流程中的序号，**从 1 起**"。`order` 不是 1..N 的排列，掌握度公式 `1 − 逆序对数 / 最大逆序对数` 就没有定义。

修正，在 `superRefine` 的 sequence 分支里换成：

```ts
if (card.cardType === 'sequence') {
  const orders = card.keyPoints.map(kp => kp.order)
  card.keyPoints.forEach((kp, i) => {
    if (kp.order === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keyPoints', i, 'order'],
        message: 'sequence 型的每条要点必须有 order —— 顺序就是这型题的答案',
      })
    }
  })
  const defined = orders.filter((o): o is number => o !== undefined)
  if (defined.length === card.keyPoints.length) {
    const sorted = [...defined].sort((a, b) => a - b)
    const isPermutation = sorted.every((o, i) => o === i + 1)
    if (!isPermutation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keyPoints'],
        message: `sequence 型的 order 必须是 1..${card.keyPoints.length} 的一个排列，实际是 [${defined.join(', ')}]`
          + ' —— §4.4 的逆序对计分对非排列没有定义',
      })
    }
  }
}
```

### N2 · `public` 要点数量不校验

实测：一条 `public` 都没有、或全部 `public`，schema 都放行。spec §4.2 明写"**每题标 1-2 条**"，且 §4.3 用这批要点同时喂三件事：SEO 落地页 lead-in、免费用户的跨块干扰项池、付费转化展示面。

- 0 条 public → SEO 题目页只剩一个题面（spec §7 说落地页内容"比 JavaGuide 单薄"已是让步，0 条就没有落地页了）；免费层的跨块池同时枯竭
- 全部 public → 整题答案免费公开，付费墙失效

修正，加进 `superRefine`：

```ts
const publicCount = card.keyPoints.filter(kp => kp.public).length
if (publicCount < 1 || publicCount > 2) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['keyPoints'],
    message: `public 要点必须是 1-2 条，实际 ${publicCount} 条（§4.2）。`
      + '少了 SEO 落地页和免费层跨块干扰项池都会空，多了等于免费公开整题答案。',
  })
}
```

### N3 · frontmatter 里写了 `detail` 会被静默覆盖

`{ ...(data as object), detail: body }` 的展开顺序让 `body` 永远赢。实测 frontmatter 里写 `detail: 我在 frontmatter 里写了 detail`、正文写"正文"，结果 `detail` 是 `"\n正文"`，**没有任何提示**。加上 S8 的 `.strict()` 之后这条会自动变成显式报错（`detail` 成了未知字段…不，它在 schema 里）。所以要单独处理：

```ts
if ('detail' in (data as object)) {
  return { ok: false, issues: [`${path}: detail 只能写在正文里，不能写进 frontmatter`] }
}
const parsed = cardSchema.safeParse({ ...(data as object), detail: body })
```

### N4 · `block.ts` 的 `---` 包装 hack 的两个边界

`matter(\`---\n${raw}\n---\n\`)` 实测结果：

| 输入 | 结果 |
|---|---|
| `block.yml` 以 `---` 开头（合法的 YAML 文档起始符） | ❌ 报 `id —— Required` / `name —— Required` / `category —— Required` |
| 文件中间有一行 `---` | ⚠️ 前半段解析成功，**后面的字段静默丢弃**，不报错 |
| CRLF 换行 | ✅ 正常 |
| 真正的 YAML 语法错误 | ✅ 正确报 `YAML 解析失败 —— YAMLException: ...` |
| 空文件 | ⚠️ 报三个 `Required`，而不是"文件为空" |

第一行那个最坑：文件里三个字段一个不少，报错却说三个都缺。很多编辑器和 YAML linter 会主动加文档起始符。

**修正**：别绕 gray-matter，直接用 js-yaml（F1 已经把它加进依赖了）：

```ts
import * as yaml from 'js-yaml'

export function parseBlock(raw: string, path: string): ParseBlockResult {
  let data: unknown
  try {
    // 直接用 YAML parser。此前借 gray-matter 的 `---` 包装 hack 有两个坑：
    // 文件以 `---` 开头会被读成空 frontmatter，文件中间的 `---` 会让后面的字段静默消失。
    data = yaml.load(raw, { schema: yaml.JSON_SCHEMA })
  } catch (e) {
    return { ok: false, issues: [`${path}: YAML 解析失败 —— ${String(e)}`] }
  }
  if (data === null || data === undefined) {
    return { ok: false, issues: [`${path}: 文件为空`] }
  }
  // ...（下面的 blockSchema.safeParse 与 checkBlockName 不变）
}
```

### N5 · 两条测试名与它断言的行为不符

**Task 6** —— `test('退役卡不参与外键存在性检查的目标集，但自身仍被解析')`。名字说退役卡**不**能当外键目标，断言却是"引用退役卡不报错"（`expect(...errors).toEqual([])`）。实现里 `cardIds` 包含退役卡，所以断言与实现一致，**错的是名字**。而且名字描述的语义是错的——spec §7 的 tombstone 机制正是为了让 `review_log` 和 `excludeAsDistractorFor` 能继续指向退役卡。改名为 `退役卡仍可作为 excludeAsDistractorFor 的目标（tombstone 的意义）`。

**Task 13** —— `test('召回导向：阈值调低会保留更多，不会漏掉高分项')`。夹具里 `score = async () => 0.3`，**所有组合都是同一个分数，没有任何"高分项"**。后半句名字对应的行为一次都没被执行。要么改名成 `阈值调低会保留更多`，要么把夹具改成有高有低：

```ts
test('召回导向：阈值调低会保留更多，且高分项在任何阈值下都不漏', async () => {
  const score = async (p: Pair) => (p.keyPointId === 'k1' ? 0.9 : 0.3)
  expect((await screenPairs(pairs, score, 0.5)).map(f => f.pair.keyPointId)).toEqual(['k1'])
  expect((await screenPairs(pairs, score, 0.2)).map(f => f.pair.keyPointId)).toEqual(['k1', 'k2'])
})
```

### N6 · Task 4 Step 4 的 Expected 数字错了

写的是 `17 passed`，实际 **18**（两个 `test.each` 分别展开 7 条和 6 条，加 5 条普通用例）。实测：

```
✓ tests/lib/content/rules.test.ts  (18 tests) 3ms
```

照着做的人会以为漏了一条测试。

### N7 · Task 15 Step 5 的组合数估算错了

计划写"5 张卡 × 约 4 条要点 × 4 道其他题 ≈ 80 组"。但脚手架按 `MIN_KEY_POINTS` 生成，五种题型合计 3+3+4+2+1 = **13** 条要点，不是 20 条。实测：

```
$ pnpm review:pairs mysql/mvcc-undo
块 mysql/mvcc-undo：组合总数 52，其中未登记 52 组
```

### N8 · 占位打分器让 Task 15 的校准目标拿不到

Task 15 Step 6 的校准笔记模板要求填"命中率：__ %（设计文档假设 5-10%）"，但 `cli.ts` 里的打分器是**字符集重合度**：

```ts
const a = new Set(p.keyPointText)
const b = new Set(p.targetQuestion)
const inter = [...a].filter(c => b.has(c)).length
return inter / Math.max(a.size, 1)
```

中文文本的字符集重合度由高频汉字主导，与语义相关性基本无关。实测在试点块上：

```
预筛标出 52 组待人工确认（100.0%）
```

100%，不是 5-10%。**Task 15 那个校准数字用这套工具测不出来** —— 而它是 Task 15 列的三个主要产出之一。要么 Task 13 就接真实 LLM 打分（那 `screenPairs` 还需要并发和重试，见 N13），要么在 Task 15 Step 6 的笔记模板里注明"命中率待接入真实打分器后再测"，别留一个填不出的空。

### N9 · Task 1 Step 6 的 `pnpm install && pnpm test` 在 pnpm ≥ 10 上直接失败

实测报错原文：

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.19.3, esbuild@0.28.2
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
[ERROR] Command failed with exit code 1: pnpm install
```

pnpm 10 起默认拦截依赖的 build script，而 esbuild（vitest 和 tsx 的底座）靠 postinstall 拉二进制。计划的 Expected 是 `1 passed`。

**修正**：Task 1 加一个 Step，建 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  esbuild: true
```

（pnpm 10/11 的设置项从 `package.json` 的 `pnpm` 字段搬到了 `pnpm-workspace.yaml`；写在 `package.json` 里会被忽略并告警 `The "pnpm" field in package.json is no longer read by pnpm`，我实测踩过。）CI 那边 `pnpm install --frozen-lockfile` 同样需要这个文件。

### N10 · `parsed.data as Card` 是多余的断言，去掉反而更安全

**Task 5 Step 3**。实测把 `const card = parsed.data as Card` 换成 `const card: Card = parsed.data`，`tsc --noEmit` 退出 0 —— 说明 zod 推导出的类型**本来就赋值兼容** `Card`，断言没起任何作用。

它的害处是掩盖未来的漂移：`schema.ts` 和 `types.ts` 是两份手写的、必须保持同步的定义，哪天谁往 `Card` 加了个必填字段而忘了改 schema，`as` 会让它继续编译通过。去掉断言，编译器就替你盯着这件事。同理 `exactOptionalPropertyTypes` 开不开都能过（我两种都实测了），不是问题。

```ts
const card: Card = parsed.data   // 不要用 as —— 这行是 schema 与 types 的同步检查点
```

### N11 · `src/lib/content/index.ts` 承诺是"对外导出面"，但没有任务给它加过导出

文件结构表写它的职责是"对外导出面"，Task 1 Step 4 让它 `export const CONTENT_LIB_VERSION = '0.0.0'`，**此后 14 个 Task 没有一个碰过它**。而 `tests/smoke.test.ts` 还断言它必须等于 `'0.0.0'`。出题引擎和应用层按计划要从 `lib/content` 取 `Card`/`KeyPoint`，会发现导出面是空的。建议在 Task 12 之后补一个 Step 把 `types` / `schema` / `rules` / `parse` / `block` / `audit` re-export 出去。

### N12 · `screenPairs` 串行，12 万次调用没有并发、重试或缓存

spec §4.3 的规模是单块约 1710 组、全库约 12 万组。`screenPairs` 是个 `for` 循环里 `await`，一次一个。按真实 LLM 调用 1 秒计，单块约 28 分钟，全库约 33 小时纯等待。而且 catch 分支把**所有**失败都塞进人工队列——限流 429 也算，于是一次限流风暴能把 1710 组全部标成"待人工确认"。

这条不阻塞计划落地（占位打分器是同步的），但 Task 13 的注释说"接入真实 LLM 时替换此函数即可，`screenPairs` 的契约不变"——**契约确实不变，但性能特征完全不同**。至少该在 `screenPairs` 上加并发度参数，并把"重试耗尽"和"判定为不相关"区分开。

### N13 · Task 7 和 Task 12 的"在 return 之前插入"有歧义

两个 Task 都往 `auditLibrary` 的同一个位置插代码，措辞都是"在 return 之前"。零上下文的执行者做到 Task 12 时，函数里已经有 Task 7 插的那段，"return 之前"到底是 Task 7 那段之前还是之后并不明确。这次两段互不依赖，插哪儿都对，**但计划不该依赖这个巧合**。

Task 12 Step 4 还有一处表述问题：先说"在函数体末尾追加检查"，两行后又说"在 return 之前追加"——同一个 Step 里两种说法。

如果采纳 F3 的修正 B（拆成独立函数），这两处歧义一起消失。否则至少把锚点写成可定位的代码：

```
在 `// 干扰项池容量：` 那段循环结束之后、`return { errors, warnings }` 之前插入：
```

---

## 对 spec 的忠实度核对

逐条查了任务书点名的四处：

| spec | 要求 | 计划 | 判定 |
|---|---|---|---|
| §4.2 schema | `KeyPoint` 七个字段（id/text/source/appliesTo?/excludeAsDistractorFor/verifiedAt/public） | 全有，`Source` 按 spec 的缺口补齐并定死 `kind` 枚举 | ✅ 忠实，且 `SourceKind` 枚举把 §9.1"中文博客不得作为 source"落成了机制，好 |
| §8.3 per-cardType 最少要点数 | 3/3/4/2/1，sequence 每条自带 `order` | `MIN_KEY_POINTS` 完全一致 | ✅ 数值忠实；但 `order` 只校验存在不校验取值（N1） |
| §9.3 三条正则 | 30 汉字上界；承载词 `等\|多种\|一系列\|若干\|之类\|诸如\|各种`；块名 `基础\|进阶\|高级\|其他\|常见问题\|高频` | 三条逐字对上，7 个承载词 + 6 个块名词一个不差 | ✅ 忠实 |
| §7 id 守卫 | 四条：脚手架铸 id、CI 跨提交守卫、全库一次性校验、tombstone | 四条都有对应实现 | ⚠️ 结构在，但脚手架铸的要点 id 会撞车（F2）、守卫 fail-open（S4）、只锁卡 id 不锁要点 id（S5） |

**另外发现的偏离：**

- **§4.3 题型配额完全缺席**，且未列入"明确不覆盖"（S7）
- **§4.3 分层比例被误读**，导致 `MIN_BLOCK_POOL` 推导反了（S6）
- **§4.2"每题标 1-2 条 public"没有校验**（N2）
- **§4.3 comparison"正确要点必须成对出现"没有校验** —— schema 对 comparison 的约束和 enumeration 完全一样（都是 min 3）。成对性能不能机器校验值得讨论（要点两两配对关系没有结构表达），但计划**既没实现也没记录为"不覆盖"**。建议要么在 `KeyPoint` 上加 `pairsWith?: string`，要么明确写进不覆盖表
- **命名与 §7 架构图不符**：spec 写 `lib/content/validate.ts`，§9.3 也说"三条机器校验规则（进 `lib/content/validate.ts`）"；计划拆成了 `schema.ts` + `rules.ts` + `audit.ts`。**拆分本身比 spec 的单文件更合理**，但既然 spec 的架构图被后续计划引用，应当在计划里显式说明这次重命名

---

## 修正清单（按执行顺序）

照这个顺序改，可以让计划从"跑不起来"变成"全绿"。前 7 条是我实测验证过的。

| # | Task | 改什么 | 实测 |
|---|---|---|---|
| 1 | 1 | 加 `pnpm-workspace.yaml` 的 `allowBuilds: { esbuild: true }` | ✅ |
| 2 | 新增 | 加 `js-yaml` 依赖 + `src/lib/content/yaml.ts`（F1） | ✅ |
| 3 | 5 / 11 / 12 | 三处 `matter()` 调用传 `MATTER_OPTIONS`（F1 / S1 / S2） | ✅ |
| 4 | 9 | `template.ts` 的要点 id 从 ULID 派生（F2） | ✅ |
| 5 | 6 | 测试夹具改成块内 id 互异 + 补 filler 卡（F3） | ✅ |
| 6 | 4 | Expected 从 17 改成 18（N6） | ✅ |
| 7 | 14 | Step 4 的 Expected 改成 exit 1 并说明原因（S3） | ✅ |
| 8 | 14 | CI lockfile 先写临时文件再校验非空（S4） | ✅ 单独验证 |
| 9 | 3 | schema 加 `.strict()`（S8） | 未实测 |
| 10 | 3 | `order` 校验成 1..N 排列（N1）；`public` 数量校验（N2） | 未实测 |
| 11 | 7 | `MIN_BLOCK_POOL` 重新推导（S6）—— **需要你拍板取值** | 未实测 |
| 12 | 8 / 14 | lockfile 纳入要点 id（S5） | 未实测 |
| 13 | 新增 | 题型配额检查（S7）—— **需要你确认容差** | 未实测 |
| 14 | 10 / 13 | 加"否决"登记（S9）—— **需要你在两种方案里选一个** | 未实测 |
| 15 | 6 / 13 | 两条测试改名或改夹具（N5） | 未实测 |
| 16 | 12 | `parseBlock` 直接用 js-yaml，不绕 `---` 包装（N4） | 未实测 |
| 17 | 5 | 去掉 `as Card`（N10）；frontmatter 里的 `detail` 显式报错（N3） | ✅ 前者 |
| 18 | 9 | Step 6 后清掉占位卡（S3 尾） | 未实测 |
| 19 | 15 | 组合数估算改成 52（N7）；校准笔记的命中率一栏加说明（N8） | ✅ 前者 |

---

## 沙箱位置

完整可运行的复现工程在 `/tmp/plan-review-1`（已应用 F1/F2/F3/S1/S2 的修正）。

```
cd /tmp/plan-review-1
pnpm test          # 12 files, 66 tests passed
pnpm typecheck     # OK
pnpm content:audit # 内容审计通过（5 张卡、1 个块）
```
