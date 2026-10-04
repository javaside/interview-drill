# excludeAsDistractorFor 落地执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `excludeAsDistractorFor` 从「全库为空（0 / 1769）」推到「三层候选对全部判定并生效」——用户按题意勾兄弟题的真话不再被判错。

**Architecture:** 两阶段（判定 / 投影）已在 `feat/content-exclusion` 分支实现：`--judge` 调 LLM 写账本（烧钱、不碰卡文件），`--apply` 从账本重写卡文件（零成本、幂等），`content:audit` 做闸门（未判定 / 指纹过期 / 卡文件与账本不一致 = 红）。本计划执行的是**数据落地**：格式统一 → 标定 → 三层判定 → 抽检 → apply → 入库 → 收尾。

**Tech Stack:** TypeScript / tsx CLI / DeepSeek（deepseek-flash）/ vitest / PostgreSQL（本地 + 生产）

**Spec:** `docs/superpowers/specs/2026-10-04-exclude-as-distractor-for-design.md`（§13 是实施记录）
**独立评审记录:** 本计划经两名 subagent 评审后重写；被采纳的发现记在 Task 1 / 各步的括号里。

## Global Constraints

- 代码在 `feat/content-exclusion` 分支，**不在 main 上改**。
- **验收标准：`pnpm typecheck && pnpm test` 全绿**（基线 92 文件 / **784** 用例）。
- **花钱的步骤必须逐次批准**：Task 2 拿到实测数字后停下等用户点头；**任何重判（`--rejudge`、升 `JUDGE_VERSION`、失败重跑成规模时）都要重新获批**。
- `content/` 是权威源，DB 是它的投影——**本地库与生产库都要跑 `content:upsert`**，否则两边漂移。
- 账本 `content/.exclusion-ledger` 是判定状态的**单一来源**；`--judge` 幂等（已判定跳过）、**增量落盘**（每 25 批 + SIGINT）。
- 判定阶段**从不碰卡文件**；卡文件只由 `--apply` 改，且只写真正变化的那几张。
- **陷阱：`pnpm content:upsert` 读不到 `.env`**（AGENTS.md 高频坑 2）——必须用
  `pnpm exec tsx --env-file-if-exists=.env.local src/server/content-upsert/cli.ts`。
- 每次 commit 后 `git status` 必须干净（本项目有个未跟踪的 WIP 文件夹 `src/lib/content/overlap.ts`，
  已在 `stash@{0}`；**别再引入未提交文件**）。

## 执行前的现状（2026-10-04 实测，执行者先读这一段）

| 项 | 事实 |
|---|---|
| 分支 | `feat/content-exclusion`，基准 `abc2931`；5 个提交（工具链 / AGENTS.md / 计量诊断 / 计划 V1 / 评审修复） |
| main | `main == origin/main == abc2931`（实测 `git rev-parse` 两者相同），是分支的直接祖先 → **可以 ff**。V1 计划那次提交 `544a8f0` 是**悬空提交**（不在任何分支上） |
| 三层候选对 | 108,891（同块 6,475 / 跨块 48,307 / 相邻 54,109），目标题 371 |
| 账本 | 247 条（标定跑的，判「是」18 条）——**远未完成** |
| 卡文件登记 | **0 条**（1769 个字段全空） |
| `content:audit` | **红**（账本不全 = 闸门报错）。这是闸门在正确工作，不是坏了 |
| 零余量卡 | **11 张**的同块池恰好等于下界（java/arraylist ×3、java/hashmap ×3、java/equals-hashcode ×3、mysql/mvcc-undo ×2）→ 任何一条同块登记都会让它们触线 |
| 免费口径池 | **65 张**卡的「跨块+相邻」公开池为 **0**（免费用户抽不到干扰项时会走 neighbor，仍不足则抛「池枯竭」） |
| 已知会触线的卡 | 仅凭标定那 18 条「是」就已有 2 张跌破下界：`01M2YHWH5R70FFC6TGAN0VP7ZS`（11/12）、`01M3KH6MGE6EHRDCH6S3HP1A64`（10/12） |

## 成本实测量（2026-10-04 标定，**上限不确定，Task 2 必须用真实小样复核**）

