# excludeAsDistractorFor 全量补全与自动维护 · 设计

- 日期：2026-10-04
- 状态：**主体已实现**（v2，已按独立审查反馈修订；处置见 §12；实施记录见 §13）。
  尚未执行的是**唯一要花钱的一步**：`content:exclusion --judge` 全量判定（约 5M token）
- 上游诊断：[reviews/2026-10-03-ownership-vs-correctness.md](../reviews/2026-10-03-ownership-vs-correctness.md)
- 用户拍板：**① 范围三层全量 ② LLM 直判、不做 token 预筛 ③ 流程固定 + CI 闸门**

## 1. 要解决什么

判分只看归属（`ownIds`）：不属于本卡的要点一律判错。于是兄弟题的真话一旦被抽成本题
干扰项，用户按题意勾它就被判错 —— 用户线上实测过
（[reviews/2026-10-03-ownership-vs-correctness.md](../reviews/2026-10-03-ownership-vs-correctness.md)：
`java/exceptions` 的「返回 finally 的值：…」出现在《final、finally、finalize 分别是什么？》里，判 3/4）。

修法是在出题**前**就把这类要点从干扰项池里剔掉，工具就是这个字段。它全链路已实现，
只是**全库为空 —— 1,769 条活要点无一登记**（诊断文档记作 0 / 7058，分母是它的旧口径）：

```
content/*.md  excludeAsDistractorFor: [卡 id, …]
   → content:upsert → key_points.exclude_as_distractor_for
   → adapters 装配池 → drawDistractors 过滤
```

本设计补的是**数据与流程**，不改这条管道。

### 目标

1. **存量**：404 张活卡、1,769 条活要点，全部补上 `excludeAsDistractorFor`
2. **增量**：以后加题时自动更新，不需要任何人记得这件事
3. **正确**：判定标准可校准、结果可复核、漏判与陈旧判定都拦得住

### 非目标

- 不改判分口径、不改 `drawDistractors`、不改 schema、不改 `content:upsert`
- 不做「题干封闭化」的内容改写（那是诊断文档的第 2 步，独立工作）
- 不引入运行时依赖：判定只发生在内容生产期，线上不受影响

**唯一例外**：`queue.ts` 的 `neighborCategoryOf` 需要一处小改动（§7.0），否则闸门
无法权威（那是本设计的前置条件，不是顺手重构）。

## 2. 范围（实测）

三层，共 **108,891** 组「要点 × 目标题」，覆盖 **371 道**目标题：

| 层 | 组合数 | 怎么来 |
|---|---|---|
| 同块 | 6,475 | `sameBlockPoolOf` |
| 同大类跨块 | 48,307 | `buildDistractorPools` 的 crossBlock |
| 相邻大类 | 54,109 | 同上 neighbor（`degradedTo='neighbor'`） |
| **合计** | **108,891** | 平均每道目标题 **294** 条候选 |

口径与 `drawDistractors` 逐字对齐：

- 候选 = **其他卡的未退役要点**（退役要点永不被抽，不判；`draw.ts:82-85`）
- **目标侧排除 33 张 `sequence` 卡** → 404 活卡 − 33 = 371 道目标题。
  `prepare.ts:98-126` 的 sequence 分支直接返回、`drawDistractors` 在 `:129` 才调用，
  结构上不可能受害；但 sequence 卡的**要点照旧进池**（`src/server/queue.ts:46-50`
  收池循环无 cardType 过滤），所以只在「目标题」一侧排除

### 2.1 entitlement 口径（必须写明）

上表按**全量要点**枚举，这逐字对齐的是**付费用户**的池。免费用户的 crossBlock /
neighbor 两层会过 `crossBlockPoolFor` 只留 `public`（`src/server/queue.ts:54-55`）。

**仍必须按全量枚举，不得按 public 剪枝** —— 付费用户抽的是全量池，剪枝等于把付费
用户的坑放回线上。全库 public 要点仅 **281 / 1,769 = 15.9%**，剪枝会漏掉 84% 的候选。

