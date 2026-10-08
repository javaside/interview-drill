# 互斥判定落地方案 · 独立评审（第一轮）

- 日期：2026-10-04
- 评审对象：**计划 V1** `docs/superpowers/plans/2026-10-04-content-exclusion-rollout.md`（提交 `544a8f0`）
  + 被计划依赖的实现代码（`abc2931..90fe03c`）
- 评审方式：两名彼此独立的 subagent 并行，**互相看不到对方结论**；各自只拿「描述 + 要求 + SHA」，
  不给会话历史。评审约束：只读（不许动工作区/索引/HEAD/分支），**绝对禁止运行 `--judge`**（真花钱）。
- 处置：**全部采纳**。修复见提交 `ee95406`；第二轮复验见
  [2026-10-04-exclusion-plan-review-round2.md](2026-10-04-exclusion-plan-review-round2.md)
- 状态：本文件是**原始报告的留档**，不做改动；凡与后续提交冲突处，以代码为准
- 处置结果：16 项（判据版本失效、空判定集 fail-open、格式 churn、花钱门、退役卡、层名、
  增量落盘、id 保留字符、截断、以及若干 Minor）全部修复并复验，见
  [第二轮报告](2026-10-04-exclusion-plan-review-round2.md) 与提交 `ee95406`、`e7cff4e`


> **行号与数字的口径**：本报告里的 `file:line` 与统计数字（测试条数、diff 行数）都是
> **评审当时那个修订版**的实测值，不是当前 HEAD。后续提交会让行号偏移
> （例如 `exclusion.ts:246` 在 评审修复 之后已移位）。要核对时请先
> `git log --oneline` 找到对应提交、在那一版上查证，别对着当前工作区找。
> 报告正文与发现均**按原样保留**，不做后续修订——它是证据，不是文档。

## 为什么留档

这两份报告是「计划里的数字与命令是否可信」的唯一独立证据来源。其中三条结论直接改变了
后续动作，且单凭提交信息无法还原**它们是怎么被测出来的**：

1. `--apply` 会重写 **403/404 张卡**（约 1.3 万行与互斥登记无关的格式改动）——
   → 催生了 Task 0（`--normalize` 单独提交）
2. 计划里的分层批数 **全错**（162/1210/1355 → 实测 363/1395/1572）——
   → 计划重写；成本从「按候选数除 40 估」改为「按目标题分组实测」
3. 一份全判「否」的账本会让 **闸门变绿而 bug 原样存在**，且当时**不可恢复**——
   → 催生了空答案重试 + `--rejudge` + `--report` 的「验收不成立」

---

# 报告 A：审计划（针对计划 V1 与真实代码）

## Strengths

被验证为正确的判断（执行者可以信任其余部分）：

- **枚举范围精确。** `pnpm content:exclusion --report` 打印 `三层候选对 108891 组`，分层为
  `sameBlock 6475 / crossBlock 48307 / neighbor 54109` —— 与计划第 22 行、spec §2 逐位一致。
  对照 `src/lib/content/exclusion.ts:84` 确认。
- **批数 `2,882` 正确**（不分层口径）。用真实 `batchPairs`（`tools/content-exclusion/batch.ts:36`）
  跑全部 108,891 对，恰好 `2882`。（注：批数按目标题分组切块，不是 `对/40` —— 见 Critical 3。）
- **账本数字精确。** `--report --sample 0` 打印 `账本：247 条判定`、`sameBlock 判定 247/6475`、
  其余层 `0` —— 与计划第 72 行完全一致。
- **Task 8 的主机/路径/端口与 `docs/deploy.md` 一致。** `ssh -p <SSH端口> root@<服务器IP>`、
  `/opt/interview-drill`、`set -a; source .env.production.local; set +a; pnpm content:upsert`
  与 `docs/deploy.md:10,12,52-59` 逐字相同。期望输出
  `已 upsert：81 块 / 404 卡 / 1769 要点 / 3 个岗位包` 与 `src/server/content-upsert/cli.ts:11`
  及 `docs/deploy.md:169` 一致；本地库确认 `81 / 404 / 1769`。
- **Task 8 Step 1 的命令形式是对的。**
  `pnpm exec tsx --env-file-if-exists=.env.local src/server/content-upsert/cli.ts` 可用（实测
  `DB set: true`）；而裸 `pnpm content:upsert` 脚本**不读 `.env*`**，计划正确地避开了它
  （AGENTS.md 高频坑 #2）。
- **不需要迁移。** `exclude_as_distractor_for` 在 `drizzle/0000_init.sql` 里，本地库存在
  （`information_schema` → 1 行）；列定义 `notNull().default([])`（`src/server/db/schema.ts:74`），
  所以 Task 8 Step 4 的 `coalesce(...,'[]')` 无害。
- **`--judge` 从不碰卡文件** —— `runJudge` 只写账本（`cli.ts:216-226`）。计划第 20 行成立。
- **批失败可续跑是真的。** 部分批失败时 CLI 在 `process.exit(1)` **之前**就写了账本
  （`cli.ts:226,235-241`），`pendingPairs` 会跳过已判条目（`exclusion.ts:235`）。计划第 96 行
  **对这条路径**成立。
- **`--prune` 有闸门**（`cli.ts:371-375`，需要 `--yes`）；计划全程不用它。
  `--apply --dry-run` 不写任何文件（`cli.ts:278-282`）。两者都无数据风险。
- **重排不会自我失效。** 对全部 404 张卡跑 `applyExclusionsToRaw`（`--apply` 调用的同一个函数）
  再重新枚举：`108891 → 108891` 对，**0 个指纹变化**。所以 Task 7 Step 4 的「闸门转绿」不会被
  写回动作本身打破。
- **Task 1 的三处「偏离」与代码相符**：严格闸门 + 「该层尚未扫过」警告
  （`exclusion.ts:374-438`）、`MIN_BLOCK_POOL` 挪到 `pool.ts` 并被 `audit.ts` 再导出
  （`audit.ts:1-12`）、`stash@{0}` 存在且消息与引用一致。