- 满批（40 条候选）实测：输入 **1,280–1,352** tokens、输出 **267–581** tokens、**1.9–3.1 s/批**（单发）。
- 但并发 20 下实测吞吐方差极大：35 批耗时 37 s（≈1 s/批），另一次 200 批约 45 s（≈0.2 s/批），
  而单发满批只要 2–3 s —— 差异来自服务端限流。**别拿单发延迟外推总时长。**
- 分层跑的批数（`batchPairs` 按目标题分组切 40；**分层会让同一目标题在各层各切一次**，所以比不分层多）：

| 层 | 批数 | 候选数/批 | 估输入 | 估输出 |
|---|---|---|---|---|
| sameBlock | **363** | 8–24（**永远不满批**） | ~0.31M | ~0.10M |
| crossBlock | **1,395** | 1–40 | ~1.86M | ~0.56M |
| neighbor | **1,572** | 1–40 | ~2.04M | ~0.63M |
| 合计（分层跑） | **3,330** | | **~4.2M** | **~1.3M** |

> 不分层一次跑完是 **2,882** 批（同一目标题的候选合在一起切块），比分层省约 13% 的批——
> 代价是丢掉「按层验收」和「按层看「是」率漂移」的能力。**本计划选分层**（spec §5.2 的要求）。

---

### Task 0: 统一卡文件 YAML 格式（**必须单独提交**）

**为什么必须先做**：写回走 `matter.stringify`，而真实卡文件是「`relatedBlocks:` 换行 + `[]`、
日期带单引号、`question` 带双引号」的风格。独立评审实测：`--apply` 会把 **403/404 张卡、
约 1.3 万行与互斥登记无关的改动**混进同一个 diff。先单独统一格式，后续 `--apply` 的 diff 才只剩真实登记。

**Files:** `content/**/*.md`（预计约 400 张）

- [ ] **Step 1: 干跑看规模**

```bash
git switch feat/content-exclusion
pnpm content:exclusion --normalize --dry-run
```

Expected: `格式统一的卡：N / 404`（实测 N≈400）。

- [ ] **Step 2: 落盘**

```bash
pnpm content:exclusion --normalize
```

- [ ] **Step 3: 证明语义零变化**

```bash
pnpm typecheck && pnpm test
pnpm content:audit 2>&1 | grep -c "excludeAsDistractorFor"   # 应为 0（没有任何登记内容）
git diff --stat content/ | tail -1
```

Expected: typecheck 干净、全量测试全绿；`content:audit` **不新增**任何消息 —— 它本来就红：
既有 108k 条「未判定」+ **18 条「卡文件与账本不一致」**（标定账本里那 18 条「是」还没 apply 过）。
判定口径是本步前后错误条数一致（格式改动不引入新的内容错误）。
另：`--normalize` 是幂等的（再跑一次 0 张变化）——已实测。

- [ ] **Step 4: 单独 Commit**