## 3. 判据

判定标准写死成一句话，禁止各判各的：

> **只读目标题的题干。一个称职的面试者，会不会把这条要点勾进去？
> 会 → 登记 `excludeAsDistractorFor`。**

「会勾」= 这条要点在语义上能回答那个问题。**不是**「话题相关」、**不是**「共享术语」。

### 3.1 校准用例（进 prompt 作 few-shot 负例，**不进单测**）

| 要点 | 目标题 | 判定 | 为什么 |
|---|---|---|---|
| `java/exceptions`「返回 finally 的值：try 的返回值与异常都被丢弃」 | 《final、finally、finalize 分别是什么？》 | **是** | 它讲的正是 finally，按题意会勾 |
| `java/string`「类 final + 私有 char 数组 + 不提供修改方法，共同保证不可变」 | 同上 | **否** | 说的是不可变性，不是「final 是什么」；只是共享 `final` |
| `java/generics`「数组用 Array.newInstance(cls, n)」 | 《ArrayList 是线程安全的吗？》 | **否** | 说的是反射建数组，只是共享 `array` |
| `java/language-basics`「finally 不执行的三种情况」 | 《finally 里 return，方法返回什么？》 | **否** | 说的是「何时不执行」，不是「返回什么」 |

**判据天然偏向「是」**：40 条独立二判（不是一个 9 选选项集）里，模型容易把「听起来
相关」判成「会勾」。所以 prompt **必须给负例**（上表三条「否」直接进 prompt），
并把**每层的「是」率**作为漂移指标记录 —— 跨块/相邻层「是」率异常升高即判据崩了。

这些用例**不能进单测**（判据是 LLM，单测会变成联网测试）。它们在 prompt 里当 few-shot
负例，其效果由 §7.3 的抽检验证。

### 3.2 已知界限

- **LLM 判定不是确定性的**：同一组重跑可能翻转。故账本记判据版本与内容指纹（§6.3）。
- **相邻大类多为「否」**：54,109 组里绝大多数会判否，这些 token 是为「不漏」付的钱。
- 判定**不区分置信度**：只有是/否。低置信度靠抽检发现，不靠分数阈值。

## 4. 架构

依赖方向沿用仓库铁律：纯核在 `lib`，IO 在 `tools`。

| 组件 | 位置 | 职责 | 依赖 |
|---|---|---|---|
| **候选枚举**（纯核） | `src/lib/content/exclusion.ts` | 三层候选对枚举、账本键、账本 diff | `lib/content` 类型 |
| **闸门**（纯核） | `src/lib/content/audit.ts`（扩展） | 完整性 + 卡文件与账本一致性 | 上一行 |
| **投影**（纯核） | 同上文件内 | 账本 → `excludeAsDistractorFor` 数组 | 无 |
| **批处理与解析**（纯核） | `tools/content-exclusion/batch.ts` | 按目标题分组、切块（≤40）、构造 prompt、解析校验响应 | 无 IO |
| **调用**（IO） | `tools/content-exclusion/run.ts` | HTTP 调 LLM、并发、重试 | 见 §4.2 |
| **CLI** | `tools/content-exclusion/cli.ts` | `pnpm content:exclusion …` | 以上全部 |
| **写回**（复用） | `tools/review/register.ts`（加批处理变体） | 安全写回卡文件 YAML | 已有 |

命名沿用 `tools/content-new/` → `content:new` 的先例（这是内容生产工序，不是人工审核
工具，故不进 `tools/review/`）。

复用 `register.ts` 的理由：它已解决 YAML 写回的两个坑（`MATTER_OPTS` 防 Date 化与
乱加引号、`detachedData` 防缓存污染，`register.ts:17-22`）与「排序去重保证 diff 只
显示新增」（`:41`）。

