# 专属错误选项（misconceptions）设计 spec

日期：2026-10-19
状态：待审（用户已口头确认六节设计，本文为落档版本）

## 0. 背景与问题

### 用户痛点（2026-10-19 提出，已核实为真）

1. **干扰项混入其他题的要点**：现行 `lib/options` 三层池（同块 → 同大类 →
   相邻大类）全部抽自**其他卡的真实要点**。这些陈述作为知识是对的，只是
   「不属于这道题」。对「巩固本题要点记忆」这个目标，它们不承载教学功能——
   职能是防位置记忆 + 练归属辨别，与用户目标错位。
2. **每次复习干扰项整套换血**：`seed = hash(userId, cardId, reviewIndex)`，
   每次复习 reviewIndex 推进，干扰项集合重抽。对「防死记位置」是有意设计，
   对「形成稳定记忆锚点」是持续干扰，时间成本高。

### 当初的设计依据（spec §4.3，不推翻、只补位）

「keyPoints 一份内容同时干两件事——对本题是答案，对同块其他题是干扰项，
于是干扰项的内容成本是零。」本设计**不废除池机制**，而是在其前置一层
专属错误项：配了就优先用、缺口照旧走池。存量 404 卡零迁移成本。

## 1. 拍板记录（用户逐项确认）

| 决策点 | 结论 | 日期 |
|---|---|---|
| 干扰项模型 | 混合：专属错误项优先，池补足 | 2026-10-19 |
| 换血频率 | 熟练前固定集合，熟练后换血 | 2026-10-19 |
| 存储方案 | B：新表 `misconceptions`，与 `key_points` 平行 | 2026-10-19 |
| `why` 字段 | 必填（错勾永远有「为什么错」的解释） | 2026-10-19 |
| 熟练阈值 | s ≥ 2/3（与 `layerCounts` 的 3s≥2 分档线一致） | 2026-10-19 |

## 2. 数据模型

### 2.1 题卡 front matter（与 keyPoints 平行的可选字段）

```yaml
misconceptions:              # 可选；配几条用几条，缺口由现有池补足
  - id: mc-gc-01
    text: "对象一失去引用就会被 GC 立刻回收"
    why: "误解：GC 只在分配压力下按需运行，失去引用≠立刻回收"
    retiredAt: 2026-10-01    # 可选，tombstone 供 review_log 复现
    movedFrom: mc-gc-1       # 可选，id 改名守卫（与要点 §7 同构）
```

- `id`：全库唯一，建议 `mc-` 前缀（与要点 `kp-` 区分）
- `text`：错误陈述本身。必须是**本身为错**的命题（常见误解），不是「不属于
  本题的正确陈述」——后者是池干扰项的职能，混写会让两种教学语义都失效
- `why`：**必填**。错勾溯源文案，解释为什么错 / 正确理解是什么
- `retiredAt` / `movedFrom`：语义与 key_points 的 §7 id 守卫完全同构

### 2.2 zod schema（`lib/content/schema.ts`）

```ts
export const misconceptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  why: z.string().min(1),
  retiredAt: z.string().regex(ISO_DATE).optional(),
  movedFrom: z.string().optional(),
}).strict()

// cardSchema（.strict()）加：
misconceptions: z.array(misconceptionSchema).optional()
```

存量卡不带该字段 → **内容与 DB 层零迁移**；但注意 §3.2 的 seed 分档
对存量卡同样生效（未熟练期池抽取也固定集合）——这是特性不是遗漏：
404 张存量卡对痛点 2（每次换血难熟悉）**立即**受益，无需等内容生产。

### 2.3 DB（`server/db/schema.ts` + drizzle 迁移）

```ts
export const misconceptions = pgTable('misconceptions', {
  id: text('id').notNull(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  why: text('why').notNull(),
  retiredAt: date('retired_at'),
}, t => [primaryKey({ columns: [t.cardId, t.id] })])
```

一张 create table 迁移。content-upsert 补与 key_points 同构的
upsert + tombstone 链路（要点 tombstone 用单 JSON 数组参数 + unnest 的
纪律照抄——平铺参数会撞 PG/PGlite 参数上限，AGENTS.md 坑 #6）。

### 2.4 lib/options 最小输入类型

`OptionCard` 加 `misconceptions?: OptionMisconception[]`，
`OptionMisconception = { id: string; text: string; why: string; retiredAt?: string }`。
零依赖纪律：只列出题用得到的字段（`movedFrom` 不参与出题，不进）。

### 2.5 不进 exclusion 账本