- 分支上 `pnpm typecheck` 干净。

## Issues

### Critical (Must Fix)

**C1. `--apply` 会重写约 402/404 张卡文件，而非计划所称的「真正变化的那几张」——与计划自己的
Global Constraints 相反。**
`plans:20,210,232`（Global Constraints「只写真正变化的那几张」；Task 7 Files「404 张卡中真正变化的
那批」；Task 7 Step 3「`git diff` 只含 `excludeAsDistractorFor` 的增行，其他字段零改动」）。

对真实 `content/` 跑 CLI 实际调用的写函数（`tools/review/register.ts:applyExclusionsToRaw`，
调用点 `cli.ts:292`）：

- **402 / 404 张卡在一次恒等往返后就不同**（空投影 —— 即 exclude 零变化的卡）。它是幂等的
  （第二遍 = 第一遍），`parseCard` 仍接受输出（`verifiedAt` 保持字符串 —— Date 那个 bug 确实修好了）。
- 用已提交的标定账本，**只有 9 张卡有真实的 `excludeAsDistractorFor` 变化，但 `--apply` 会重写 403 张**。
- 成因：真实卡文件是手工格式的 YAML（`content/agent/agent-patterns/01M3NE18CNW5S0T2W4Y6A8C1.md:1-20`）：
  ```
  relatedBlocks:
    []
  question: "Function calling（工具调用）的完整工作机制？"
      verifiedAt: '2026-09-28'
  ```
  `matter.stringify(..., MATTER_OPTS)`（`src/lib/content/yaml.ts`）会把它们全规范化：
  ```
  -relatedBlocks:            -question: "…"           -    verifiedAt: '2026-09-28'
  -  []                      +question: …              +    verifiedAt: 2026-09-28
  +relatedBlocks: []
  ```
  332 张卡用了块形式的 `relatedBlocks`，其余在 `question`/`text`/`verifiedAt` 上丢引号。
  `tests/tools/review-register.test.ts:5-14` 的夹具写的是**输出格式**（内联 `relatedBlocks: []`、
  不带引号），所以测试全绿而真实往返并非逐字节稳定 —— 测试从未拿真实内容跑过。

为什么重要：计划「可审的小 diff」这个前提是假的；Task 7 会产出横跨整个库的数千行混合 diff，
而执行者以为它「只应含 `excludeAsDistractorFor` 增行」，且 Task 7 Step 3 的
`git add content/ && git commit` 会把它固化。计划 Task 9 的风险提示
（「apply 会一次性改动几十到几百张卡文件」）也低估了（「几十到几百」vs 402）。
修法：要么（a）先来一次**单独的、明确公告的**「统一 YAML 格式」提交（或接受并记录 churn，
把 Task 7 Files/Step 3 的预期改成「约 402 张卡重排，N 张有真实登记」）；要么（b）让写回格式稳定
（对既有 `excludeAsDistractorFor:` 行做定点插入，而不是整体 YAML 重排）。**不要把预期照原样留着。**

**C2. 用户被要求批准的那个 token 数字自相矛盾，且与被引作来源的标定不符。** `plans:21`
（「满批（40 条候选）输入 ≈1.3K tokens、输出 0.3–0.6K … 2026-10-04 实测」）与 `plans:76`
（「外推（满批实测 × 批数）：输入 ≈3.7M、输出 ≈1.7M tokens」）。

- 已提交的标定账本里**根本没有 40 条候选的批**：247 条 / 34 张目标题，每目标题 min 1 /
  **max 16** / 均 7.3 对，即约 34 个小批。所以「满批实测」是误标 —— 仓库里没有满批测量。
- 分支自己的代码注释与这个数字矛盾：`tools/content-exclusion/run.ts:17` ——
  「约 7 条候选的批就要 **1301 输出 tokens**（≈185/条），其中绝大部分是思考」。
  若思考 tokens 计费（是的；CLI 累加 `completion_tokens`，`cli.ts:196-202`），
  总输出可能是计划的 1.7M 的 2–6 倍（例如 2882 × ~1301 ≈ 3.7M）。
- spec §11 明确说该估算**不可信**，并「建议先跑 `--layer same --limit 20` 标定单批实际 token
  与耗时，再外推」。计划（Task 2）丢掉了这一步，改成「复述已实测的标定数字」。

为什么重要：Task 2 是花钱门。用一个被分支自己的注释否定的数字去批准，可能带来数倍于预期的超支。
修法：Task 2 应跑一次小标定（如 `--layer cross --limit 200`，它才会产出 40 条候选的批），
读 CLI 的真实用量行（`cli.ts:231-234`）后再外推。

**C3. 计划里每个分层批数都错了，而且加起来不等于计划自己写的总数。** `plans:95`（same「约 162 批」）、
`plans:128`（cross「约 1,210 批」）、`plans:158`（neighbor「约 1,355 批」）vs `plans:22`（「批数 2,882」）。

用生产 `batchPairs` 算出的真实值：

| 层 | 计划 | **实测** |
|---|---|---|
| sameBlock | ~162 | **363 批待判**（空账本起算 371） |
| crossBlock | ~1,210 | **1,395** |
| neighbor | ~1,355 | **1,572** |
| 合计 | (162+1210+1355 = 2,727) | **2,882** ✓ |

`batchPairs` 按目标题分组、40 一批，所以某层的批数 ≈（该层目标题数）+ 溢出批，而不是 `对数/40`。
sameBlock 的最大批只有 **24** —— 第一层永远没有满批。
为什么重要：Task 2/3/4/5 各自告诉执行者一个预期；三个预期全错（第一层差 2.2 倍），
派生出的分层 token 估算（0.2M / 1.6M / 1.8M）继承了这个错误。执行者会以为跑坏了。
修法：用 363 / 1,395 / 1,572（并解释 2,727 ≠ 2,882）。