### 4.2 LLM 通路（**不是「复用」**）

仓库**没有**现成的非流式「发一条消息拿回复」函数：唯一发请求的地方是
`src/server/qa.ts:162` 的 SSE 流，且依赖 `SqlRunner`/用户/配额。所以：

- **复用**：`lib/ai/qa.ts:194-207` 的 `PROVIDERS` 注册表与 `:249-265` 的 `selectProvider`
- **自建**：请求层（`fetch` + `stream:false`），并须处理家特有 `extraBody`
  （DeepSeek 的 `reasoning_effort: 'low'`，`qa.ts:205`）与 `max_tokens`
- **解析**：只取 `choices[0].message.content`（思考型模型的 reasoning 不进正文）

**环境变量**：`tsx` 不读 `.env*`（`AGENTS.md` 坑 2），CLI 必须走
`tsx --env-file-if-exists=.env.local`（先例：`package.json` 的 `invite:new`）。

**响应格式必须定死**（否则无法写解析、无法估 token、无法界定重试）：

```
输入：目标题干 + 编号候选列表（≤40 条，每条前缀 [N]）
输出：只允许一个 JSON 数组，元素是判「是」的编号，如 [3,17]
解析：JSON.parse → 校验每个编号在 1..N 内且无重复 → 越界/重复/非数组 = 解析失败
```

### 4.3 命令面

```bash
pnpm content:exclusion --judge [--layer same|cross|neighbor] [--limit N] [--concurrency N]
    # 调 LLM 判未判定的组合，写账本。烧钱。从不改卡文件。
pnpm content:exclusion --apply [--dry-run]
    # 从账本重写卡文件 excludeAsDistractorFor。零成本、幂等。
    # --dry-run 只打印三层池余量（含免费口径）与预计触线的卡，不写文件。
pnpm content:exclusion --report [--sample 100]
    # 抽检「是」的样本供人工复核 + 每层「是」率 + 池余量总览。
pnpm content:exclusion --prune
    # 清理悬空/指纹过期的条目。破坏性，二次确认。
```

环境变量：命令必须用 `tsx --env-file-if-exists=.env.local` 跑（`AGENTS.md` 坑 2）。

## 5. 数据流

### 5.1 两阶段：判定与投影分离

这是本设计的核心结构，解决「dry-run 白烧一倍钱」与「池容量触线时文件已改」两个问题。

| 阶段 | 命令 | 烧钱 | 产物 |
|---|---|---|---|
| **判定** | `content:exclusion --judge` | 是 | 写账本（是 + 否都记） |
| **投影** | `content:exclusion --apply` | 否 | 从账本重写卡文件的 `excludeAsDistractorFor` |

- 判定阶段**从不碰卡文件**，可安全重跑、可分批（`--layer same` / `--limit N`）
- 投影阶段**零成本、幂等**，池容量检查发生在这一步（免费），触线时可反复调整内容再 apply
- 账本成为**判定状态的单一来源**（判过没判过、判的是是还是否）；卡文件是它的
  运行时投影，闸门另加一条投影一致性检查（§7.1）

### 5.2 存量（一次）

```
judge：枚举三层候选对（108,891）
  → 按目标题分组（371 组，平均 294 条候选）
  → 切块 ≤40 → 2,882 次调用 → 写账本
     （2026-10-06 按现行枚举器复算；设计期估的 2,723 偏低。
      分层跑则 3,330 批——同一目标题在各层各切一次）
apply：账本 → 每卡 excludeAsDistractorFor（零调用）
  → content:audit 复核池容量（§7.2）
```

**分层推进**：`--layer same` → 验池 → `--layer cross` → `--layer neighbor`。
相邻层最贵且最可能全是否，把池风险与预算风险都前移暴露。