```bash
git add content/ && git commit -m "$(cat <<'EOF'
chore(content): 统一卡文件 YAML 格式——为互斥登记让出一个可审的 diff

写回走 matter.stringify，真实卡文件的 relatedBlocks 换行写法 / 单引号日期 /
双引号 question 都会被重排。若不先单独做这一步，接下来那次 --apply 会把
约 1.3 万行格式改动与真正的互斥登记混在一个 diff 里（403/404 张卡）。

语义零变化：--normalize 把文件现状喂回同一个 writer，只让 YAML 引擎重排格式；
typecheck + 784 用例全绿，audit 无新增错误。幂等（二次执行 0 张变化）。
EOF
)"
---

### Task 1: 评审既有实现与三处偏离（人工门，不写新代码）

**为什么有这个 Task**：这批实现是在「以为设计已批准」的前提下直接写进 main 的（已移回分支）。变成数据落地之前必须逐条过一遍。**独立评审已跑过一轮**（一名审计划、一名审代码），下表是裁决项 + 评审结论。

- [ ] **Step 1: 摆出三处偏离，逐条等用户裁决**

| # | 偏离 | 原设计文字 | 实际实现 | 我的建议 |
|---|---|---|---|---|
| 1 | 闸门严格度 | §7.1「任一组未判定 → 构建失败」，§5.2 又要求分层推进 | **按 §7.1 字面执行**（严格）；未扫过的层也报错，另给「该层尚未扫过」的警告 | **接受严格** —— 为「整层漏判」开例外会给漏判留静默口子 |
| 2 | `MIN_BLOCK_POOL` 位置 | 在 `audit.ts` | 挪到 `src/lib/content/pool.ts`，`audit.ts` 原样再导出 | **接受** —— 池下界有两个消费者，留在 audit 会成为 audit ↔ exclusion 环 |
| 3 | overlap WIP 处置 | §8「以 exclusion 为唯一枚举器、单一账本」，需用户点头 | 未删，收进 `stash@{0}`（可恢复）；三层枚举与闸门语义已被吸收 | **保留在 stash**（涉及用户未提交成果） |

- [ ] **Step 2: 评审已修复的问题清单（照实核对，别重犯）**

两轮评审的原始报数：**第一轮（审计划）Critical 4 / Important 12 / Minor 6；第二轮（审代码 + 验修复）
Critical 2 / Important 5 / Minor 8 / 测试加固建议 4**（两轮条目有重叠，下表按**修复动作**归并成 13 行）。**均已在分支上修掉**：

| 评审发现 | 修法 | 验证 |
|---|---|---|
| **C1** 升 `JUDGE_VERSION` 后闸门永远修不好：`pendingPairs` 不看版本 → `--judge` 说「没有待判定的组合」，而闸门一直说「整体失效」 | `pendingPairs` 把版本纳入失效；新增测试断言「版本不一致 → 全部待判」 | `tests/lib/content/exclusion.test.ts` |
| **C2** 全 `[]` 判定 → 闸门变绿、零效果、且**不可恢复**（没有重判通道） | 空答案重试一次 + `emptyAnswer` 计数与告警；`--report` 遇 0 条「是」直接报「验收不成立」；新增 `--judge --rejudge` 恢复通道 | `exclusion-batch.test.ts` / CLI |
| **C3** `--apply` 会重排 403/404 张卡（格式 churn） | 新增 `--normalize` 模式，把格式统一拆成 Task 0 单独提交；并用 diff 级断言把行为钉住 | `tests/tools/review-register.test.ts` |
| **C4** Task 2 不是唯一花钱门：后面几处重跑没有闸门 | 本计划每处重跑都标注「需重新批准」；`--rejudge` 打印烧钱警告 | 计划本身 |
| **I1** `--apply` 一有触线就整体拒绝 → 连「修用户那个 bug」的跨块登记也落不了盘 | 新增 `--apply --allow-touch`（显式、打印代价：闸门会红到内容补完）；默认仍严格拒绝 | CLI |
| **I2** `--prune` 在退役卡上制造闸门错误 | 投影一致性检查跳过退役卡/退役要点；`--apply` 不再改写退役卡 | `exclusion.test.ts` |
| **I3** 闸门打印的修复命令用了 CLI 不认的层名（`crossBlock` vs `cross`） | 引入 `CLI_LAYER` 映射 | 手工实测 |
| **I4** 长跑中断丢整层的钱（只在全部结束后写账本，且 `writeFileSync` 不原子） | 每 25 批增量落盘 + 临时文件 rename + SIGINT/SIGTERM 兜底 | CLI |
| **M1** id 含 `|` 或行首 `#` → 账本写得出、读不回（发现时机是花完钱之后） | 闸门提前拦截 | `exclusion.test.ts` |
| **M2** 截断只在正文为空时才诊断 | `finish_reason === 'length'` 一律作废（正文不完整同样危险，少掉的编号会被静默记成 `no`） | `content-exclusion-run.test.ts` |
| **M3/M4/M5/M6** 死 import、忽略 `provider.maxTokens`、用量计数分母错误、`poolMarginsOf` 注释过头 | 逐条修 | 测试 + typecheck |
| **C5**（第二轮审代码时实测）版本失效的恢复路径会 **fail-open**：`flush()` 每次落盘都把头部写成当前版本，而有批失败/用过 `--limit` 时账本里留着旧版本的判定 → 闸门报 0 错、静默通过 | 新增 `discardStaleVerdicts`：判定开始前发现版本不一致就**丢干净**（旧判定按定义无效），缺条目即为「未判定」；测试直接复现「同一场景下未丢弃时闸门静默通过、丢弃后报未判定」 | `exclusion.test.ts` |
| **M7**（第二轮）计划文档的 git 现状写错（称 main 领先 origin/main、ff 不成立） | 实测：`main == origin/main == abc2931`，**可以 ff**；已改正（本表上方与 Task 9） | `git rev-parse` |