**C4. Task 2 不是计划所称的「硬花钱门」——后面有三处会不经新批准就花钱。** `plans:17`
（「花钱的步骤必须单独批准：Task 2 拿到实测数字后停下等用户点头」），对比：
- `plans:106`（Task 3 Step 2）：「远高于 20% … 回炉 prompt 负例并升 `JUDGE_VERSION` 重跑」（整层重跑）。
- `plans:198`（Task 6 Step 3）：「<90% → 升 `JUDGE_VERSION` … **全量重判（三层都要）**」—— 这会让总花费翻倍。
- `plans:241`（Task 7 Step 4）：「`pnpm content:exclusion --judge` 补判」。

为什么重要：用户批准约 3.7M/1.7M 一次，之后可能被无二次门地收 2 倍（或更多）费用，
而这些失败路径恰恰是最可能触发重跑的。修法：把每次重跑标成需要重新、显式批准，并重算预算。

### Important (Should Fix)

**I1. 分支上的 `content:audit` 已经是红的，而计划从未说明。** 在分支上跑
`pnpm content:audit`：退出 **1**，约 108k 条 `未判定` 错误加 `卡文件与账本不一致` 错误
（247 行标定账本已提交，但 `--apply` 从未跑过）。`90fe03c` 自己的提交信息仍称
「content:audit … 通过（CI 绿）」—— 那在 `f577f35` 时为真，账本落地后为假。
`.github/workflows/content.yml` 在 PR 到 `main` 时跑 `content:audit`。执行者跑 Task 1
（`plans:38-45`）会看到红的 audit，可能以为分支坏了；Task 9 Step 4 的「开 PR」在 Task 7 前是 CI 红的。
加一条明确的「分支在半途；`content:audit` 按设计在 Task 7 Step 4 前是红的」说明。

**I2. 计划自己的提交节奏与严格闸门的理由矛盾。** spec §13 与 `checkExclusion` 的注释
（`exclusion.ts:368-372`）用「账本要三层判完才提交，CI 看到的账本一定完整」来论证
「严格 = 不给整层开例外」。但计划**每层判完就提交账本**（`plans:113,143,173`）。
要么闸门的理由错，要么逐层提交错；照现状，中间三个提交是 audit 红的，而陈述的理由是假的。

**I3. 闸门自己的修复提示是一条无效命令。** `exclusion.ts:435` 打印
`（content:exclusion --judge --layer ${layer}）`，其中 `layer ∈ {sameBlock, crossBlock, neighbor}`，
而 CLI 只接受 `same|cross|neighbor`（`cli.ts:72-80`）。实测：
`pnpm content:exclusion --judge --layer crossBlock` → `--layer 只接受 same / cross / neighbor` + 退出 1。
三条 audit 警告里的两条（以及 `--report` 里的同一字符串）会把执行者指向一条必然失败的命令。
在 `exclusion.ts` 里修（层名 → CLI 取值映射）或在计划里写明映射。

**I4. 墙上时间声明彼此差约 7 倍。** `plans:21` 说「约 2–3 秒/批」；`plans:76` 说「约 50 分钟」；
`plans:95/128/158` 说 3 / 22 / 25 分钟。并发 20 下，2,882 批 × 2.5 秒 ÷ 20 ≈ **6 分钟**，
而「50 分钟」意味着 **~21 秒/批**。各 Task 的分钟数都符合 21 秒模型，所以「2–3 秒/批」是那个异类
（或整套时间模型都错）。用户的批准包含「约 50 分钟」这个承诺 —— 改掉错的那个。

**I5. `--judge` 的落盘是全有全无、且非原子。** `cli.ts:214-226` 等**全部**批跑完，然后单次
`writeFileSync(LEDGER_FILE, …)`。一次 25 分钟、约 1,800 次调用的 neighbor 跑，若中途
Ctrl-C / OOM / 断连，会丢掉**整层**的花费 —— 计划的「重跑同一条命令即可补齐（幂等）」
（`plans:96`）只覆盖批失败那条路径，而那条是先落盘的。另外 `writeFileSync` 非原子，
写的时候被杀会留下被 `parseLedger` 拒绝的截断账本（`exclusion.ts:161`），把工具锁死到从 git 恢复为止。
修法：每 N 批落一次盘（临时文件 + rename）。

**I6. Task 8 Step 2 是字面占位符** —— `plans:267`：
`pnpm exec tsx --env-file-if-exists=.env.local -e "..."   # 或直接 psql`。没有可运行的断言。
这直接与 Self-Review 的「Placeholder scan：无 TODO/TBD」（`plans:339`）矛盾。给出具体的一行
（`-e` 形式可用 —— 已验证 —— 但需要 `--input-type=module` 或 async IIFE；具体怎么写很关键），
或者给 psql 形式。

**I7. Task 8 Step 4 给了 SQL，却没说怎么在生产上跑。** `plans:281-287` 只给了一句裸 `select …`，
没有 `psql`/`ssh` 调用，而计划其他地方都非常具体。另注：它**改动了 AGENTS.md 的规范摘要**
（多纳入 `exclude_as_distractor_for`）—— 这是好事，但计划应明说，免得执行者拿它跟 AGENTS.md
里的配方比。（本地摘要现为 `2d5eea4be6ad19a47b7699fe13054a34`。）

**I8. Task 7 Step 2 的「触线」应急预案没有边界，而且只在全部花完之后才发现。**
用**只有** 18 条 yes 的标定账本跑 `--apply --dry-run` 就已经报 **2 张触线**
（`01M2YHWH5R70FFC6TGAN0VP7ZS` 11/12、`01M3KH6MGE6EHRDCH6S3HP1A64` 10/12，都是 `enumeration`）并退出 1。
三层判完后这个数字可能到几十，而「正确修法是改内容（给块补卡、或把题干改到答案封闭）」
是最后一步砸到执行者头上的、未计划的内容工作。计划应现在就暴露（连同已观测到的 2 张）、
给出决策流程，并指出修它可能让刚买来的判定失效（改题干 → 指纹过期 → 重判 → 更多花费；见 C4）。