体量：按实测文本长度（要点均 32 字、题干均 19 字），极简 prompt 约 1.5–2K token/批
→ 输入约 **5M token**、输出约 0.3M（裸下标数组）。成本与耗时尚需首轮实测确认
（§11），并发按 20。
**（2026-10-04 标定修正：输入估算量级成立（外推 ~4.2M），但输出被思考型模型推翻——
满批实测 267–581 tokens，早期小批 7 条候选即 1,301（思考占大头），外推约 1.3M。
数字见落地计划的成本表。）**

### 5.3 增量（每次加题，自动）

加一张新卡带来的未判定组合（按 §2 三层口径；2026-10-06 用现行枚举器
`enumerateCandidatePairs` 逐卡复算，口径 = 该卡作为目标题吸纳的候选组 + 其要点
作为候选进其他目标题的组）：**均值 539 组 / 卡**（最少 200、中位 542、最多 681）。
其余 10 万+ 组读账本即跳过。（初版记 561 / 290 / 559 / 697，系设计期手写模拟的
口径，以本复算为准。）

**幂等**：同一组合在账本里就跳过，命令可重复执行。

### 5.4 失败即拦住（fail-closed）

某批调用失败 / 响应解析不了 → 重试一次 → 仍失败则**该批不写账本**。这些组合保持
「未判定」，闸门因此报错。**绝不把「没判」当成「判否」**——静默丢弃会让漏网项无人
发现，这正是 spec §9.1 否决双模型交叉预审的那个失败模式。

## 6. 账本

### 6.1 存哪、长什么样

`content/.exclusion-ledger`，纯文本：

```
# judge=v1 provider=deepseek model=deepseek-flash generated=2026-10-04T12:00:00Z
<ownerCardId>/<kpId>|<targetCardId>|yes|<内容指纹>
<ownerCardId>/<kpId>|<targetCardId>|no|<内容指纹>
```

- `#` 开头为注释行（照 `audit.ts:203-223` 的 `.ids.lock` 先例：无法识别的行直接报错，
  所以格式必须显式定义，不能只靠约定）
- 数据行排序后写入（含 `yes`），保证 diff 只显示真正变化
- **同时记「是」和「否」**：「是」的**运行时权威源仍是卡文件**（`drawDistractors`
  读它），账本里的「是」用于闸门判定与投影重建

**为什么不把「否」写进卡文件**：一条要点平均要对 **60 道**目标题判「否」（实测最少
49 / 中位 60 / 最多 77）。用 `matter.stringify` 实测：60 条 ULID 使单条要点增
**1.98KB**、77 条增 2.58KB；一张 4 要点卡满写增 **10.3KB**，其中九成是 ULID。
卡文件必须保持人可读，且「是」才是需要人复核的部分。

代价：全量 108,891 行，**实测 7.72MB**（均 74.4B/行，含指纹字段；不含指纹时约 7.2MB）。

### 6.2 `--prune` 是破坏性的

删掉的是**不可再生的判定结果**（恢复 = 重跑 `--judge`，真金白银）。命令须二次确认。

### 6.3 失效条件（**含内容变更**）

判据是「只读题干」，所以**内容变了，旧判定就不再成立**，而账本原样保留会静默失效。
失效触发有四类：

| 触发 | 处理 |
|---|---|
| 判据版本号变化（`JUDGE_VERSION` 常量） | 整体失效，重判 |
| 模型/provider 变化 | 头部记录并告警，**不自动失效**（换机器不该重跑） |
| `target.question` 变化 | 该目标题的全部判定失效 |
| `ownerKp.text` 变化 | 该要点的全部判定失效 |

前两类靠头部比对；后两类靠数据行尾的**内容指纹**（`question + kp.text` 的短哈希）。
**判据版本号写在仓库代码里（常量），不取自 env** —— 否则开发机换个 key 就触发整体
重跑，而模型名只作为头部元信息记录。

**这条最要紧**：§7.2 推荐的修法就是「把题干改到答案封闭」，上游 review 的第 2 步是
一整批题干改写 —— 没有这条，那批动作会一次性制造大量静默陈旧判定。

