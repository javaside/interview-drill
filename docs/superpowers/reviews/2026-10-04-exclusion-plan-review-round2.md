# 互斥判定落地方案 · 独立评审（第二轮：复验修复 + 审重写后的计划）

- 日期：2026-10-04
- 评审对象：
  - **16 项修复是否真的修上**（`90fe03c..ee95406`）
  - **计划 V2**（`ee95406` 重写后的 `docs/superpowers/plans/2026-10-04-content-exclusion-rollout.md`）
- 第一轮报告：[2026-10-04-exclusion-plan-review-round1.md](2026-10-04-exclusion-plan-review-round1.md)
- 评审方式：两名彼此独立的 subagent 并行；评审一的立场是**对抗性复验**——
  「只改注释的修复、或测试没走真实路径的修复，都算没修」；两人都拿不到会话历史
- 约束：只读（不许动工作区/索引/HEAD/分支），**绝对禁止运行 `--judge`**
- 处置：**全部采纳**。修复见提交 `e7cff4e`（含本报告新发现的 C5 与计划文档三处事实错误）


> **行号与数字的口径**：本报告里的 `file:line` 与统计数字（测试条数、diff 行数）都是
> **评审当时那个修订版**的实测值，不是当前 HEAD。后续提交会让行号偏移
> （例如 `exclusion.ts:246` 在 复验修复 之后已移位）。要核对时请先
> `git log --oneline` 找到对应提交、在那一版上查证，别对着当前工作区找。
> 报告正文与发现均**按原样保留**，不做后续修订——它是证据，不是文档。

## 结论摘要

- 16 项修复：**全部 `FIXED`**（逐条有本人复现证据，见下表）
- 但各抓到一条要修的：
  - **C5（代码）**：C1 的修复把恢复路径打通之后，暴露出一条 **fail-open** ——
    版本只记在账本头部、`flush()` 每次落盘都把头部写成当前版本，于是「有批失败或用了 `--limit`」
    会留下「新版本头部 + 旧版本判定」，闸门报 0 错、静默通过
  - **M7（文档）**：计划里写的 git 现状是错的（称 main 领先 `origin/main`、ff 不成立）
- 所有**数字**经独立重算**全部正确**（这是本轮最有价值的部分：计划里那些数不再是我的估算）

---

# 报告 A：对抗性复验 16 项修复

**验证方式**：读完 `git diff 90fe03c..ee95406`，然后在 V2 上**各自独立复现**原报告的每一条。
工作区保持干净；只跑只读 CLI（`--normalize --dry-run`、`--apply --dry-run`）、测试、
以及 `/tmp` 下的 scratch 脚本；**从未运行 `--judge`**。

## 逐条结论

**1. `pendingPairs` 版本不一致 → 全部失效 —— FIXED**
- `src/lib/content/exclusion.ts:246` `if (ledger.header.judgeVersion !== JUDGE_VERSION) return [...pairs]`
- `checkExclusion` 在 `exclusion.ts:417-422` 报「整体失效」
- CLI 的 `runJudge` 确实用它：`tools/content-exclusion/cli.ts:202`
- 测试 `判据版本变化 → 整体失效，且 pendingPairs 必须全量待判`（`tests/lib/content/exclusion.test.ts:249`）通过
- 独立复现（scratch）：`pendingPairs on mismatch: 6/6`，闸门报整体失效 = true

**2. 空数组判定 —— FIXED（恢复路径另有残留缺口，见新发现问题 A）**
- (a) `tools/content-exclusion/batch.ts:184-193`：首次 `[]` → 重试；仍 `[]` → `{ ok:true, yes:[], emptyAnswer:true }`。测试通过（2 批共 4 次调用）
- (b) `cli.ts:424-430`：`--report` 在 `yes.length === 0` 时打印「验收不成立」
- (c) `cli.ts:201-205`：`--rejudge` 把 `todo` 设为 `[...scoped]`（范围内全部，无视账本），并打印烧钱警告 —— 已入账的条目确实会被重新入队