- [ ] **Step 3: 确认没有残留的未修项**

```bash
pnpm typecheck && pnpm test
pnpm content:exclusion --apply --dry-run      # 只读，看触线与免费池现状
```

Expected: 784 用例全绿；dry-run 打印 2 张触线（标定账本口径）与 65 张免费池为 0（exit 1 是设计如此）。

- [ ] **Step 4: 用户说「可以」才继续**

---

### Task 2: 真实标定 + 预算批准（人工门）

**为什么不能照抄上面的估算**：那 4.2M/1.3M 是从 3 个满批样本外推的，而评审指出「输出可能是它的 2–6 倍」
（早期小批实测 7 条候选就要 1,301 输出 tokens，思考占大头）。**先花几毛钱把系数测准。**

**Files:** `content/.exclusion-ledger`（标定会写进账本，属正常累积）

- [ ] **Step 1: 小样标定（约 10–20 批，成本可忽略）**

```bash
pnpm content:exclusion --judge --layer cross --limit 200 --concurrency 10
```

这一档会切出**真正的满批（40 条）**，读结尾那行真实用量：

```
用量（含失败重试）：输入 X tokens、输出 Y tokens（N 次调用，均 A / B 每批；单批峰值 P / Q）
```

- [ ] **Step 2: 外推并把数字交给用户**

用 `A`（均值输入）与 `B`（均值输出）乘 3,330 批，得出总输入/总输出；再用实测吞吐给出时长区间。
**任务产出 = 用户对「约 X 输入 / Y 输出 tokens、Z 分钟」的明确批准。**
未获批准不得进入 Task 3 的其余部分（`--limit` 之外）。

- [ ] **Step 3: 记录批准**

在 Task 3 的提交信息里写明「用户 YYYY-MM-DD 批准全量判定」，**不要只写在账本里**
（账本每次 `--judge` 都会被重写，注释不保）。被否决 → 计划终止于 Task 1，工具留在分支备查。

---

### Task 3: sameBlock 层判定（363 批）

**Files:** `content/.exclusion-ledger`

- [ ] **Step 1: 跑**

```bash
pnpm content:exclusion --judge --layer same --concurrency 20
```

Expected: 363 批、候选数/批 8–24（**这一层永远不满批**，别以为跑错了）；结尾打印每层进度与真实用量。
中途 Ctrl-C 也安全：已完成的批已落盘，重跑同命令从断点续判（幂等）。

- [ ] **Step 2: 验收（不通过不许进下一层）**

```bash
pnpm content:exclusion --report --sample 20
```

Expected 与判定标准：
- `sameBlock 判定 6475/6475`
- 「是」率与标定样本（18/247 ≈ **7.3%**）同量级。**若整层 0 条「是」→ 停**，判据或通路有问题（CLI 会告警「验收不成立」）。
- **若远高于 20%** → 判据偏「会勾」：整理负例进 `JUDGE_GUIDE`、升 `JUDGE_VERSION`，然后
  `--judge --rejudge --layer same`——**这是一次全层重判，需重新批准（Task 2 Step 2 的流程）。**
- 抽 20 条「是」人工看：是不是真的「按题意会勾」。

- [ ] **Step 3: Commit（CI 此时会红 —— 闸门在正确工作）**

```bash
git add content/.exclusion-ledger
git commit -m "chore(content): 互斥判定 sameBlock 层入账（6475 组；用户 YYYY-MM-DD 批准）
（账本尚不完整 → content:audit 红属预期，Task 7 后转绿；本分支在 Task 7 前不得合并）"
```

---

### Task 4: crossBlock 层判定（1,395 批）—— 用户踩雷的那一层

**Files:** `content/.exclusion-ledger`

- [ ] **Step 1: 跑**

```bash
pnpm content:exclusion --judge --layer cross --concurrency 20
```

Expected: 1,395 批、候选数/批 1–40。失败批（重试后仍失败）不写账本，重跑同命令补齐。

- [ ] **Step 2: 验收**

```bash
pnpm content:exclusion --report --sample 30
```

Expected: `crossBlock 判定 48307/48307`；「是」率**低于**同块层；抽 30 条人工看。
**这一层的「是」就是用户实际会踩到的坑** —— 抽检里每一条都值得记住它解决了什么。