## 7. 闸门与正确性

### 7.0 前置：大类序列必须有权威来源

`neighborCategoryOf`（旧 `src/server/queue.ts:25-31`，**已在实施中随统一口径删除，见 §13**；
本节行号描述的是修复前状态）取的是传入 Map 的键序，来自
`select id, category from blocks`（`adapters.ts:387-388`）—— **没有 `ORDER BY`**，
行序 = 插入序，且 PG 不作保证。而工具/闸门从文件系统走（`readdirSync`，无序）。

**后果**：两侧的「谁是邻居」可能完全不同。实测方向写反会换掉**整个相邻层 54,109 组
（占总数 49.7%）**，而总数只差 0.26%（108,891 vs 108,606）—— 只看总数发现不了，
闸门会全绿而线上的假阴性原样存在。这是本仓库已记录过的坑
（`src/lib/content/overlap.ts:39-43` 明说「与真实装配在『谁是邻居』上可能不同」）。

**顺带**：`neighborCategoryOf` 的顺序还会影响出题 —— 相邻层兜底时，不同实例若块行序
不同，同一次复习会抽到不同干扰项，破坏「判分与展示同卷」的确定性。

**修法**：大类序列显式化 —— 两侧都按**大类名升序**取序列（runtime 一行改动 + CLI 同
规则），并加一条守卫测：文件序 == 规则序。

### 7.1 完整性闸门（CI）

接进 `content:audit`（`.github/workflows/content.yml` 已在 `content/**` 变更时跑）：

> 枚举三层候选对，若存在**不在账本**（或指纹已过期）的组合 → **构建失败**，消息指名
> 「哪条要点 × 哪道题未判定」。

另加一致性检查：卡文件里的 `excludeAsDistractorFor` 必须等于账本中 `yes` 的投影，
不等即报错（防手改卡文件后与账本漂移）。

纯计算，不调 LLM，秒级。加一张新卡 → 它的约 540 组未判定 → 红 → 跑
`content:exclusion` → 绿。**这就是「自动更新」的强制点**：不判就交不上。

**缺失账本 = 首次运行 → 只警告不报错**（否则一上线就永久红）。

### 7.2 池容量风险（必须显式处理）

登记会**吃掉可用池**：`auditLibrary` 拿扣除 `excludeAsDistractorFor` 后的条数跟
`MIN_BLOCK_POOL` 比（enumeration/comparison 12、judgment 8、atomic 6，
常量在 `pool.ts:20-26`，audit 在 `audit.ts:88-110` 消费）。

- **相邻/跨块层的登记不影响 `MIN_BLOCK_POOL`**（该检查只遍历同块 `blockCards`）——
  但会缩小**实际**可用池，而**免费用户的跨块+相邻池只有 public 子集**
  （实测 p50 35 条、p10 0 条），唯一探测手段是运行时抛「干扰项池枯竭」
  （`draw.ts:110-115`）→ 线上 500
- 因此 `--apply` 必须先输出**每卡三层池扣除后剩余量 + 免费口径剩余量**，再决定落盘
- 真触线时，**正确的修法是改内容**（给块补卡、或把题干改到答案封闭），
  **绝不允许为了过闸门而漏登记** —— 那等于把 bug 放回线上
- 顺手修一个休眠缺陷：计 `usable` 时**不滤 `kp.retiredAt`**，当前内容 0 条退役要点
  故未暴露；池校验是本次的核心护栏，扩进来时一并修掉，否则「audit 绿」≠「运行时池够」
  ——**已修**（现行 `audit.ts:94-103` 已滤 `retiredAt`，见 §13 补记）

### 7.3 三层正确性保障

1. **标准可校准**：§3 的一句话 + 四条校准用例进 prompt 作 few-shot 负例（不写单测，
   判据是 LLM）