**3. `--normalize` 语义不变 + 幂等 + dry-run 不写 —— FIXED**
- 在全部 404 个真实 `content/**/*.md` 上实测：`changed=402 identical=2 semanticMismatch=0 secondPassMismatch=0 parseFail=0`
  （前后 `parseCard` 结果做 `JSON.stringify` 深比较；第二遍逐字节相同）
- `pnpm content:exclusion --normalize --dry-run` 打印 `格式统一的卡：402 / 404`，且 `git status` 保持干净（不写任何东西）

**4. 计划把每次重判都标成需要重新批准 —— FIXED**
- Task 3 Step 2（`plans:208`）「需重新批准」；Task 6 Step 3（`:300`）「需重新批准预算」；
  Task 7 Step 4（`:355-356`）「若数量成规模则属重判，需重新批准」；Global Constraints `:18`

**5. `--apply --allow-touch` —— FIXED**
- `cli.ts:369-383`：默认 `touching>0 && !allow-touch` → 报错 + `process.exit(1)`；带 `--allow-touch` → 警告后继续
- 实况确认触线判定：`pnpm content:exclusion --apply --dry-run` → `触线（同块池 < 下界）：2 张`，退出码 1（只读，未跑写盘路径）

**6. 退役卡/退役要点跳过 —— FIXED（owner 侧；target 侧仍有缺口）**
- `exclusion.ts:480,482` 与 `cli.ts:388` 跳过 owner 侧退役卡/要点；`--apply` 跳过退役 owner 的文件
- 独立复现：退役持有 yes 登记的 **owner** 卡后，`卡文件与账本不一致` 错误数 = 0
- **注意**：退役 **target** 卡不会被跳过。`projectExclusions`（`exclusion.ts:263-289`）只校验 owner 存在，
  从不校验 target 存活，所以活跃 owner 仍会被要求 `卡文件 [] ≠ 账本投影 [retiredTarget]`。
  这是**既有缺口**（非本提交引入），但意味着「跳过退役卡」只在 owner 侧成立

**7. 闸门提示里的 `--layer` 取值合法 —— FIXED**
- 两处修复点都走 `CLI_LAYER`：`exclusion.ts:366-368` + `:461`，以及 `cli.ts:43-45` + `:330`
- CLI 只接受 `same|cross|neighbor`（`cli.ts:81-88`）；grep 确认没有任何 `--layer` 命令提示里
  出现过裸的 `sameBlock`/`crossBlock`

**8. 增量 + 原子落盘、SIGINT/SIGTERM、`.tmp` 不被读取 —— FIXED**
- `cli.ts:252-269`：`flush()` 写 `${LEDGER_FILE}.tmp` 后 `renameSync`；SIGINT/SIGTERM 处理器在 `exit(130)` 前 flush；
  每 `FLUSH_EVERY=25` 批增量落盘（`:287`）并有最终落盘（`:294`）
- grep 确认唯一的账本读取点是 `readFileSync(LEDGER_FILE)`（`cli.ts:123`、`audit-cli.ts:53`）；
  残留 `.tmp` 永不被 `parseLedger` 读到，只会在下次 flush 时被覆盖

**9. 含 `|` 或以 `#` 开头的 id 在花钱前被闸门拒绝 —— FIXED**
- `exclusion.ts:398-407` 把它们推成 **errors**，且在 `ledger === undefined` 的早退**之前**（所以首次运行也能拦）
- 免费闸门路径为 `auditLibrary → checkExclusion`（`audit.ts:174-177`）；测试通过
- 注：`--judge` 自己不重跑闸门，但本条要求的是「闸门」，已满足

**10. `finish_reason === 'length'` 即使正文可解析也作废 —— FIXED**
- `run.ts:78-84` 在正文空判定之前抛错。独立复现：完整可解析的 `'[1,2]'` + `finish_reason:'length'`
  抛 `被 max_tokens=8000 截断（正文不完整）`。测试通过