错误项对任何题都天然不成立、不进任何池，`excludeAsDistractorFor`
对它无意义。**新增错误项不触发「要点 × 目标题」的 LLM 互斥判定**——
这是内容生产流程的重大减负（现状每加一批卡要跑 `content:exclusion
--judge` 烧钱）。

## 3. 抽取算法（`lib/options/draw.ts` / `prepare.ts`）

### 3.1 优先级

```
缺口 count = 选项总数 − 正确要点数        // 9 − N（多选型）；atomic 为 4 − 1 = 3
own        = 本卡活错误项（!retiredAt）
取专属     = min(own.length, count) 条
池缺口     = count − 取专属数 → 走现状三层池（互斥过滤、双向回填、
             枯竭抛错，全部照旧）
```

- 专属错误项数 ≤ 缺口：全用。atomic 配满 3 条时整卡零池依赖。
- 专属错误项数 > 缺口：按抽取 seed 选子集（固定模式下选稳定的子集，
  换血模式下跨复习轮换展示）。
- `layerCounts` 同块/跨块分层只作用于池抽取部分——专属错误项没有块
  归属语义，不分层。
- 选项总数恒 9 / atomic 恒 4 不变（「选项个数不携带正确数信息」的
  既有铁律不受影响）。
  **2026-10-19 修订**：用户反馈 9 选项阅读负荷过重（「干扰 2 条就够」），
  多选型总数收至 **7**——恒定铁律不变（恒定干扰数会把答案数编码进选项
  个数，仍是 §4.3 挡掉的作弊面）；主流 5 要点卡（48%）恰好 2 条干扰、
  4 要点卡（40%）3 条、6 要点卡 1 条（靠 mc 补位）。atomic 4 选 1 不动。
  MIN_BLOCK_POOL 下界（12/8/6）**保留不动**——下界含 2 倍余量、防互斥
  登记吃池，抽取量降了但余量价值不变。

### 3.2 seed 分档：熟练前固定，熟练后换血

| 掌握度 s | 抽取 seed | layerCounts 的 s |
|---|---|---|
| s < 2/3（未熟练） | `hashSeed(userId, cardId, -2)` 恒定哨兵 | **冻结为 rat(0,1)** |
| s ≥ 2/3（熟练） | `hashSeed(userId, cardId, reviewIndexBase+i)`（现状） | 真实 s（现状） |

分档作用于**整个抽取**（专属错误项选子集 + 池抽取），与卡是否配了
错误项无关——存量卡未熟练期同样固定池干扰项集合（见 §2.2 修正）。

**固定分支必须同时冻结 layerCounts 的 s**（审核阻断项修正）：s 每次
复习后被 weightedS 重算，新卡首次答个半对 s 即从 0 跳到 ~1/2——仍在
未熟练区间但跨过 layerCounts 的 3s=1 配额边界（1:2 → 1:1），哨兵 seed
相同配额不同，集合照样变，「稳定记忆锚点」被掏空。冻结为 rat(0,1)
（最低配额档）后，固定分支的整套抽取真正只依赖 `(userId, cardId,
pools)`，§3.3 的复现声明才成立；跨档到 s≥2/3 时自然切到真实 s。

关键实现细节：

1. **抽取 seed 与排列 seed 必须拆开**。固定抽取集合后，若排列也固定，
   K 次复习选项位置一模一样，「防位置记忆」失效。因此：
   `permRng = seedRng(hashSeed(userId, cardId, reviewIndexBase+i))` 恒用
   现状派生（排列、以及 sequence 的呈现序全部不变）；只有干扰项**抽取**
   按上表分档换 rng。熟练分支下抽取与排列消费同一个 rng 实例的现有序列
   ——现状行为是熟练分支的严格子集，回归风险最小。
2. **哨兵 -2 保留**：-1 已被 sequence 呈现序占用，-2 专用于未熟练抽取。
3. **s 是队列构建时的当日快照**（`queue.ts` 传 `st?.s`），当天内恒定，
   跨天 s 升过 2/3 自然换血、退步回 2/3 以下回到固定集合重新巩固。
   当天内的「再练错题」触发重建队列时用已演化的 s——若仍 <2/3，固定
   分支因 s 冻结集合不变；跨过 2/3 则切换分支，符合语义。
4. 专属错误项的取用：`own ≤ 缺口` 全用；`own > 缺口` 按 §3.1 选子集
   （固定分支 = 稳定子集，换血分支 = 跨复习轮换）——子集轮换正是
   「每条都值得见」的实现手段。换血分支的换血作用于子集选择、池抽取
   与排列三处。
5. `s` 语义沿用 `layerCounts` 的 3s≥2 分档线（两三轮答对≈熟练），常量
   写死在 `lib/options`，可调。

