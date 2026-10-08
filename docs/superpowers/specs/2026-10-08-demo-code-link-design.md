# 题卡 ↔ 示例代码关联 · 设计文档

- 日期：2026-10-08
- 状态：**定稿（待实施）**
- 前置讨论：brainstorming 流程产出，方案 A 经用户拍板；展示形态（内嵌完整代码）、消费场景、代码仓归宿（GitHub 公开仓）为用户选定。
- 评审：deepseek-flash subagent 审核（2026-10-08），12 条问题（3 阻断 / 5 应修 / 6 建议）全部采纳修正；其中「公开题页泄露面」修正方向经用户拍板为**公开页只放提示、不放代码**。

## 1. 背景与目标

[interview-code](../../../../../interview-code)（本仓库的兄弟目录）是题库的示例代码仓：**大类 = Maven 模块、知识块 = Java 包、题卡 = 演示类**。当前 java 模块已完成（10 块 × 5 题 = 50 个可运行 Demo 类），每个类的头 Javadoc 标注了题卡 ULID 与块 ID——代码 → 题卡的单向回溯已成立。

本设计打通反方向：**App 内（刷题复盘 + 学习页）内嵌展示每张题卡的配套可运行示例代码；公开题页只放提示不放代码**。

### 已核实的事实（2026-10-08 实测）

1. **ULID 映射零缺陷**：50 个 Demo 类的头 Javadoc「题卡：<ULID>」提取后 0 重复、全部在 `content/java/` 下有同名片；50/50 头注释都含「题目/题卡/块」三行。
2. **工具链扫描范围**：`content-upsert/run.ts`、`audit-cli.ts`、`content:exclusion`、`review:pairs`、`content:new` 全部只碰 `.md` / `block.yml` / `tracks/*.yml`——`.java` 放进 `content/` 对既有工具链零影响（也不动 `.ids.lock` 与 `.exclusion-ledger`）。
3. **interview-code 是纯本地仓**：无 git remote；生产部署 rsync 本仓库（`--delete`，排除项不含 `content/`），服务器上不存在 `../interview-code`。
4. **高亮基建已存在**：`src/lib/content/highlight.ts` 覆盖 Java（`JAVA_KEYWORDS` + 注解处理），`RichText.tsx` 已用它渲染正文中的 ``` 代码块。

### 关键约束：代码永不上公开题页（用户拍板）

公开题页 `/q/[cardId]` 有「无 cloaking」纪律（§7）：非 public 要点绝不能出现。实测风险远不止头 Javadoc：**39/50 个 Demo 的代码体（println 输出、行内注释）复述了非 public 要点的实质内容，命中 63/137 条非 public 要点**——例如 `IntegerCacheDemo.java:38` 的行内注释 `// 永远新建对象，不走缓存` 与该卡非 public 要点逐字相同。剥任何注释都治不了 println。

**定论：示例代码只在 App 内展示**（复盘/学习页要点本来就全量可见，无泄露问题）；公开题页只加一行「本题配有可运行示例 · 在 App 内查看」提示（纯元信息，不泄露要点，兼作转化钩子）。公网查看代码的通道由 GitHub 公开仓承担（后续项，§8）。

## 2. 方案选择

| 方案 | 结论 | 理由 |
|---|---|---|
| **A. 代码快照进本仓库 + 展示层渲染** | **采纳** | 不动 DB、无迁移、不重跑 upsert；快照进 git 后 rsync 部署天然可用；渲染不依赖外部网络 |
| B. 代码走内容管道进 DB | 否决 | 要动 schema/parse/upsert/adapters + 迁移；代码是纯展示资产（不参与判分/排期/干扰项），进 DB 的「干净」溢价在此体量（50 文件）不值 |
| C. 运行时 fetch GitHub raw | 否决 | xibaojun.com 面向国内用户，`raw.githubusercontent.com` 访问不稳定，渲染链路不可依赖外网。GitHub 仓仅作托管与外链（§8） |

## 3. 同步脚本 `pnpm demo:sync`

新增 `tools/demo-sync/index.ts`（结构照 `tools/content-new/`），package.json：

```json
"demo:sync": "tsx --env-file-if-exists=.env.local tools/demo-sync/index.ts"
```

行为：