2. **结果可复核**：随机抽 **100 条「是」**（不抽「否」——「否」不改变出题结果，
   抽它没有信息量）人工复核，一致率 ≥90% 才算验收；另记每层「是」率作漂移指标
3. **拦得住**：完整性闸门（漏判、陈旧）+ fail-closed + 一致性检查（漂移）

## 8. 与相邻工作的边界（**需用户决议**）

- **未提交的 overlap 工作必须决议**：`src/lib/content/overlap.ts`（未提交）已实现
  **同一个三层枚举**（`OverlapLayer`、`findTopicOverlaps`、`findingKey = blockId/kpId|targetCardId`）、
  `tests/lib/content/audit-overlap.test.ts:66,73,82,96` 已在要求 `auditLibrary` 的第 4
  参数与「无基线只警告 / 新命中报错指名」的闸门语义，账本格式几乎相同 —— **与 §4 抢
  同一个文件的同一个扩展点**。
  **本设计的决议是：以 `exclusion.ts` 为唯一枚举器**（吸收或取代 `overlap.ts`），
  **单一账本**（`.exclusion-ledger` 取代 `.overlap.baseline`）。这需要用户点头（涉及
  删除未提交文件）。
- **实施前工作区必须回到绿**：当前 `pnpm typecheck` 4 错、`audit-overlap.test.ts` 3 失败
  （均来自那批未提交 WIP）。
- **要点 id 跨块撞车**（`agent/llm-basics` × `java/language-basics` 共 20 个、
  `concurrency/sync-tools` × `java/string` 共 13 个）：**不在本设计范围**。账本键
  `cardId/kpId` 的唯一性由「卡 id 全局唯一」（`audit.ts:42-44` 重复即 error）+「要点 id
  块内唯一」（`:50-59`）保证；实测这些撞车 id 的两端从不落在同一/相邻大类，连
  `ownIds` 都滤不掉任何一组。撞车影响的是池子静默缩小，另行处理。
- **现有 `review:pairs`**：只扫同块（`pairs.ts:13-45`）、字符重合度占位打分器
  （`cli.ts:44-50`）、交互式。本设计落地后退役（保留或删除，实现时定）。
- **「话题词重合」判据**：本设计不采用（实测精度不够），已记录在 §10。

## 9. 测试

| 层 | 位置 | 测什么 |
|---|---|---|
| 枚举 | `tests/server/` | 三层口径与 `buildDistractorPools` 一致（需 import `src/server/queue.ts`，故不进 `tests/lib/**`）；目标侧排除 sequence；大类序列规则稳定 |
| 账本与投影 | `tests/lib/content/` | 键唯一；diff 正确（已判定跳过）；指纹变化 → 失效；`yes` 投影 == 卡文件 |
| 闸门 | `tests/lib/content/` | 未判定 / 指纹过期 → 报错并指名；无账本 → 只警告；悬空条目 → 警告；卡文件与账本不一致 → 报错 |
| 批处理（注入 fake scorer） | `tests/lib/content/` | ≤40 切块；响应解析（越界/重复/非数组/缺项 → 重试 → 仍失败则 fail-closed 不写账本） |
| 写回 | `tests/lib/content/` | 批处理变体：diff 只含新增；`verifiedAt` 不被 Date 化；重复执行幂等 |
| 端到端（无 LLM） | `tests/lib/content/` | 夹具：加一张新卡 → 闸门红 → `--judge`(fake) → `--apply` → 闸门绿 |
| 验收（非单测） | — | 手工抽检 100 条「是」 |

## 10. 已否决的方案（记录在案，别翻案）