**I9. Task 9 Step 4 的「直接 ff 合并」不可能。** 实测：
`git merge-base --is-ancestor main feat/content-exclusion` **失败** —— 本地 `main` 在 `544a8f0`
（本次计划文档那次提交，领先 `origin/main`=`abc2931`），它不是分支的祖先。纯 ff 会报错。
另外 `plans:15`（「main 现为 abc2931」）对本地仓库是错的，且 `git diff --stat main..feat/content-exclusion`
（Task 1 Step 2）显示 **23 个文件，含一份 347 行删除（本次计划文档）** —— 对一个「3 提交、20+ 文件」
的预期来说令人困惑。

**I10. 「验收标准 … 当前 92 文件 / 774 用例」不准，且套件在负载下不稳。** `pnpm test` 报
**92 文件 / 776 用例**（774 通过，2 失败）。这 2 个失败是 `tests/server/variant-align.test.ts`
在分支默认 5000ms 下、并行负载中超时；单独跑 692ms 通过。所以「`pnpm typecheck && pnpm test` 全绿」
在忙碌机器上会偶发失败 —— 值得加一句（「单独重跑失败用例；它们是负载超时，不是回归」）。

**I11. `--apply` 会静默抹掉手工登记（置位语义）。** `applyExclusionsToRaw` 把
`excludeAsDistractorFor` **替换**成账本投影，不是并集。今天 `content/` 里**有 0 个非空值**
（grep 验证），所以现在不会丢东西 —— 但计划应说明这个不变量（「上线后手工改动必须走账本，
否则 `--apply` 会删掉它们」），以及那 247 行标定账本的 18 条 yes **还不在磁盘上**，
所以过早 `--apply`（或 `git stash drop`）会制造不一致。另外 `--apply` 在线性集合意义上是对的，
但 diff 不是（见 C1）。

**I12. Task 1/Task 7 没有告诉执行者区分「闸门失败」与「内容规则失败」。** Task 7 之后，
`content:audit` 应打印 `内容审计通过`；我验证过**当前**的失败全部来自新的 exclusion 闸门
（消息都是 `未判定（…）` / `卡文件与账本不一致`），所以没有潜伏的无关内容规则错误。
但计划应加一条：「若 audit 仍失败，先分类：exclusion 闸门消息 vs 内容规则消息（承载词/序号/配对）
—— 后者不是本计划的事」。

### Minor (Nice to Have)

- `plans:106` 预测 sameBlock「是」率为「5–7%」；已提交的标定是 **7.3%**（18/247）。
  改为「标定样本 7.3%（18/247）」。
- `plans:76` 的 3.75M 输入是**上界**（它把满批的 1.3K 套到全部 2,882 批上，而 sameBlock 批平均
  17.5 条候选、没有一个满批）。作为保守预算没问题；写明即可。
- Task 8 Step 3 的 `rsync` 省了 `--delete`，与 `docs/deploy.md:46` 不同。对新增无害，
  但将来删卡不会同步到生产；刻意说明这个偏离。
- Task 9 Step 1 只裁定了 `stash@{0}`；`stash@{1}`（「越界改动的 content 两张卡」）也还在，未裁定。
- `plans:341` 在「名字与实现一致」的自检里列了 `--prune --yes`；实际命令面是 `--prune [--yes]`
  与 `--layer same|cross|neighbor`（不是 `sameBlock`…）。措辞问题，但与 I3 是同一处层名混淆。
- Task 2 Step 3 的「在 content/.exclusion-ledger 的提交信息里写明批准」可行，但账本每次 `--judge`
  都会被重写，所以将来重跑的提交信息不会带上这个记录 —— 把批准记到 spec §13/提交正文里。

## Recommendations

1. **在 Task 2 批准之前**，跑一次真实标定并引用 CLI 自己的用量行：
   `pnpm content:exclusion --layer cross --limit 200`（会产出真正的 40 条候选批）——
   这正是 spec §11 要求、而 Task 2 假装做了的事。用真实数字修 C2/I4。
2. **明确决定 `--apply` 的 churn 政策**（C1）。我建议先来一次专门的「统一 content 格式」提交
   （402 张卡，语义不变，`parseCard` 通过，指纹不变 —— 所以既安全，又让随后的 exclusion 提交可审）。
   若用户不接受 400 文件重排，就把写回改成对 `excludeAsDistractorFor:` 行定点修改。
3. **重写分层预期输出**（C3）为 363 / 1,395 / 1,572 并核对总数。
4. **给每次重跑重新上闸**（C4），并给 `--judge` 加按层检查点（I5），让中途被杀不至于烧掉一整层预算。
5. **给 Task 1 加一段明确的「分支当前状态」前言**：3 个提交、23 文件 diff（含计划文档删除）、
   `content:audit` 按设计是红的、账本已提交 247 行（18 yes）、`stash@{0}` 存在（还有 `stash@{1}`）。
6. 修 `--layer` 提示串（`exclusion.ts:435`），并把 Task 8 Step 2 的占位符换掉。

## Assessment

**照原样执行安全吗？** **With fixes.**

**理由：** 不存在不可逆的数据丢失或未经批准的**自动**花费（账本被保留、`--prune` 未使用、
`--apply` 幂等且不让指纹失效），但照原样执行会（a）在计划承诺「只改变化了的那几张」时
重排 **402/404** 张卡文件 —— 一个巨大、不可审的提交，违反计划自己的 Global Constraints；
（b）用被计划自己引用的标定和 `run.ts:17` 否定的 token/批数去花用户的钱（C2/C3/C4）。
这三条必须在 Task 2 批准前修；I1、I5、I6、I9 应在执行者碰 `--judge`/`--apply`/合并前修。

---

# 报告 B：审实现代码（分支 `abc2931..90fe03c`）

## 验证方式

分支未在此检出，故在头提交上建了一个 detached worktree（`/tmp/rev-exclusion`）加一个 scratch 副本
（`/tmp/rev-lab`，node_modules 软链）—— 未触碰仓库工作区/索引/HEAD/分支，未提交任何东西。
跑了 `pnpm typecheck`（退出 0）与全量套件（**92 文件 / 776 用例，全绿**；初跑有 11 个 PGlite 5s
超时，单独跑通过 = 环境问题）。除阅读外还跑了：把真实 404 卡库过一遍枚举、用合成账本跑
`--apply`（dry + 真实）与 `content:audit`、枚举 vs 运行时的差分 fuzz、全 `no` 账本、
退役卡 / `--prune` 循环、以及写回 diff。