- 扫描 `DEMO_REPO`（env，默认 `../interview-code`）下所有 `.java` 源文件；**只认头 Javadoc 带「题卡：<ULID>」标记的文件**（防将来源仓出现非题卡辅助类时误抓）。
- 从头 Javadoc 解析「题卡：<ULID>」与「块：<a>/<b>」，快照写到 `content/<块Id>/<ULID>.java`——**与题卡同目录同名不同后缀，文件名即映射，题卡 front matter 零改动**。
- 快照是**源文件的逐字节完整副本（保留 Javadoc 头）**：diff 干净，头标记供 audit 校验，未来用途（GitHub 外链、类名清单）不丢信息。剥离在展示层做（§4）。
- **三道闸门（防静默删光快照——源仓缺失的环境如 CI/服务器跑 sync 时，0 源文件不应等于「全部是孤儿」）**：
  1. `DEMO_REPO` 目录不存在 → 报错退出；
  2. 解析到 0 个带「题卡：」标记的文件 → 报错退出（显式 `--allow-empty` 才豁免）；
  3. 孤儿清理只删「头注释带题卡标记」的 `.java`，绝不碰其他文件。
- 解析错误处理：「题卡：」标记缺失 → 跳过并计入报告；ULID 非 26 位大写字母数字 → 报错；**同一 ULID 出现两次 → 报错**；「块：」缺失或不是 `a/b` 形态 → 报错（无处落盘且 audit 规则 2 无从校验）。
- 幂等：内容有变化才重写；输出「新增 / 更新 / 删除 / 跳过 / 未识别」报告。
- 源仓将来扩展 jvm 等 11 个大类（新 Maven 模块）时零改动天然支持——walk 的是全仓。
- **明确不做**：不解析头注释里的要点 bullet（那是概述不是原文，条数与要点数不等、格式不统一），也不做「代码 ↔ 要点一致性」闸门——关联校验只到 ULID/块这一层。

## 4. server 层 loader + lib 纯函数

依赖方向遵守铁律（fs 是 IO，与 SQL 同级，不下沉 lib）：

- **`src/lib/content/demo-code.ts`**（纯函数，node project 可单测）：`stripDemoHeader(source: string): { ok: true, code: string } | { ok: false, reason: string }`——剥掉**包含「题卡：」标记的那个 `/** ... */` 块**（不是「第一个块」：将来若加 license 头，剥第一个会剥错对象且泄露回归）。未匹配到带标记的块 → 返回失败（loud，不静默返回原文；sync 已保证标记存在，失败即快照异常）。其余注释（方法注释、行内讲解）全保留。
- **`src/server/demo-code.ts`**：`loadDemoCode(blockId: string, cardId: string): string | null`——fs 读 `content/<blockId>/<cardId>.java`，读到后剥头返回，单卡无 demo 返回 `null`。**模块级 memo**（content/ 是只读快照，进程内缓存即可；避免 `settings.ts` 保存路径里 `buildDailyPayload` 的结果即弃调用白做 N 次读盘）。**区分两种失败**：`content/` 目录整体缺失 → throw（loud，防「功能整体不可见还零报错」的静默漂移）；单文件不存在 → null（正常态）。
- 路径基准用 `process.cwd()`（`next start` 与 vitest 都以仓库根为 cwd）；deploy.md 补记 systemd unit 的 `WorkingDirectory` 约定（§8）。

## 5. 页面展示

### 组件与样式