| 方案 | 否决理由 |
|---|---|
| 只扫同块（spec §4.3 原文） | 用户踩的雷在跨块，覆盖不到 |
| token 预筛 + 人工 | 判据精度不够（实测随机抽 40 组真命中近乎为零）且纯中文有召回洞 |
| 「否」写进卡文件 | 实测每要点 49-77 题（中位 60），单卡涨约 10KB、九成是 ULID |
| 判定结果存 DB 新表 | CI 无 DB，闸门跑不了；且违背「content/ 是权威源」 |
| 逐对调用 LLM（108,891 次） | 40 倍调用量，成本与耗时不可接受 |
| 不设闸门、只出待办清单 | 正是现状的成因：清单无人看，空了 4 个月 |
| 按 public 剪枝（免费口径枚举） | 付费用户抽全量池，剪枝会漏 84% 候选 |

## 11. 未决 / 风险

- **成本与耗时**：待首轮实测（§5.2 的估算依赖尚未实现的响应格式，不可信到美元级）。
  建议先跑 `--layer same --limit 20` 标定单批实际 token 与耗时，再外推
- **抽检通过线**：暂定 100 条「是」、一致率 ≥90%；首轮实测后可调
- **相邻层「是」率**：若极低（预期），可与用户商量是否降级为「只在
  `degradedTo='neighbor'` 日志出现时补判」——那是缩小范围，需重新拍板
- **7.7MB 账本进 git**：接受；若成负担可考虑压缩（去掉重复的卡 id 前缀、或按块分片）
- **LLM 判定翻转**：抽检若发现同组复活率偏高，需引入「两次判定取一致」

## 12. 独立审查反馈的处置

| 审查发现 | 处置 |
|---|---|
| ①「大类序列」无权威来源，闸门与生产可能各查一半（49.7% 的组不同） | **采纳**，提为前置条件 §7.0（含 runtime 一行改动 + 守卫测） |
| ② 判据版本不覆盖内容变更 → 改题干后静默失效 | **采纳**，§6.3 加内容指纹；判据版本改为代码常量，不取自 env |
| ③ LLM 通路三缺（无非流式函数 / 响应格式未定义 / env 未提） | **采纳**，§4.2 重写并定死响应格式 |
| ④ 未提交的 overlap 工作抢同一枚举器与扩展点；工作区当前是红的 | **采纳**，§8 提为需用户决议 + 实施前先回绿 |
| ⑤ 首次全量可能把仓库留在 audit 红；`--dry-run` 白烧一倍钱 | **采纳**，改为两阶段 `--judge` / `--apply`（§5.1），池检查移到免费的 apply |
| ⑥ 登记对免费层公共池无护栏（public 仅 15.9%，p10 池为 0） | **采纳**，§7.2 要求报免费口径余量 |
| 增量 3,600 组/卡 → 实为 **561**（我高估 6.4 倍） | **改正**（§5.3、§7.1） |
| 「方向写反差 0.3%」——数字对但结论错，换的是整层 | **改正**（§7.0） |
| 单要点 +1.7KB → 实测 1.98KB；卡 +7-13KB → 实测约 10KB | **改正**（§6.1） |
| 账本 6.5MB 与「只存否」矛盾 | **改为**账本同时记是/否（6.48MB 与估算相符，且成为单一状态源） |
| `--prune` 不是「可重建」 | **改正**（§6.2 写明不可再生、需二次确认） |
| 抽检只该抽「是」 | **采纳**（§7.3） |
| prompt 缺负例、判据偏「会」 | **采纳**（§3.1 负例进 prompt + 「是」率作漂移指标） |
| `audit.ts` 计 `usable` 不滤 `retiredAt`（休眠缺陷） | **采纳**（§7.2 一并修） |
| 枚举测试应放 `tests/server/` | **采纳**（§9） |
| `--prune`、账本 header 语法、写回幂等 | **采纳**（§6.1、§6.2、§9） |

## 13. 实施记录（2026-10-04）

按 §4/§5/§6/§7 落地。**枚举口径已用真实内容校验**：三层分布
同块 6,475 / 跨块 48,307 / 相邻 54,109 = **108,891**，目标题 **371**，与 §2 的实测表逐项一致。