- [ ] **Step 3: Commit**

```bash
git add content/.exclusion-ledger
git commit -m "chore(content): 互斥判定 crossBlock 层入账（48307 组）"
```

---

### Task 5: neighbor 层判定（1,572 批）

**Files:** `content/.exclusion-ledger`

- [ ] **Step 1: 跑**

```bash
pnpm content:exclusion --judge --layer neighbor --concurrency 20
```

- [ ] **Step 2: 验收 + 一个待用户拍板的取舍**

```bash
pnpm content:exclusion --report --sample 30
```

Expected: `neighbor 判定 54109/54109`；「是」率预期极低（spec §3.2：相邻大类多为「否」）。
spec §11 的未决项在此兑现：若「是」率 ≈0，可与用户商量是否把该层降级为「只在运行时 `degradedTo='neighbor'` 时补判」——
**那是缩小范围，必须重新拍板，不要在计划执行中自行决定。** 另注意：65 张卡的免费口径跨块+相邻池为 0，
它们正是走 neighbor 兜底的那批，这一层的判定对免费用户尤其值钱。

- [ ] **Step 3: Commit**

```bash
git add content/.exclusion-ledger
git commit -m "chore(content): 互斥判定 neighbor 层入账（54109 组）"
```

---

### Task 6: 人工抽检验收（100 条「是」，一致率 ≥90%）

**Files:** 无（产出写进 spec §13）

- [ ] **Step 1: 抽样**

```bash
pnpm content:exclusion --report --sample 100
```

- [ ] **Step 2: 逐条判定并记录**

判据（spec §3 一句话）：**只读目标题题干，一个称职的面试者会不会把这条要点勾进去？**
产出：一致率 = 同意数 / 100。

- [ ] **Step 3: 分支处理**

- 一致率 **≥90%** → 进 Task 7。
- **<90%** → 停：反例整理进 `batch.ts` 的 `JUDGE_GUIDE` 负例，`JUDGE_VERSION` 升到 `v2`，
  然后 `pnpm content:exclusion --judge --rejudge`（**全量、三层，需重新批准预算**）。
  这是判据回归，不是单条修。修复后的恢复通道已就绪（CLI 的 `--rejudge`）。

- [ ] **Step 4: 把验收结果写进 spec §13（一行）**

```markdown
- 抽检口径：2026-XX-XX 抽 100 条「是」，人工一致率 XX%（≥90% 达标）
```

---

### Task 7: 投影落盘（`--apply`）+ 闸门转绿

**Files:** `content/**/*.md`（Task 0 之后，**diff 只应包含 excludeAsDistractorFor 的增行**）

- [ ] **Step 1: 先 dry-run（免费、可反复跑）**

```bash
pnpm content:exclusion --apply --dry-run
```

Expected: 每卡一行三层余量；末尾「触线 … 张；免费口径跨块+相邻池为 0 … 张」。
**已预知**：至少 11 张零余量卡 + 那 2 张已跌破的（`01M2YHWH5R70FFC6TGAN0VP7ZS` 11/12、
`01M3KH6MGE6EHRDCH6S3HP1A64` 10/12）。真实判定跑完后这个数字会更大。

- [ ] **Step 2: 触线处置（决策点，需用户过目）**

`--apply` 有任何卡触线时默认**拒绝落盘**（exit 1）。两条路：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A. 先补内容（推荐给同块触线）** | 给触线块补卡（每块 ≥5 张卡是 ready 的隐含门槛），或把题干改到答案封闭 | 内容工作量；且**改题干会让相关判定指纹过期 → 需重判 → 再花钱（需重新批准）** |
| **B. `--apply --allow-touch`** | 先让正确的判定落盘（漏登记才是真 bug），内容随后补 | **闸门会红到内容补完**；运行时更易走 neighbor 兜底，极端情况抛「池枯竭」 |

要点：**绝不允许为了过闸门而漏登记**——那是把 bug 放回线上。跨块/相邻层的登记不影响 `MIN_BLOCK_POOL`，
所以「被触线卡住」的通常只是同块层余量。

- [ ] **Step 3: 落盘**

```bash
pnpm content:exclusion --apply            # 或 --allow-touch
git diff --stat content/ | tail -3
git diff content/ | grep -c '^+'          # 与实际「是」的条数对照，数量级应一致
```