纯展示组件 `src/app/DemoCodeBlock.tsx`（与 `RichText.tsx`、`CardQA.tsx` 同级平铺，server/client 双侧可 import）：`<details>` 折叠，summary 文案「可运行示例（Java）」；内部代码**复用现有 Java 渲染路径**（`highlight.ts` 的 `tokenize(src, 'java')` + RichText 同款 token 色板，或包成 ```` ```java ```` 围栏交给 RichText）——与正文内代码块呈现一致，不引新依赖。

### 三处接入点

| 页面 | 数据通路 | 位置 |
|---|---|---|
| 公开题页 `/q/[cardId]` | `loadPublicCard` 的 select 加 `c.block_id`、`PublicCard` 加 `blockId` 字段（现有 SQL 没查它，`blockName` 是展示名不是块 id）；page.tsx 调 `loadDemoCode` 只判存在性，**不渲染代码** | public 要点列表之后，仅当有 demo 时渲染一行「本题配有可运行示例 · 在 App 内查看」（链 `/`，与「完整 N 条要点在 App 内」同向） |
| 刷题复盘 `DrillFeedback` | **`CardView` 加可选 `demoCode?: string`**；注入走 **`DailyPayloadDeps` 注入契约**——deps 增 `loadDemoCode`，`payloadDepsOf` 接线到 `src/server/demo-code.ts`（queue.ts 保持零 fs，集成测试可注入 fake） | 「看不懂术语？看讲解」折叠区下方 |
| 学习页 `/learn` | `page.tsx` 组装 `LearnCard[]` 时直接调 `loadDemoCode`（server 层函数，RSC 直调），`LearnView` 渲染 | 每卡正文之后 |

payload 增量（实测）：剥头后均 ~2.3KB/卡（50 卡共 ~117KB），约为 `detail` 正文均值（0.5KB）的 4–5 倍，但绝对值小（今日 20 卡 ≈ 46KB），可接受；`CardView` 随 `DailyPayload` 进 IndexedDB，**离线天然可看**。RSC 边界纪律不变：传可序列化字符串，不传 deps。

## 6. audit 闸门

`tools/audit-cli.ts` 是零 export 的执行脚本，纯判定下沉 lib 才能单测（既有 `audit-identity/lock/pool.test.ts` 全部 import `src/lib/content/audit.ts` 纯函数）：

- **lib 层**（`src/lib/content/audit.ts` 或 `demo-code.ts` 内）：`auditDemoSnapshots(snapshots: { path, ulid, blockMarker, dir }[]): string[]`——规则：a) `.java` 的 ULID 必须在同目录有同名 `.md`（孤儿快照报错，多半是题卡被删/改名）；b) 头 Javadoc「块：<a>/<b>」必须与所在目录一致（路径比较前 normalize）。**不强求每卡有 Demo**；只校验 ULID/块层（见 §3「明确不做」）。
- **CLI 层**：只负责 walk `content/**/*.java`、提取头标记、调纯函数、打印错误。

## 7. 测试与验收

- **lib 单测**（node project，`tests/lib/content/`）：`stripDemoHeader` 命中带标记块/无标记块返回失败/license 头在前的块不被误剥/文件中间的块注释不误剥；`auditDemoSnapshots` 孤儿 `.java`、块标记与目录不一致两场景报错。
- **jsdom 组件测试**（`tests/app/`）：DemoCodeBlock 折叠态与展开内容；公开题页**有 demo 时只渲染提示行、绝不渲染代码**（cloaking 守卫：渲染的可见纯文本不含该卡任何非 public 要点文本，用 `content/java/*/*.md` 的全部非 public 要点作禁集——不是断言「要点口径」字样，那个恒真）；复盘组件有/无 demoCode 两态。
- **集成**（`tests/server/`）：`buildDailyPayload` 经 fake `loadDemoCode` deps 注入后 CardView 携带 demoCode（今日队列 + 自由刷两处 map）。
- 验收标准（AGENTS.md 既定）：`pnpm typecheck && pnpm test` 全绿；本地 `pnpm demo:sync` 生成 50 个 `.java` 并 commit；浏览器实测公开题页（只见提示）、复盘、学习页三处。

## 8. 部署与后续项

- **代码不进 DB**：不需要迁移、不需要重跑 `content:upsert`；部署流程就是既有的 rsync → build → restart。rsync 用了 `--delete` 且 `content/` 不在排除项——**快照必须 commit 进 git**（`.gitignore` 无冲突），否则从干净检出部署会删掉线上快照。systemd unit 的 `WorkingDirectory=/opt/interview-drill`（`process.cwd()` 的前提）补记进 `docs/deploy.md`。
- **GitHub「在 GitHub 查看」外链（暂不做）**：等 interview-code 推上 GitHub、仓库名定了之后，加仓库 URL 常量 + `<ULID> → 源相对路径` 清单（可由 demo:sync 顺带产出）即可，不影响本次结构。公开题页若将来想升级为直接展示代码，需先解决 §1 泄露面（publicSafe 白名单或源仓去答案化），不在本次范围。