### 3.3 复现性

`review_log.distractorIds` 照记（专属错误项记其 id，池干扰项记要点 id）。
固定模式下 (userId, cardId) 即可复现整套抽取，复现性比现状更强。
replay / 离线引擎 / 判分（只看 `correctIndices`）零改动。

## 4. 错勾溯源展示（`DrillFeedback.tsx`）

`PreparedVariant` 加 `misconceptionWhy?: Record<number, string>`
（呈现下标 → why）。`wrongAttributionOf` 降级链：

1. `misconceptionWhy?.[i]` 存在 → **「常见误解：{why}」**
2. `distractorOrigins?.[i]` 存在 → 现状「属于《{题面}》」
3. 都没有（旧缓存变体）→ 现状通用文案「属于本大类的另一道题」

字段缺省即回退，前端向后兼容模式与 `distractorOrigins` 完全同构。

## 5. 审计闸门（`lib/content/audit.ts`）

### 5.1 MIN_BLOCK_POOL 豁免（保守规则）

**活错误项数 ≥ 抽取缺口的卡（多选型 `9−正确要点数`，atomic 为 3）跳过
同块池检查；部分配的卡照旧检查。**

- 存量卡未配错误项 → 行为不变 → **38 条已知债指纹不动，不触发 stale
  大清洗**。
- 配满的卡若恰在债表里 → audit 报 stale → 按既有机制同步删行，债只能
  减不能增的纪律不变。
- 不重构闸门语义（它检查的是「同块要点池规模下界」，本豁免只按卡短路），
  diff 最小。
- atomic 只需 3 条错误项即豁免——最易配满、对单选收益最大。
- **豁免同步作用于 `poolMarginsOf`**（审核修正）：`content:exclusion
  --apply` 的触线闸门用同一 MIN_BLOCK_POOL 口径（exclusion.ts 自述
  「与运行时逐字同规则」），audit 与它必须同豁免——否则配满卡 audit
  绿了、--apply 仍拒落盘，内容工作流被假触线卡死。

### 5.2 新闸门（便宜的真实性代理，CI 可判）

1. 错误项 `text` 不得与**全库任何活要点**（本卡、同块及跨块）的文本
   **完全相同**，且卡内 mc 文本互异——kp id 只保证块内唯一，跨块要点
   文本完全可能相同，届时同一变体出现两条同文选项、一判对一判错
   （审核修正：查重范围从「本卡+同块」扩到全库活要点文本 Set，构建期
   一次装配，成本可忽略）。
2. `id` 全库唯一 + `movedFrom` 改名守卫（与 key_points §7 同构）：
   `.ids.lock` 增加 `mc:<id>` 行（无块前缀，与 §2.1「全库唯一」一致），
   `checkIdLock` 与 `audit-cli --write-lock` 两处同步扩展——不扩展即
   fail-open 守卫（review_log.distractorIds 将存 mc id，改名悬空历史）。
   **mc id 禁含 `#`**（tombstone unnest 拼接键约束，与 kp 同）。
3. `why` 必填在 zod 层挡（2.2）；mc 数量上限 `.max(8)`（keyPoints 的
   MAX=6 先例）。
4. **sequence 卡不得配 misconceptions**（superRefine 交叉校验）——
   sequence 分支在 drawDistractors 之前 return，配了就是无消费的死内容。
5. `content:new` 脚手架与 `checkPlaceholders`（现覆盖 question/detail/
   kp 文本）同步纳入 mc 的 text/why。

### 5.3 语义真伪不归机器；source 豁免是有意的

「错误项确实是错的」无法在 CI 里判。走既有的管理员审题闭环（线上发现 →
`report:pull` → 线下修卡）。audit 不挡这项，明确登记为人工职责。

**mc 不要求 source/verifiedAt（有意豁免，与 keyPointSchema 的强制
source 不同）**：mc 是反面教材，不是正确知识的载体——其「正确理解」
锚定在本卡要点与正文已有的官方 source 体系上；`why` 的断言质量由
作者自核 + 审题闭环兜底。若日后线上证明该兜底不够，再考虑给 why 加
可选 sourceRef，本期不做。

## 6. 迁移与部署