## Strengths

- **枚举/运行时一致性成立，且成立的理由与注释所述一致**。`src/server/queue.ts:42-50` 委托给
  `layers.ts`，`src/lib/content/exclusion.ts:88-115` 精确复刻 `sameBlockPoolOf` 与
  `drawDistractors` 的三重过滤 `eligible`（`src/lib/options/draw.ts:82-85`），含 `ownIds` 撞 id 剔除。
  我写了一个比已提交测试更强的差分 fuzz（按 (target, layer) 比 `${kpId}#${kpText}`，使
  同 id 不同卡的互换无法藏身；覆盖 400 个随机库，含退役要点、跨卡 id 撞车、`categories` 缺项、
  全部 5 种卡型），通过：对每个活的非 `sequence` 目标，枚举 ≡ 运行时。
- **两处看起来像 bug 的不对称是对的。** `sequence` 目标被排除出枚举，但其要点仍进池 ——
  安全，因为 `src/lib/options/prepare.ts:98-131` 在 `drawDistractors` 之前就返回
  （用真实 `sequence` 卡跑 `prepareOptions` 验证 → `distractorKeyPointIds: []`）。
  按全量（不按 `public` 剪枝）枚举是对的（§2.1）：我确认免费层池是枚举的严格子集。
- **枚举在真实内容上精确复现 spec §2 的表**：108,891 对（sameBlock 6,475 / crossBlock 48,307 /
  neighbor 54,109）；`content:audit`（含闸门）约 0.9 秒跑完，所以「秒级」的 CI 声明成立。
- **闭环确实闭合。** 用完整的合成账本：`--apply` → `content:audit` = `内容审计通过`，
  第二次 `--apply` 重写 **0** 张卡（404 卡规模上的幂等）。
  `tests/lib/content/exclusion-e2e.test.ts:86-129` 是真端到端（真 prompt、真解析器、真写回、
  再解析 + 闸门），不是 mock 舞蹈。
- **账本解析器在该报错的地方报错。** 直接探测：空文件、缺头部、缺 `judge=`、重复键、
  非 `yes|no` 判定、字段数不对、缺指纹 → 全部硬错误；CRLF、行尾空白、文件中注释、额外头部字段
  → 容忍；`kp/1`（id 里有斜杠）能往返。
- **`parseLedger`/`judgedEntries` 的索引映射正确**：`batch.ts:174` 按 `batch.pairs.length`
  （而非 `MAX_BATCH`）校验，所以最后一个短批是对的；`judgedEntries` 把 `i+1` 映射到 `pairs[i]`
  （测试 `exclusion-batch.test.ts:65-75` 验证）。
- **`judgeBatches` 不会丢批或重复计数**：预分配 `out`、按下标写、`next++` 交接、`concurrency`
  被夹紧、空输入安全；失败返回 `ok:false` 且 CLI 跳过（`cli.ts:216-219`）—— 与文档所述 fail-closed 一致。
- `auditLibrary` 的池修正（`audit.ts:96-101`）是真的且有测试（`audit-pool.test.ts` 新增），
  且 `--apply` 的池检查比 audit **更严**（它应用 `ownIds`），方向是安全的那一侧。
- **写回在语义上无损**：`--apply` 之后重新解析全部 404 卡并比摘要，每张变化过的卡**只**在
  `excludeAsDistractorFor` 上不同；我分析的那份全库 diff 不含会被丢弃的 YAML 注释/块标量。

## Issues

### Critical (Must Fix)

**C1. `JUDGE_VERSION` 升版后闸门永远无法变绿 —— 而规定的修复手段是空转。**
`src/lib/content/exclusion.ts:235-244`（`pendingPairs`）纯粹按已存指纹判定「是否已判」，
从不看 `ledger.header.judgeVersion`。但 `checkExclusion`（`:391-396`）在头部版本 ≠ `JUDGE_VERSION`
时报错，然后 `tools/content-exclusion/cli.ts:154-159` 会打印 `没有待判定的组合（账本已覆盖）` 并返回。
用真实函数复现：

```
当前代码 JUDGE_VERSION = v1 ；账本头部 = v0
checkExclusion errors = ["账本判据版本是 v0，当前代码是 v1 —— 整体失效，需重跑 content:exclusion --judge"]
pendingPairs（= --judge 的输入）= 0 → CLI 会打印「没有待判定的组合」并直接返回
```

为什么重要：这不是假设 —— 它就是**计划**的恢复路径。计划 Task 6 Step 3：
*「一致率 <90% → 把反例整理进 `JUDGE_GUIDE` 负例，`JUDGE_VERSION` 升到 `v2`，全量重判（三层都要）」*。
今天这一步会以死锁告终：闸门一直报整体失效、`--judge` 拒绝花钱，唯一的出路是
`--prune --yes`（它只删悬空/过期条目 —— 一份完整匹配的账本两者都没有，所以**什么也不删**）
或手改 7.7MB 账本。闸门自己的消息（「需重跑 content:exclusion --judge」）无法被满足。
修法：把版本纳入失效判定，例如
```ts
const versionStale = ledger.header.judgeVersion !== JUDGE_VERSION
return pairs.filter(p => versionStale || <既有条件>)
```
并加测试：把 `ledger.header.judgeVersion` 改掉 → `pendingPairs` 返回全部对。

**C2. 「fail-closed」设计里的 fail-open：全 `no`/全 `[]` 的判定集会产出**绿**的闸门而**零**效果，
且无法重判。**
三块拼起来：
1. `parseJudgeResponse`（`batch.ts:99-123`）接受 `[]` 作为合法、完整的回答（只拒绝**格式错误**的响应）。
   一个撂挑子的模型 —— 或一次 provider/格式回归 —— 每批写入 40 个永久的 `no`。没有任何东西能区分
   「这 40 条都不适用」与「我没作答」。