**11. 死 import / maxTokens / extraBody / 用量分母 / docstring —— FIXED**
- `src/server/queue.ts:2` 现在只 import `layerOf`（`neighborCategoryOf` 已移除）
- `run.ts:52-60`：`...provider.extraBody` 展开在**前**，显式 `model/stream/max_tokens` 在后。
  验证：extraBody 里塞 `model:'evil'`、`stream:true`、`max_tokens:999`，最终仍是 `deepseek-flash / false / 8000`
- `max_tokens: opts.maxTokens ?? provider.maxTokens ?? JUDGE_MAX_TOKENS`；测试通过
- `cli.ts:298`：`calls = outcomes.reduce((n,o)=>n+o.attempts,0)` —— 分母是真实调用尝试数，
  不再依赖 provider 是否回 `usage`（此前 `usage.calls` 只在 `onUsage` 里加，provider 不回 usage 时分母是错的/「0 次调用」）
- `poolMarginsOf` 的 docstring 已为「= 将要落盘的状态」补上漂移偏保守的限定（`exclusion.ts:313-315`）；
  `pool.ts:35-42` 更正了「真实块不会撞线」的过头话

## 本提交引入的新问题

**A. 版本升版后的恢复路径在有失败批 / `--limit` 时会 fail-open。**
版本标记**只**存在于账本头部，而 `flush()` 无条件把它设为 `JUDGE_VERSION`（`cli.ts:252-262`）。
`base.entries` 仍保留所有未被覆盖的旧版本条目 —— 失败的批不删它们（`set` 只在 `o.ok` 时发生，`cli.ts:286`），
而 `--limit N` 只重判 N 对。由于 `LedgerEntry` 没有逐条目版本，`checkExclusion` 又只信头部 + 指纹，
这些旧版本判定（指纹仍然匹配未变的内容）会被**静默当成有效**。
具体复现：在 v0 账本、当前 `JUDGE_VERSION` 下，`pendingPairs` 返回 6/6 且闸门报整体失效；
模拟「flush 提升头部、一批失败/仍是 v0」后，闸门报 **0 错 / 0 警**。
因此 CLI 的失败消息「这些组合未写账本，仍是未判定，content:audit 会报错」（`cli.ts:305`）
在这种情况下是**错的** —— audit **不会**标出它们。
根因（只在头部记版本 + 乐观提升）在 V1 的 `runJudge` 里就存在，但 V1 让「已全判」的恢复路径**死锁**
（`pendingPairs` 返回 0，头部永不提升）；这次修复让路径变得可走，于是只要有任何批失败或用过 `--limit`，
「整体失效，需重跑」/「--judge --rejudge」的**标准结局就是这个 fail-open**。

**B.（既有，非本 diff 引入，但与第 6 条相关）** 一条 `yes` 判定的 **target** 卡退役后，
仍会投影到活跃的 owner 上，要求 `excludeAsDistractorFor: [retiredTarget]` ——
`projectExclusions` 校验 owner 存在但不校验 target 存活。若退役 target 变常见，值得单独跟进。

## 本报告发现的处置（评审后补记）

- **C5（fail-open）**：已修于 `e7cff4e` —— 新增 `discardStaleVerdicts`，判定开始前若版本不一致就
  丢干净旧判定（「新头部 + 旧判定」的组合不再可能出现），缺条目即为「未判定」→ 闸门立刻红；
  测试直接复现「不丢弃时闸门静默通过、丢弃后报未判定 + 卡文件与账本不一致」。
  比重判全量更省：中断后重跑只补真正缺的那些。
- **A/B 两条 target 侧退役缺口**：**未修**，属独立 follow-up（改它要动投影语义）。
- **CLI 无测试**（增量落盘 / `--rejudge` / `--allow-touch` 只经读码验证）：**未补**，独立一笔工作。

## Assessment

**这些修复可信吗？** **With caveats.**