| 组件 | 落点 |
|---|---|
| 分层权威口径（§7.0 前置） | `src/lib/options/layers.ts`（新）——`categorySequenceOf` 按大类名升序 |
| 运行时改为同一口径 | `src/server/queue.ts`（`buildDistractorPools` 走 `layerOf`，删掉本地 `neighborCategoryOf`） |
| 候选枚举 / 账本 / 投影 / 池余量 / 闸门 | `src/lib/content/exclusion.ts`（新） |
| 池下界常量 | `src/lib/content/pool.ts`（新，audit 原样再导出；避免 audit ↔ exclusion 成环） |
| 闸门接进 CI | `src/lib/content/audit.ts` 的 `auditLibrary(..., { categories, ledger })` + `tools/audit-cli.ts` 打印警告 |
| 批处理（切块/prompt/解析/并发/重试） | `tools/content-exclusion/batch.ts`（新，纯核） |
| LLM 请求层 | `tools/content-exclusion/run.ts`（新，复用 `PROVIDERS`/`selectProvider` + 家特有 `extraBody`） |
| CLI | `tools/content-exclusion/cli.ts`（新）+ `package.json` 的 `content:exclusion` |
| 写回 | `tools/review/register.ts` 的 `applyExclusionsToRaw`（批处理变体，置位语义） |

### 实施中的三处判断，与原文的差异记录在案

1. **闸门不做「整层没扫过就先放行」的分级**。原文 §7.1 字面是「任一组未判定即红」，
   但 §5.2 又要求分层推进 —— 两者逐字执行会互斥（推进到一半的账本把 CI 卡死）。
   最终**按 §7.1 字面执行**（严格），未扫过的层只多给一条警告说明红的原因。
   理由：分层推进只是本地过程，账本三层判完才提交，CI 看到的账本一定完整；
   而为「整层没判」开例外会给漏判留一个静默口子。
2. **`MIN_BLOCK_POOL` 从 `audit.ts` 挪到 `pool.ts`**（`audit.ts` 原样再导出，import 路径不变）。
   池下界现在有两个消费者：池校验与 `--apply` 的池余量报告。
3. **§8 的 overlap 工作没有物理删除**，而是 `git stash push -u` 收进
   `stash@{0}`（"WIP overlap 哨兵（话题词重合判据）——被 exclusion 设计取代，保留备查"）——
   涉及别人的未提交成果，保住可恢复性。其两个有用想法已被吸收：三层枚举（→ `exclusion.ts`）
   与「无基线只警告 / 新命中报错指名」的闸门语义（→ `checkExclusion`）。
   话题词判据本身按 §10 不采用。

### 2026-10-06 复核更正（对照现行代码与内容逐项实测）

- **批数**：不分层 2,882 批、分层 3,330（sameBlock 363 批 8–24 条/批、crossBlock
  1,395、neighbor 1,572）——§5.2 设计期估的 2,723 偏低，正文已更新。
- **单卡增量**：按现行 `enumerateCandidatePairs` 复算为均值 539（200/542/681），
  初版 561 系设计期手写模拟口径，正文已更新。
- **§7.2 的休眠缺陷已修**：现行 `audit.ts:94-103` 计 `usable` 已滤 `kp.retiredAt`。
- **§2/§7.0 引用的 queue.ts 行号**（61-67 / 71-72 / 25-31）是实施前状态，现行池装配
  在 `src/server/queue.ts:33-57`（`buildDistractorPools` 走 `layerOf`，本地
  `neighborCategoryOf` 已删），正文行号已更新。
- 测试基线：92 文件 / 785 用例（第二轮评审修复净增 1）。

### 尚未做

- **`--judge` 全量判定**（花钱、要 API key）：`pnpm content:exclusion --judge`。
  建议先 `--layer same --limit 20` 标定单批 token 与耗时（§11），三层判完再提交账本。
- 人工抽检 100 条「是」（`--report --sample 100`），一致率 ≥90% 才算验收（§7.3）。