2. 唯一的人工护栏**只抽 `yes`**（`cli.ts:321-331`、`verdictStatsOf`）。零 `yes` 时验收是空的。
3. 没有重判路径：`--judge` 只判 `pendingPairs`；`--prune` 只删悬空/过期。一套一致错误的判定集
   是**粘滞**的。

在真实库上演示（不用 LLM）：一份 108,891 条、全判 `no` 的账本 →
```
--report --sample 100 → sameBlock 判定 6459/6459 判「是」0（0.0%）… 人工抽检样本（判「是」共 0 条，抽 0 条；一致率 ≥90% 才算验收）:
--apply → 已重写 402 张卡（账本里 0 条「是」判定）
content:audit → 内容审计通过        # grep 结果：1769 x "excludeAsDistractorFor: []"
```
所以这个项目可以花掉约 5M tokens、让 CI 变绿，而它存在的唯一目的 —— 修
`docs/.../2026-10-03-ownership-vs-correctness.md` 里那个生产 bug —— 原样不变。
这正是 §9.1/§5.4 要禁止的「静默漏网」失败模式。部分变体更糟：一次 30% 的批回 `[]`
（长批、模型疲劳）的运行会静默烙下假 `no`，连 `--prune` 都碰不到。
修法（三条都便宜）：把整批空答案视为可疑 → 重试一次（与解析失败同待遇）；要求每层「是」率
高于一个有据可依的下限，`--judge` 才认为该层完成（且 `--report` 应说「判「是」0 条 ⇒ 验收不成立」
而不是打印一份空样本）；加 `--rejudge [--layer]`（或让 `--prune --stale-all --yes` 能删掉
指纹匹配的条目），使一套坏判定集可以不经手改账本而恢复。

### Important (Should Fix)

**I1. `--apply` 在当前内容上跑不了，而它的全有全无拒绝把**真正的**修复扣作人质。**
`cli.ts:283-286` 在任何卡的同块池跌破 `MIN_BLOCK_POOL` 时不写任何东西并退出 1。
在原始内容上实测：**11 张 ready 卡恰好压在下界、零余量**（java/arraylist ×3、java/hashmap ×3、
java/equals-hashcode ×3、mysql/mvcc-undo ×2；`poolMarginsOf` → `同块 12/12 余 0`）。
**已提交的** 247 条标定账本（18 条 yes）就足以触发：
```
$ pnpm content:exclusion --apply --dry-run
! 01M2YHWH5R70FFC6TGAN0VP7ZS [enumeration] 同块 11/12 …
! 01M3KH6MGE6EHRDCH6S3HP1A64 [enumeration] 同块 10/12 …
触线（同块池 < 下界）：2 张；…    EXIT=1
```
约 6,475 组同块对、实测 7.3% 的同块 yes 率下，约 450 条同块登记会落地；
11 张零余量卡全部不触线的概率 ≈ 0.4¹¹ ≈ 2e-4。所以 Task 7 的 `--apply` 会拒绝，
而因为它是全有全无的，真正修用户那个 bug 的**跨块**登记
（设计 §7.2 自己指出跨块/相邻登记不影响 `MIN_BLOCK_POOL`）会被需要补卡的无关块扣住。
消息（「改内容是唯一正确修法」）是对的，但这个耦合过严。
修法：对**同块**伤害保留硬拒绝，但让操作者能投影安全的（仅跨块/相邻）登记 ——
例如 `--apply --allow-touch`（显式、留痕）或两阶段 apply，只写没有跌破下界的卡。
同时纠正 `src/lib/content/pool.ts:28-36` 的注释（「spec §2 定的每块 15-25 题远在这之上，
所以真实块不会撞线；撞线的只有试点这种刻意做小的块」）—— 这在经验上是假的
（5 张卡 × 4 要点的块恰好落在 `T ≥ 12 + k` 上）。

**I2. `--prune` 制造出只有 `--apply` 能清的闸门错误 —— 而 `--apply` 可能被扣住（I1）。**
`projectExclusions`（`exclusion.ts:255-281`）完全忽略 `retiredAt`，而枚举会跳过退役的
owner/target。所以退役一张卡会让它的登记**仍被投影**（闸门绿，只有警告），随后 `--prune`
删掉那些条目 → 退役卡的文件不再与投影一致。在真实内容上退役一张卡后复现：
```
--prune --yes  → 已删除 260 条
content:audit  → 发现 2 个问题：卡文件与账本不一致：卡 01M3NE18CJ0HRAQEQC7FDWQFWT 要点 kp-cs1-1：卡文件 [01M3M59WSFN60YZ9DZ669FESZW] ≠ 账本投影 []   EXIT=1
```
退役卡上的登记在运行时无关紧要，但闸门却逼着重写退役卡的文件 —— 而若任何卡此刻在下界上，
这次重写会被拒绝。修法：要么在漂移检查里跳过带 `retiredAt` 的卡/要点（并让 `--apply` 只清活卡），
要么让 `--prune` 警告必须跟一次 `--apply`（它现在的消息只提了未判定那种情况，`cli.ts:379`）。