1. 一张 create table 迁移（`misconceptions`）。
2. content-upsert 补 misconceptions 的 upsert + tombstone（unnest 批量）。
3. **判分复现投影链路必须同步补齐（审核阻断项修正，「replay 零改动」
   撤回）**：`variantAt`（replay.ts）从 `CardSnapshot` 重算变体判分——
   注释里留着历史事故记录（曾因投影错位判了另一份卷）。快照若缺 mc：
   熟练分支下 mc 缺席 → 池缺口变大 → rng 消费序列不同 → `correctIndices`
   不同 → **判分与展示不同卷**（违反 AGENTS.md 铁律）；固定分支排列碰巧
   同形但 `distractorIds` 记错对象。必须改四处：
   `CardSnapshot` 加 `misconceptions`、`loadCardSnapshots`（adapters.ts）
   增查询、`variantAt` 与 `queue.ts` 的 `toOptionCard` 两处投影，以及
   `lib/content/types.ts` 的 `Card` 类型。
4. **存量 404 卡零改动**（已核实：404 即全部活卡源文件，卡级 retired
   为 0）；第一波只给 `frequency=high` 的卡配（用户用现有 python 模板
   流程生产，判分/审计不需要等全量配齐）。
5. 本地库与生产库都要重跑 `content:upsert`（content/ 是权威源，DB 不自动
   跟随——AGENTS.md 铁律）。
6. 零改动面（已核实）：免费墙（mc 不进任何池，queue.ts 池装配只读
   keyPoints；目标卡自身内容本就随队列下发，无新泄露面）、AI 问答
   （qa.ts 不消费干扰项）、sequence、离线引擎；exclusion 账本不触发
   （fingerprintOf 只哈希 kpText×targetQuestion，加 mc 字段不过期任何
   存量判定）。

## 7. 测试覆盖

| 层 | 用例 |
|---|---|
| lib/options 单测（node） | 专属优先/池补足序；s<2/3 集合恒定（跨 K 份、跨调用、**跨 s 演化**——s 从 0 变 1/2 仍在固定带内时集合不变）；s≥2/3 换血（锁定现状行为）；**s≥2/3 且无 mc 时输出与旧实现逐字节一致**（回归锁，机器验证「现状=熟练分支子集」）；**固定集合时排列仍随 i 变**（防位置记忆不回退）；错误项多于缺口按 seed 选子集（固定=稳定、换血=轮换）；退役错误项不出现；专属+池全枯竭仍抛错 |
| 存量测试迁移 | 现有夹具多为 s=0，上线后落入固定分支——「跨 reviewIndex 集合变化」类换血断言夹具改 s≥2/3；acceptance 的「21 次复习全扫」语义复核 |
| serve/replay 等价 | 下发变体 == variantAt 重算变体：**两分档 × 配/不配 mc 四象限**全覆盖（防判分与展示不同卷） |
| content 单测 | schema：strict 拒未知字段、why 必填、retiredAt/movedFrom 守卫、sequence 禁配 mc、.max(8)；audit：复制要点冒充（含跨块）→红、配满豁免（含 poolMarginsOf）→不挡、存量卡行为不变、ids.lock 认 mc: 行 |
| PGlite 集成 | upsert 幂等；tombstone；队列变体下发含错误项文本与 why；`distractorIds` 记错误项 id 且固定模式可复现 |
| 同构守卫扩展 | `tests/app/scoring-isomorphic.test.tsx` 四卡型造卡全部加 misconceptions 路径 |
| jsdom | `DrillFeedback` 溯源三级降级链 |

## 8. 非目标

- 不废除三层池与 exclusion 账本（存量机制照旧运转，专属错误项是前置层）。
- 不做「全量 404 卡一次配齐」（渐进，先高频卡）。
- 不做错误项的 LLM 自动生成（生产方式仍为人工 python 模板；自动生成的
  「确实错」验证成本比人工写还高）。
- 不改选项总数（9/4）、不改判分、不改掌握度算法。

## 9. 风险与开放问题

1. **内容质量是唯一硬风险**：错误项写成真命题（「确实错」验证）没有机器
   闸门，依赖作者自核 + 线上审题闭环兜底。第一波高频卡配完后建议人工
   抽检一遍再上生产。
2. 固定模式下专属错误项多于缺口时，子集由哨兵 seed 决定——哨兵
   `hashSeed(userId, cardId, -2)` 本含 userId，**不同用户天然抽到不同
   子集**（排列亦因人而异），无需额外动作。
3. s 在同一天内恒定：当天内多次复习同一张卡，集合不变、排列变——语义
   干净，但文档化时要写明「换血的最小粒度是天」（当天内「再练错题」
   重建队列亦然，见 §3.2.3）。
4. 审核确认过的兼容面：exclusion 账本指纹不过期、免费墙无新泄露面、
   判分只读 correctIndices、旧缓存变体字段缺省回退、queue 两处调用
   自动继承——以上均有代码依据，实施时以回归测试锁定。