Expected: `已重写 N 张卡`；diff **只含 `excludeAsDistractorFor` 的增行**（Task 0 已把格式 churn 消化掉）。
若 diff 里出现 `verifiedAt`/`relatedBlocks`/引号变化 → Task 0 没做干净，停下来查。

- [ ] **Step 4: 闸门转绿**

```bash
pnpm content:audit
```

Expected: `内容审计通过`，且无「尚未扫过 / 未判定 / 判定已过期 / 卡文件与账本不一致」。
若报「判定已过期」（Task 0–7 期间又改过内容）→ `pnpm content:exclusion --judge`（只补过期的，幂等，
**若数量成规模则属重判，需重新批准**）→ 再 `--apply`。

- [ ] **Step 5: 全量验收 + Commit**

```bash
pnpm typecheck && pnpm test
git add content/ && git commit -m "feat(content): 互斥登记全量落盘——N 条「是」写回 M 张卡，闸门转绿"
```

---

### Task 8: 入库（本地库 + 生产库）

**Files:** 无（DB 数据）

- [ ] **Step 1: 本地库（注意命令形式，见 Global Constraints）**

```bash
pnpm exec tsx --env-file-if-exists=.env.local src/server/content-upsert/cli.ts
```

Expected: `已 upsert：81 块 / 404 卡 / 1769 要点 / 3 个岗位包`（要点数不变，变的是 `exclude_as_distractor_for`）。

- [ ] **Step 2: 核对本地库真的写进去了**

```bash
psql "$(grep -o 'DATABASE_URL=.*' .env.local | cut -d= -f2-)" -c \
  "select count(*) filter (where jsonb_array_length(exclude_as_distractor_for) > 0) as 已登记,
          count(*) filter (where retired_at is null) as 活要点 from key_points"
```

Expected: `已登记 > 0`（此前恒为 0）。没有 psql 时用 `pnpm exec tsx` 写个 8 行脚本读同一个 DB。

- [ ] **Step 3: 生产库**

```bash
rsync -az -e "ssh -p 22222" content/ root@82.29.72.221:/opt/interview-drill/content/
ssh -p 22222 root@82.29.72.221 'cd /opt/interview-drill && \
  pnpm exec tsx --env-file-if-exists=.env.production.local src/server/content-upsert/cli.ts'
```

（用 `--env-file-if-exists` 而不是 `set -a; source ...`：前者按 dotenv 规则解析，能处理引号与特殊字符，
且与本地那条、以及 AGENTS.md 高频坑 2 的修法一致。）

（本步只同步 `content/`，不重建应用——不需要 rsync 全量源码、不需要重启服务。）

- [ ] **Step 4: 核对两边一致**

**本机没有 `psql`**（实测 `which psql` 退出 1），用项目自带的 tsx 跑同一句 SQL。
**脚本走 stdin、在项目根执行**——这个形式本地与生产都已实测通过
（写成 `/tmp/x.ts` 文件再跑会 `Cannot find module 'pg'`，因为解析相对脚本位置而不是 cwd——踩过）：

```bash
# 本地
cat <<'EOF' | pnpm exec tsx --env-file-if-exists=.env.local
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
async function main() {
  await c.connect()
  const r = await c.query(`select count(*)::int n from key_points
    where retired_at is null and jsonb_array_length(exclude_as_distractor_for) > 0`)
  console.log('已登记', r.rows[0])
  await c.end()
}
main()
EOF

# 生产（同一段脚本塞进 ssh 的 stdin；heredoc 用引号包裹，别让本地 shell 先展开）
ssh -p 22222 root@82.29.72.221 'cd /opt/interview-drill && pnpm exec tsx --env-file-if-exists=.env.production.local' <<'EOF'
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
async function main() {
  await c.connect()
  const r = await c.query(`select count(*)::int n from key_points
    where retired_at is null and jsonb_array_length(exclude_as_distractor_for) > 0`)
  console.log('已登记', r.rows[0])
  await c.end()
}
main()
EOF
```

Expected: 两边**同值**。不一致 = 有一边没跑 upsert。
（更严格的漂移核对见 AGENTS.md 的 md5 摘要口径——注意它现在也应把 `exclude_as_distractor_for` 纳入，
本计划的摘要口径比 AGENTS.md 里的多一列，别直接跟文档里的历史值比。）