**理由：** 全部 16 项窄断言都对得上代码、测试（92 文件 / 784 通过）以及我自己在真实内容上的复现 ——
包括 `--normalize` 的语义/幂等实测、`finish_reason='length'` 与 `extraBody` 覆盖的证明。
唯一实质性 caveat 是：刚刚被打通的版本升版恢复路径，在部分运行（失败批或 `--limit`）下仍会 fail-open，
把旧版本判定静默祝福在一个已提升的头部之下；这值得单独修
（例如版本不匹配时丢弃旧条目，或只在整轮重判完成后才提升头部）。

---

# 报告 B：审重写后的计划（V2）

**验证方式**：读 V2 计划、与 V1 逐段对比（`git show 544a8f0:...`）、对照实现代码；
重算了计划里每一个数字；跑了全部不花钱的命令。

## 对修复清单表的裁决

计划 Task 1 Step 2 的表里**每一行的修复都存在于 HEAD `ee95406` 的代码中**，
且每个被引用的测试文件都真实覆盖了所述逻辑：

| 缺陷 | 裁决 | 证据 |
|---|---|---|
| C1 版本盲的 `pendingPairs` | **CONFIRMED** | `src/lib/content/exclusion.ts:246`；测试 `exclusion.test.ts:249` |
| C2 全 `[]` → 绿且不可恢复 | **CONFIRMED** | `batch.ts:186`；`cli.ts:204/317-322/424-430`；测试 `exclusion-batch.test.ts:105` |
| C3 `--apply` 格式 churn | **CONFIRMED** | `cli.ts:166-183`（`--normalize`）；测试 `review-register.test.ts:157-224` |
| C4 花钱门 | **CONFIRMED** | 计划正文（每次重判需重新批准）+ `cli.ts:204` 的烧钱警告 |
| I1 `--apply` 全有全无 | **CONFIRMED** | `cli.ts:369-383`；默认仍拒绝 |
| I2 退役卡闸门错误 | **CONFIRMED** | `exclusion.ts:478-482`；`cli.ts:388`；测试 `exclusion.test.ts:299` |
| I3 修复提示里的层名 | **CONFIRMED** | `exclusion.ts:366-368` + `cli.ts:42-45` |
| I4 中断丢钱 | **CONFIRMED** | `cli.ts:40/259-269` |
| M1 `\|`/`#` id | **CONFIRMED** | `exclusion.ts:398-407`；测试 `exclusion.test.ts:290` |
| M2 截断只在空时诊断 | **CONFIRMED** | `run.ts:78`；测试 `content-exclusion-run.test.ts:64` |
| M3 死 import | **CONFIRMED** | `queue.ts:2` |
| M4 忽略 `provider.maxTokens` | **CONFIRMED** | `run.ts:59`；测试 `content-exclusion-run.test.ts:71` |
| M5 用量分母 | **CONFIRMED** | `cli.ts:298-302` |
| M6 过头的注释 | **CONFIRMED** | `pool.ts:34-42` |

**一个 caveat（不是假陈述，是缺口）**：那些标注为 `CLI`/`手工实测`/`计划本身` 的行
（C2 的 `--rejudge`/report 部分、C4、I1、I3、I4、M5）**没有自动化测试** ——
`tools/content-exclusion/cli.ts` 没有测试文件。表对此是诚实的（写了「CLI」「手工实测」），
所以没有一行算 *unsupported*，但那些花钱关键的路径（SIGINT 增量落盘、`--rejudge`、`--allow-touch`）
只经代码阅读验证，未经测试。

## Issues

### Critical (Must Fix)

无。

### Important (Should Fix)

**1. Task 9 Step 4 + 「执行前现状」表把 git 拓扑说错了 —— 「ff 不成立」这个判断是错的。**
- `plan:32` 说「本地 main 在 544a8f0，比 origin/main 多一个提交」。
  实际：`git rev-parse main` = `abc2931`、`git rev-parse origin/main` = `abc2931`（两者相等）。
  `544a8f0` 是 **V1 计划**那次提交，一个不在任何分支上的悬空提交（`git branch --contains 544a8f0` → 空）。