**I3. 写回会规范化无关 YAML 而不是保留 —— 403 文件 / 约 13k 无关行，与所述不变量矛盾。**
`applyExclusionsToRaw`（`tools/review/register.ts:66-72`）走 `matter.stringify(..., MATTER_OPTS)`；
`src/lib/content/yaml.ts:20-21` 钉了 `JSON_SCHEMA`（确实修好了 Date 化与加引号问题），
但 js-yaml 仍会规范化既有风格。对比原始与 apply 后的内容：
```
非 excludeAsDistractorFor 的 +/- 行数：13087
含 excludeAsDistractorFor 的 +/- 行数：1490
1752 ± verifiedAt: 2026-09-28        (was '2026-09-28')
 332 ± relatedBlocks: []            (was "relatedBlocks:\n  []")
 235 ± locator: doc                 (was 'doc')
  ... question: "…" → question: …  (quotes removed)
403 个文件被改写
```
我验证过这在**语义上无害**（apply 后重新解析全部 404 卡：每张变化过的卡只在
`excludeAsDistractorFor` 上不同），且既有的 `registerDecision` 有同样的行为 ——
所以这不是回归，而是共享 writer 一个未被说明的性质，`--apply` 把它从「每次动作 1 张卡」
放大到了整个库。它与 `src/lib/content/yaml.ts:11-13`（「写回时必须与读入格式一致…让 diff
失去可读性」）、`register.ts:49-55`（「diff 只显示真正新增」）、CLI 的「其余卡文件逐字节未变」
以及计划 Task 7 Step 3 的验收标准（「git diff 只含 excludeAsDistractorFor 的增行，其他字段零改动」）
都矛盾。影响：内容生产中途一次 403 文件机械重排（与并行内容工作产生合并冲突），
以及一份把真正重要的 1,490 行藏起来的评审 diff。
修法：二选一并说出来 ——（a）按行定点修改（只替换被触及要点的 `excludeAsDistractorFor` 行）；
（b）接受一次性规范化、写进 `yaml.ts`/AGENTS.md 文档，并加测试钉住（见 T2），使它不会悄悄变大。

**I4. `--judge` 只在每批都跑完后写一次账本 → 中断或崩溃会毁掉整次付费运行。**
`cli.ts:216-226`：`writeFileSync` 在 `await judgeBatches(...)` 之后。一次 25 分钟、约 1,350 次调用的
层跑若在 90% 处被 Ctrl-C、OOM 或断网杀掉，什么都记不下；重试要再付一次。
修法：每 N 批落一次盘（例如 50 批把 `outcomes` 折进内存账本），加 SIGINT 处理器落盘并退出。
另注：`onOutcome` 抛错会让 `Promise.all` reject 而完全跳过写盘（它今天不会抛，但
`runJudge` 的 catch 会把它转成彻底损失）。

**I5. 已提交的部分账本让本提交的内容闸门是红的，违背 spec 自己的规则。**
`content/.exclusion-ledger` 有 247 条 / 需 108,891 条，所以 `pnpm content:audit` 在头提交上退出 1
（80 条分组错误）。`pnpm typecheck && pnpm test` 是绿的，所以 AGENTS.md 所述验收标准满足 ——
但 spec §13 说*「账本三层判完才提交，CI 看到的账本一定完整」*，而计划把全量判定（Task 3-5）+
apply（Task 7）排在合并（Task 9）之前。分支与提交信息里都没有标注这个账本是「仅标定、不得单独合并」：
`.github/workflows/content.yml` 在**推送到 main** 时无条件跑，所以一次误合并会让 main 对后续每个 PR 都变红。
修法：要么不提交标定账本（留本地 / 加 `.gitignore` / 加 `-calibration` 后缀），要么把「Task 7 前不得合并」
写进提交正文 / AGENTS.md。

### Minor (Nice to Have)

**M1. `pairKey` 不转义 `|`，所以 writer 能写出自己读不回的账本。** `exclusion.ts:53-55` 用 `|` 连接，
而 `parseLedger`（`:189-193`）要求恰好 4 个 `|` 字段；`id: z.string().min(1)`（`schema.ts:28`）允许 `|`。
探测：`kp|1` → 序列化成功，再解析 `字段数不是 4` → `content:exclusion` 随即退出 1（`cli.ts:115-118`），
包括那次刚为这些判定付过钱的运行。id 都是第一方的，所以不常见，但失败形式是
「先花钱，再把账本弄成砖」。修法：在 `pairKey`/`serializeLedger` 里断言/编码
（拒绝 `|`、`\n`、以 `#` 开头的 id —— 以 `#` 开头的卡 id 会被 `parseLedger:171-187`
静默当注释吞掉并永远重判）。

**M2. `finish_reason === 'length'` 只在 `content` 为空时才被诊断**（`run.ts:72-86`）。
一个**被截断但非空**的数组（很可能，鉴于标定发现 7 条候选就要 1,301 输出 tokens）会返回部分文本
→ 解析失败 → 操作者看到 `响应里没有 JSON 数组`，截断提示丢失，浪费一次重试。
修法：在返回之前检查 `finish_reason`（或把截断提示附到抛出的解析问题上）。

**M3. 死 import。** `src/server/queue.ts:2` 在重构移除使用后仍 import `neighborCategoryOf`
（`tsc` 通过是因为 `noUnusedLocals` 关着）。

**M4. `provider.maxTokens` 被忽略**：`run.ts:56` 用的是 `JUDGE_MAX_TOKENS` 常量，
所以天花板低于 8,000 的 provider 会收到无效的 `max_tokens`；另外 `...provider.extraBody`
被展开在 `model`/`stream`/`max_tokens` **之后**（`run.ts:52-58`），所以未来的 provider 配置
可以静默覆盖它们。修法：默认用 `provider.maxTokens ?? JUDGE_MAX_TOKENS`，并把 `extraBody`
展开在显式字段之前。

**M5. provider 省略 `usage` 时用量统计会偏。** `cli.ts:196-202` 在 `onUsage` 回调里
`calls++`，而 `run.ts:66` 只在 `usage` 存在时才调用它 → 打印的「均 X/Y 每批」除以的次数
少于实际调用数。修法：在 scorer 里计数，而不是在 usage 回调里。

**M6. `poolMarginsOf` 的 `?? fallback`（`exclusion.ts:316-317`）意味着当文件已与账本漂移时，
`--apply --dry-run` 并不精确等于落盘后的状态**（它仍把一个陈旧的卡文件登记算作排除）。
今天偏保守（干净状态下 fallback 是 `[]`），但 docstring 的「= 将要落盘的状态」只在库未漂移时为真。