- [ ] **Step 5: 线上真实验收（最重要的一步，由用户做）**

用当初踩雷的那道题实测：`java/language-basics`《final、finally、finalize 分别是什么？》——
连续刷几次（每次复习换一套变体），确认**不再出现** `java/exceptions` 的
「返回 finally 的值：try 的返回值与异常都被丢弃」。
**结论由用户在浏览器里给**，不要用代码断言代替。

---

### Task 9: 收尾

**Files:** spec §13（状态 + §11 真实数字）、可能的 `AGENTS.md`

- [ ] **Step 1: 处置 stash（按 Task 1 的裁决执行）**

保留：不动 `stash@{0}`（overlap WIP）与 `stash@{1}`（更早的两张卡）；删除：`git stash drop`；
另存：`git branch wip/overlap stash@{0}` 后 drop。

- [ ] **Step 2: 决定 `review:pairs` 的去留**

已被 `content:exclusion` 取代（只扫同块、字符重合度占位打分、交互式）。二选一：删文件 + 删脚本 + 删测试；
或保留并在脚本描述里标注「已被 content:exclusion 取代」（AGENTS.md 已这么写）。

- [ ] **Step 3: 写真实数字回 spec**

§11「成本与耗时」用实测替换：批数、真实输入/输出 tokens、实际耗时、抽检一致率、触线卡与处置方式。
状态改「全部落地」。

- [ ] **Step 4: 合并（**不是 ff**）**

```bash
git log --oneline main..feat/content-exclusion    # 确认内容
git merge --no-ff feat/content-exclusion          # ff 是可行的（main 就是分支的 base）；
                                                  # 用 --no-ff 是刻意的：把 5 个提交留成一个可见的整体
```

**不主动 push。** 合并前确认：`content:audit` 绿、`--apply` 已跑、两库已 upsert。

---

## Self-Review

**1. Spec coverage**
- §1 存量补全（404 卡 / 1769 要点）→ Task 3/4/5 判定 + Task 7 投影 + Task 8 入库。
- §1 增量自动更新 → 已实现（闸门 + 幂等 judge）；Task 7 Step 4 的「判定已过期」分支就是它的运行说明。
- §3 可校准/可复核/拦得住 → Task 6 抽检 + Task 7 Step 4 闸门 + `--report` 的零「是」告警。
- §5.1 两阶段 → Task 3–5（judge）/ Task 7（apply）。
- §5.2 分层推进 → Task 3/4/5 逐层 + 每层验收。
- §7.0 大类序列权威 → 已实现并有守卫测；本计划无实现任务。
- §7.2 池容量 → Task 7 Step 1/2（含 11 张零余量卡与 65 张免费池为 0 的实测）。
- §7.3 抽检 100 条 ≥90% → Task 6。
- §11 未决项（相邻层是否降级、真实成本）→ Task 5 Step 2 与 Step 3。
- §13 实施记录 → Task 1 的偏离裁决 + Task 9 Step 3 回填数字。

**2. Placeholder scan**：无 TODO/TBD。唯一刻意留空的是 Task 2 Step 2 的**最终金额**
——它必须由真实标定得出（Task 2 Step 1 先测），不能由我拍一个数。

**3. Type consistency**：命令面与 `cli.ts` 一致——`--judge [--layer same|cross|neighbor] [--limit N]
[--concurrency N] [--rejudge]`、`--apply [--dry-run] [--allow-touch]`、`--report [--sample N]`、
`--prune [--yes]`、`--normalize [--dry-run]`。

**已知风险（交付时须告知用户）**
1. **LLM 判定非确定性**（spec §3.2）：同组重跑可能翻转；靠抽检发现，`--rejudge` 修复。
2. **钱不可逆**：判定花掉就是花掉；`--prune` 删的是不可再生结果（本计划不用 `--prune`）。
3. **触线要内容工作**：至少 11 张零余量卡 + 标定就已触线的 2 张；真跑完后数量会增加。
   `--allow-touch` 能让判定先落地，但闸门会红到内容补完。
4. **免费口径池有 65 张为 0**：免费用户在这些卡上抽不到跨块/相邻干扰项时会走 neighbor，
   仍不足则抛「池枯竭」→ 线上 500。这是本次登记**不会**解决、反而可能加剧的既有风险（登记只会吃池），
   建议 Task 9 之后单独立项处理。