- `plan:448` 说「main 已领先 origin/main 一个提交，ff 不成立」。
  实际：`git merge-base --is-ancestor main feat/content-exclusion` 返回**成功** ——
  `main`（abc2931）就是分支的直接基准，所以**可以** fast-forward。
- 影响：`git merge --no-ff` 仍可用（它只是强制生成合并提交），所以照抄不会坏。
  但「执行者先读这一段」的表是执行者读到的第一样东西，而两条陈述都是假的。
  修法：把表改成「main == origin/main == abc2931」，并重写 Step 4 说明 ff *可行*、
  `--no-ff` 是为了把 4 个分支提交留成一个整体的**刻意选择**（或直接删掉错误的理由）。

### Minor

**2. 缺陷条数内部不一致。** `plan:124` 说「4 Critical + 12 Important」（=16），
但表里列了 **14** 条：C1–C4（4）+ I1–I4（4）+ M1–M6（6）。提交正文 `ee95406` 也写的是 4 C + 10 I/M。
要么「12」是「10」的笔误，要么有 2 条（未提交的）subagent 发现未被计入。
核对这个数字；若有 2 条被静默丢掉，那是诚实性问题，不只是笔误。

**3. 本机未安装 `psql`**（`which psql` → 退出 1）。`plan:382` 与 `plan:401-409`（Task 8 Step 2 & 4）
都用了 `psql`。计划只在 Step 2（`plan:387`）给了 tsx 兜底；Step 4（本地与生产的对比）没有兜底说明。执行者会撞上。

**4. 生产 upsert 用了 `source` 而不是文档化的 env 形式。** `plan:393` 用
`set -a; source .env.production.local; set +a; pnpm content:upsert`，而 Global Constraints（`plan:22-23`）
与本地那步用的是 AGENTS.md 认可的 `--env-file-if-exists`。两者对纯 `KEY=VALUE` 文件都可用，
但 `--env-file-if-exists=.env.production.local` 更健壮（能处理引号/特殊字符），
且与项目为高频坑 2 记录在案的修法一致。

**5. Task 0 Step 3 的措辞低估了 audit 的输出。** `plan:91` 说 audit 会有「只有『账本未判定』类消息」，
但 audit **当前还会**输出 18 条既有的「卡文件与账本不一致」（来自标定账本那 18 条 `yes`，它们从未被 apply）。
实质主张 —— normalize **不引入新**错误 —— 是真的（我验证了语义不变：404 张卡 0 语义差异、0 幂等失败），
只是措辞不精确。

## Assessment

**照原样执行安全吗？** **With fixes**

**理由：** 我用真实 `content/` + `src/lib/content/exclusion.ts` + `batch.ts` 重算的每一个数字都正确 ——
108,891 对（6,475/48,307/54,109）、371 目标题、待判批数 363/1,395/1,572（分层 = 3,330，不分层 = 2,882）、
11 张零余量卡（恰为那 4 个块）、65 张零免费池卡、2 张跌破下界的卡
（`01M2YHWH5R70FFC6TGAN0VP7ZS` 11/12、`01M3KH6MGE6EHRDCH6S3HP1A64` 10/12）、
账本 247 行/18 yes、785 测试（92 文件）全绿。`--normalize` 语义不变且幂等
（402/404 张；计划里的「403/404」正确指 normalize **之前**的 `--apply`，我也测到 403）。
Task 8 的「只 upsert 内容」是对的（列 `exclude_as_distractor_for jsonb` 已在 `drizzle/0000_init.sql` 里，
且应用没有结果缓存，不需要重启）。唯一实质错误是**现状表与 Task 9 Step 4 的 git 拓扑说法**；
它不会让合并命令失效，但必须改正，免得执行者被仓库状态误导。