**M7. 同一张卡内重复的要点 id 会在 `judgedEntries` 里静默坍缩**
（`batch.ts:131-137` → `base.entries.set` 覆盖），而 `parseLedger` **拒绝**重复 ——
且 `enumerateCandidatePairs` 的比较器（`:113`）对相等键不一致。在合法库里不可达
（`audit.ts:49-60` 对块内重复 id 报错），但工具的两半对「这算不算错误」意见不一。

**M8. `--prune` 不带 `--yes` 时打印破坏性操作警告后退出 0**（`cli.ts:371-375`），
所以脚本化调用看起来成功而实际什么也没做。

## 测试质量（实际被覆盖的，与缺口）

真实、行为级、值得保留的：`exclusion-e2e.test.ts`（完整闭环、再解析 + 闸门 + 幂等）、
`exclusion.test.ts`（手搭夹具上的闸门/过期/投影/池余量）、`exclusion-batch.test.ts`
（解析拒绝矩阵、重试/fail-closed、并发顺序）、`audit-pool.test.ts`（退役要点修正）。

**T1. `tests/server/exclusion-parity.test.ts:82-88` 每层只比要点 *id*。**
运行时的池丢掉了 owner 身份，所以同 id 不同卡的互换不可见；夹具也没有 `sequence`
与退役**卡**，所以最要紧的两个声明（「目标侧排除 sequence」在别处被锁；
「退役卡进不了池」在这里没被测）根本没被这个 parity 测试锁住。我的 id#text fuzz 跑了 400 个库
全部通过，所以没有活的分歧 —— 但测试写得比它宣称的性质弱。建议比 `id#text`，加 `sequence` +
退役卡夹具，并加注释说明等价性依赖「`all` 只含活卡」（即 `loadAllCards` 的 `retired_at is null`
是承重的 —— `buildDistractorPools` 自己**没有**退役卡过滤；我验证过把退役卡传进去
**确实**会造出账本永远看不到的池条目）。

**T2. `tests/tools/review-register.test.ts:144-152`（「无关字段不被改写」）太弱，抓不到真实行为**
—— `toContain('verifiedAt: 2026-09-18')` / `toContain('url: …')` / `not.toContain('T00:00:00')`
在 13k 行引号风格/流式风格重写发生时全都通过（I3）。`tests/tools/review-register.test.ts:90-95`
的旧测试同样弱。建议断言**diff**：在一个含 `'2026-09-28'`、`relatedBlocks:\n  []` 与带引号
`question` 的夹具上 apply，断言变化行的集合等于预期的 `excludeAsDistractorFor` 行。

**T3. `tests/lib/options/layers.test.ts:9-21` 两次断言 `[...values].sort()`**
（`FILE_ORDER` 与 `DB_ORDER` 是手写 map，不是真实的文件/DB 序），所以它钉住了规则、
但没钉住 spec 要求的那个危险（「加一条守卫测：文件序 == 规则序」）。更强的守卫：
断言 `queue.ts` 的分层是 `layers.ts` 的纯函数（即运行时没有第二份规则）—— 这正是重构达成的。

**T4. `tests/tools/content-exclusion-run.test.ts:43`** 用一个 `maxTokens` 也是 8000 的 stub provider
断言 `max_tokens === JUDGE_MAX_TOKENS` —— 该断言无法区分「常量」与「provider 字段」（见 M4）。

## Recommendations

1. **花任何钱之前：**修 C1（`pendingPairs` × `JUDGE_VERSION`）与 C2（空 `[]` 重试 + 非零 yes 的
   健全性闸门 + 重判路径）。C2 是「CI 绿、零效果」与「真正修复」之间的分界；C1 破坏计划自己的恢复步骤。
2. 加 `--rejudge [--layer|--all]`（或显式 `--prune --stale-all --yes`），使一套错误/过期的判定集
   可通过 CLI 恢复；今天唯二的出路是手改 7.7MB 文件或删掉它。
3. 明确决定 I1（这是偏用户侧的判断，如计划 Task 1 的决策 #1）：要么接受「先扩充约 11 个块再 apply」
   作为前置闸门，要么加显式 `--allow-touch` 逃生口，让跨块登记不被无关的同块下界扣住。
4. 增量落盘 + SIGINT 处理器（I4），在 25 分钟的层跑之前。
5. 让写回路径诚实：要么按行定点修改，要么把规范化记为已接受并用 diff 级测试钉住（I3/T2）。
6. 纠正两处已被证伪的说法：`src/lib/content/pool.ts:28-36`（「真实块不会撞线」）与
   spec §13 / 计划的步骤顺序（「账本三层判完才提交」vs 已提交的 247 条账本，I5）。
7. 考虑一个小型「判据自测」批（`--judge --layer same --limit 20`，断言 §3.1 的四条校准用例
   得到预期判定）—— 设计目前没有任何自动手段能察觉判据语义发生了移动。

## Assessment

**可以继续吗？** **With fixes.**

**理由：** 核心引擎是健全的 —— 枚举/运行时一致性、账本解析/序列化、投影、幂等写回与 CI 闸门
都在真实 404 卡库上验证正确（我复现了 108,891 对、apply→audit 绿、第二次 apply 0 写入、
0 语义漂移），且 typecheck + 776 测试全绿。但有两个 Critical 必须在付费判定跑之前修：
升 `JUDGE_VERSION` 会让闸门永久不可恢复（C1），以及全 `no`/`[]` 的判定集会产出一份绿色、
零效果的账本而没有任何 CLI 命令能修复（C2，已演示：`内容审计通过` 而 1,769 ×
`excludeAsDistractorFor: []`）—— 外加一个待决的阻塞项（I1：`--apply` 在当今内容上已经拒绝）。

证据产物（scratch，仓库之外）：`/tmp/content-md.diff`（403 文件写回 diff）、
`/tmp/lab-test2.log`（全量套件，776 通过）、`/tmp/lab-typecheck.log`、
`/tmp/lab-margin.ts`（零余量卡清单）、`/tmp/lab-version.ts`（C1 复现）、
`/tmp/lab-writeback.ts`（规范化复现）、`/tmp/lab-semantic.ts`（语义等价证明）、
`/tmp/lab-ledger.ts`（解析器健壮性矩阵）。
