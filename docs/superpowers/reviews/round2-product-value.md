# Round 2 敌意评审 · 立项依据与产品价值

- 评审对象：`/private/tmp/cc/docs/superpowers/specs/2026-09-15-interview-drill-design.md`
- 视角：早期投资人 / 竞品分析师。**不覆盖排期算法的数学正确性**（见 `round1-scheduler-correctness.md`）
- 日期：2026-09-16
- 方法：所有关于竞品能力的断言都实际查证并附链接。所有覆盖率、时间预算的数字都用文档自己给的参数算。

---

## 结论先行

三条判断，按致命程度排序：

1. **§3 的核心洞察是事实错误。** "考试日期驱动排期是 Anki 类产品结构上做不到的" —— RemNote 的 Exam Scheduler 已经把 §5 的每一条（设考试日 / 每卡期望复习次数 / 每日容量 / 落后 catch-up / **考前最后几天每张卡再过一遍** / 加料过多时告警并建议收窄）逐条实现并上线，而且 RemNote 自己就拿"Anki 没有这个"当卖点在打。Quizlet 从 2017 年起就有 set due date。Anki 本体有 Maximum interval + custom scheduling JS，社区有 Exam Scheduler / Exam Notifier 插件，官方 FAQ 有一篇专门讲考前配置的文档。**整个立项依据不成立。**

2. **§11 第 4 条验收标准数学上不可能达成。** 第一版只做"并发"一个大类，而真实 45 分钟后端一面里并发相关问题占比是 0–20%。要求"被问到的题有 50% 在这刷到过"，分母无论怎么取都够不着。反过来，把分母偷偷缩成"并发类八股题"后这个指标能达标，但它测的是题库质量，**一个免费 markdown 文件也能拿同样的分**。

3. **§6 的"15–25 秒/张"与 §3 的"先出声说一遍"互相否定。** 口述一个 3–6 要点的八股答案至少 30–45 秒，加上预测、勾选、看反馈，单卡真实时长 60–90 秒。按设计出声，45 题/天 = 45–70 分钟而非文档写的 15–20 分钟，时间预算爆 3–4 倍；不出声，keyPoints 勾选就没有"刚才"可勾，退化成"看到答案觉得我知道"——正是 §3 声称要消灭的那个偏差。**这是个二选一的死结，两边都通向产品失效。**

---

## 1. 立项依据是否成立

### 结论：**不成立。** §3 的核心断言是可查证的事实错误，且 §13 决策表把它写成了排期算法一栏的全部理由。

文档的原话（§3）：

> 本产品的差异化即在此：**排期目标是面试当天的记忆强度最大化**，而非长期留存。这是 Anki 类产品结构上做不到的事（它们没有"考试日"这个概念）。

逐条拆。

#### 1.1 RemNote 已经完整实现了 §5

RemNote 的 **Exam Scheduler** 是一个已上线的功能，把它和本文档 §5 并排放：

| 本文档 | RemNote Exam Scheduler |
|---|---|
| §5.2 ① `examDate` 设定窗口 | 用户设置考试日期，从当前日到考试日算出学习时间线 |
| §5.2 ③ 复习次数由窗口决定 | 用户设定 "the desired number of repetitions for each card" |
| §5.2 ④ `newPerDay` 新卡配额 | "introduces new cards at a rate that ensures you've learned them all by your exam date" |
| §5.3 `dailyCapacity` 硬约束 | 自动计算每日目标，可自定义上限，加料/落后时自动调整 |
| §5.2 ④ **末端窗口**：所有卡末次落在 `[E-fw+1, E]` | "in the last few days before your exam, every flashcard is shown one last time" |
| §5.4 超载检测 + 收窄建议 | "RemNote shows a warning and suggests an adjustment, such as a catch up period" |
| §5.5 逾期卡并入队首 | 落后时发提醒并给 catch-up 方案，可接受或修改 |

来源：[RemNote Exam Scheduler 功能页](https://www.remnote.com/feature/exam-scheduler)、[Preparing for an Exam 帮助文档](https://help.remnote.com/en/articles/9101991-preparing-for-an-exam)、[Exam Study Plan Calculator](https://www.remnote.com/exam-study-plan-calculator)

这不是"有个相似的东西"。这是**同一个设计的逐条对应物**，包括 §5.2 ④ 那个被文档当作精巧让步来写的"末端窗口"。RemNote 的营销页面还把 Exam Scheduler 明确列为"Anki 不提供的功能"——也就是说，本文档 §3 那句话，RemNote 三年前就说过一遍，并且据此做出了产品。

#### 1.2 Quizlet 从 2017 年就有考试日期驱动排期

Quizlet Learn 在 2017 年 SXSWedu 发布时的核心卖点就是：创建学习集 → 输入你需要掌握材料的日期（考试日）→ 生成自适应学习计划 + 提醒。应用内路径是 Learn options → "Set due date" → 输入考试日期。

来源：[Introducing the new Quizlet Learn](https://quizlet.com/blog/introducing-the-new-quizlet-learn)、[Campus Technology 报道](https://campustechnology.com/articles/2017/03/09/quizlet-debuts-study-feature-that-helps-students-study-efficiently.aspx)

#### 1.3 Anki "结构上做不到"是错的

Anki 本体提供的、与考试窗口直接相关的机制：

- **Maximum interval**（Deck Options）："controls the maximum number of days a review card will wait before it's shown again"，默认 100 年，文档明说其用途是 "trade extra study time for higher retention"。把它设成剩余天数，§3 描述的"D11 答对排到 D26 落在面试之后"当场消失。这是一个**内置的、一个输入框就能解决的**反例。
- **Custom Scheduling**（Deck Options → Advanced）："more control over Anki's scheduling of cards by using your own JavaScript"。任意自定义调度逻辑，包括按考试日封顶。
- **Filtered Deck / Custom Study**：官方手册第一句就写它的用途包括 "cramming before a test"，可以不重排地把全部卡过一遍——正是 §5.2 ④ 末端窗口想要的效果。
- **官方 FAQ 有一篇专门文档**《Settings for using Anki to prepare for a large exam》，给的建议是总卡数 ÷ 可用天数算 new/day，并且 "generally it is a good idea to leave 2–4 weeks between the time you will study the last new material and the time you will be tested"。**这就是 §5.2 ① 的 `buffer`。** Anki 官方在教用户手算本文档 §5.2 的东西。

来源：[Anki Manual · Deck Options](https://docs.ankiweb.net/deck-options.html)、[Anki Manual · Filtered Decks](https://docs.ankiweb.net/filtered-decks.html)、[Anki FAQ · Settings for using Anki to prepare for a large exam](https://faqs.ankiweb.net/settings-for-using-anki-to-prepare-for-a-large-exam.html)

社区插件层面：

- **📅 Exam Scheduler v1**（[ankiweb 1640946074](https://ankiweb.net/shared/info/1640946074)）：输入考试日期，自动调整每日卡片数以在考试前过完全部卡，支持 buffer days / skip days / 子牌组 / 按 tag 规划，明确写着基于上面那篇官方 FAQ 的思路。
- **Exam Notifier**（[ankiweb 236593452](https://ankiweb.net/shared/info/236593452)）：在 deck options 里填考试名和日期，**当某张卡的下次到期日会落在考试之后时通知你并提供提前重排**。这一句就是 §3 那段论证的完整实现。
- **FSRS Helper 的 Advance**（[open-spaced-repetition/fsrs4anki-helper](https://github.com/open-spaced-repetition/fsrs4anki-helper)）：基于当前与目标 retrievability 缩短未到期卡的间隔，"minimize damage to long-term learning"，用途明写为考前提前复习。配 Load Balance 做每日负载均衡（= §5.3 装箱）。
- **Desired retention**（FSRS 内置，0.70–0.99）：调高即全局缩短间隔，是社区最常用的考前手段。

来源：[fsrs4anki-helper README](https://github.com/open-spaced-repetition/fsrs4anki-helper/blob/main/README.md)、[Anki Forums · How do I use FSRS for exam?](https://forums.ankiweb.net/t/how-do-i-use-fsrs-for-exam/43631)

#### 1.4 公允的版本是什么

唯一站得住的说法是：**Anki 没有内置的 deadline 调度器**。这确实是论坛上最常被请求的调度功能之一，官方到 2025 年 11 月为止无实现承诺（[Deadline/exam date feature 讨论串](https://forums.ankiweb.net/t/deadline-exam-date-feature/56675)）。

但"官方没内置" ≠ "结构上做不到"，而 §3 和 §13 决策表押的是后者。而且就算只看"没内置"，RemNote 内置了、Quizlet 内置了。**中间那层——"有考试日期概念的间隔重复产品"——不是空白，是已经拥挤的。**

顺带一提，同一个论坛串里开发者的模拟结论值得抄进风险章节：不管用什么方法，deadline 调度都会在 deadline 前造成 "huge buildup" 的复习堆积。这正是 round 1 实测出的 `day0: 420 张` 的同一个现象，说明它不是本文档实现得不好，是这类问题的固有性质。

#### 1.5 这对整个文档意味着什么

三处必须改：

- **§13 决策表"排期算法"一行的理由栏作废。** "唯一为面试当天优化的方案，也是 Anki 类产品结构上做不到的"——两个分句都是假的。
- **§3 第一段洞察降级。** §5 仍然是有价值的工程（round 1 已经把它打磨得相当扎实），但它是**实现质量**，不是**差异化来源**。一个已经有三家产品做过的功能，做得更对不构成立项理由。
- **差异化如果还存在，只剩两处：中文后端八股的内容质量，和口述形态。** 而这两处恰好是文档 §10 砍到只剩并发一个大类、§12 ③ 推给第二版的两块。**文档把唯一可能的护城河列为"明确不做"，把做不成护城河的东西写成了核心洞察。**

---

## 2. 留存与商业模式

### 结论：**有条件成立，但文档选的条件是错的。** "一次性工具活不了"是个错误命题——恰恰相反，求职是软件里付费意愿最高的窗口之一。真正不成立的是本文档选中的那个组合：一次性使用 **+ 主动放弃收费 +** 保留全部持续成本。

#### 2.1 "面试完就流失"不是问题，而是这个品类的正常形态

证据：这个品类里活得最好的产品全都是一次性的，而且都收钱。

- **面试鸭**：11,184 道题，30+ 方向，永久会员 129 元起（官方称正式价将涨至 399+）。[官网](https://www.mianshiya.com/) / [会员页](https://www.mianshiya.com/vip)
- **牛客大会员**：30/90/365 天分别 17.9 / 39.9 / 119.9 元。[牛客会员页](https://www.nowcoder.com/users/vip/detail)
- **LeetCode Premium**：月付被官方定位为 "the best plan for short-term subscribers"，年付约 $13/月省 60%+。真实模型是**周期性重订阅**——拿到 offer 退订，2–4 年后下次找工作再回来。[LeetCode Premium](https://leetcode.com/subscription/change/)

LeetCode 的订阅页上，转化文案（"我拿到了 Amazon 的 offer"）和退订触发点是同一个事件。这个行业早就接受了这一点，并把定价结构设计成在那个窗口里把钱收完。

所以 §12 没有列、但本该列在第一位的风险不是"用户会流失"，是"**用户流失前你没有向他收过任何东西**"。

#### 2.2 §10 与 §13 的矛盾有多严重：严重，而且是方向性的

- §13 第一行决策：**目标用户 = 做产品给别人用**，理由栏是 `—`（空的）。
- §10 明确不做：**付费**、推送提醒、打卡分享、UGC、排行榜。

这五项砍掉的东西有个共同点：它们是"给别人用"的产品获取反馈、传播、和维持的**全部**渠道。免费产品的唯一货币是留存和口碑；这个产品设计上留存必然趋 0（面试完即走），传播渠道被砍（无分享无排行），召回渠道被砍（无推送），收入为 0。

而成本端是持续的：§9 自己算了 150 题 × 10 分钟 = 25 小时人工审核，"需要懂行的人做，外包不了"。这还只是初始成本。§4.2 的 `appliesTo` 字段和文档举的"偏向锁在 JDK 15 后被废弃"这个例子，恰好证明八股内容有**版本衰减**——JDK 每半年一个版本，Spring / Redis 各自有节奏，意味着**持续的**审核成本对上**零**收入。

这不是"商业模式没想好"，这是一个结构性亏损，而且亏的是最稀缺的那种资源（懂行的人的时间）。

#### 2.3 判断

如果 §13 第一行真的是"做产品给别人用"，那 §10 的"不做付费"必须改。一次性工具唯一可行的商业模式就是在那个高付费意愿的窗口里收钱——而这个窗口宽度是几周，用户在那几周里愿意为一个 offer 的期权付 129 元（面试鸭的实际成交价证明了这一点）。

如果作者其实是在做一个自用/练手项目，那 §13 第一行应该改成那样写，后面一半的设计（云同步、多设备冲突、GitHub OAuth、SEO 获客、内容质量闭环的 80% 用户漏点统计）都可以删掉——那些是给"别人用"准备的，而 §11 第 4 条的验收只找 5–10 个人。**这两种定位对应的文档长度差 3 倍，现在这份是两者的混合体。**

---

## 3. AI 时代的存在意义

### 结论：**不成立。文档根本没有回答这个问题，也没有意识到需要回答。**

全文 13 节里，"AI" 出现三次，全部是把 AI 当**生产工具**（§9 生成答案、§13 内容生产决策、§12 ③ "根治需要 AI 口述判分，属第二版"）。**没有任何一处把通用 AI 当作竞品来讨论。** 这在 2026 年是一个不能接受的缺口。

#### 3.1 对手已经在那儿了

- **ChatGPT Study Mode**（2025 年上线，全平台、全模型、全订阅层级）：苏格拉底式提问、出小测、开放题、给反馈指出薄弱点，明确定位为"检查你的理解"。用户输入一句"给我出十道 AQS 的面试题并批改我的回答"就得到本产品主循环的全部输出。[Introducing study mode | OpenAI](https://openai.com/index/chatgpt-study-mode/) / [Study mode FAQ](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)
- **牛客 AI 模拟面试**：按公司 + 岗位拆分真题卷（字节 Java / 美团 Java / 华为 / 阿里等专项）。[nowcoder.com/interview/ai](https://www.nowcoder.com/interview/ai/index)
- **牛面 AI 面试**（小林 coding）：读简历生成贴合个人的模拟面试，校招模式八股占比更高，社招模式偏项目深度，难度三档，4000+ 免费题库。[xiaolincoding.com/project/niumian.html](https://www.xiaolincoding.com/project/niumian.html)
- **Final Round AI**：音频优先的 mock 模式，**强制开口录音而非打字**。

#### 3.2 致命的部分：本产品的核心机制在通用 AI 面前是反向的

§3 的第二个洞察是"八股面试是口述的，翻卡自评存在熟悉感 ≠ 能说出来的偏差"。本产品的解法是**让用户自己勾选**"我刚才真的说到"。

通用 AI 的解法是**真的听你说，然后告诉你漏了什么**。

这不是本产品弱一点，是它在自己声称的核心洞察上被完整超越。§12 ③ 自己承认："根治需要 AI 口述判分，属第二版。第一版接受这个精度损失。" —— **文档把竞品的现有能力写成了自己的第二版。**

#### 3.3 唯一守得住的护城河候选，以及它为什么也守不住

理论上通用 AI 守不住的是**跨会话的排期状态**：ChatGPT 不会记得你三周前哪条要点漏了，也不会明天主动提醒你。这是本产品真正剩下的东西。

但：

1. 文档 §10 **明确不做推送提醒**。没有推送，"明天主动提醒你"这一半直接没了，只剩"用户自己想起来打开"——而那个动作 ChatGPT 也能承接。
2. RemNote 已经把 AI 生成卡片 + Exam Scheduler 合在一个产品里了。
3. 模型侧的 memory / projects 正在快速补齐这一层。

结论：文档必须新增一节回答"为什么不直接问 AI"。如果答不上来，§13 第一行的"做产品给别人用"就没有依据。

---

## 4. 用户行为假设逐条评估

文档押了四个未经验证的行为假设。四条里三条不成立，一条与另一条互斥。

### 4.1 用户会设定面试日期 —— **不成立，且比 §12 ① 自评的更严重**

§12 ① 认为问题是"用户嫌麻烦不设"，缓解方案是"做进首次激活流程"。这个诊断是错的。

真实求职里，"什么时候面试"**不是一个日期**，是一个持续 1–3 个月的滚动过程：投简历 → 等回复 → 面试方提前 2–5 天约时间 → 一面 → 二面 → 三面 → HR 面，每一场都是独立约的。于是：

- 用户"开始准备"那天，**根本没有日期可填**。这正是激活流程拦住他的那一刻。
- 等他有了日期，离面试通常只剩 3–5 天。此时 `R=4`，`buffer=1`，`E=3`，§5.2 的阶梯退化成 `[0,1,3]`——三次复习，其中两次在同一周内。**产品最需要排期的时候排不了，能排的时候用户没有日期。** 这是时间结构不匹配，不是 UI 摩擦。
- 强制激活流程的实际后果是用户填一个**假日期**。而假日期比没日期更糟：§5.5 把 `examDate` 变更列为三个重排触发条件之一，用户每约到一场面试就改一次日期 → 每次重排 → §6 屏③ 那排圆点每次都变。文档自己在 §6 写过判词："用户感知到的东西是错的，比感知不到更糟。"

**修法方向**：把单一 `examDate` 换成"最早可能面试日"或滚动窗口（例如"我未来 4 周内随时可能面试"），排期目标改成"在窗口内任意一天都保持可接受的记忆强度"。这在数学上更难（round 1 的范围），但在产品上是唯一诚实的模型。

### 4.2 用户会诚实勾选 —— **不成立。这不是"可能虚高"，是被激励对齐了的作弊通道**

§12 ③ 把这条写成精度损失。它比那严重：**系统把"少干活"的奖励直接绑在"多勾"上**。

- 勾得多 → §5.2 ② 起始档更高 → 间隔更长 → 这张卡以后少见几次 → 每天队列更短。
- 勾得多 → §4.4 块掌握度更高 → 知识地图变绿 → 即时的情绪奖励。

两条奖励都指向同一个方向，没有任何一条反向的力。这不是"用户有动机自欺"，是产品**付钱请他自欺**。

§12 ③ 的缓解措施是"预测环节和漏点统计能侧面暴露长期高估者"。这无效：**预测值也是用户自己填的**。一个想省事的用户会同时压低预测、抬高勾选，于是系统看到的是"预测 2 实际 5"——一条漂亮的"元认知正在改善"曲线。**两个信号由同一个有动机的人产生，互相验证不了。**

这条还会污染 §4.3 的第三个作用（"某条要点 80% 用户都漏 → 说明写得太偏"）和 §9 ④ 的内容质量闭环：如果勾选系统性虚高，漏点统计就系统性偏低，内容迭代会把**难的要点误判为好要点**，方向是反的。

### 4.3 用户会"先出声说一遍" —— **不成立。这是全文最脆弱的单点假设**

文档自己写的使用场景：§8.3 "地铁刷题必然断网"、§2 "移动端优先"、§10 "每天 45 题（约 15–20 分钟）"。

地铁、办公室、通勤路上、合租客厅——这就是移动端碎片时间刷题的**全部**场景，而它们全都是不方便出声的场所。产品对这个问题的全部应对是 §6 屏① 的一行提示文案"先出声说一遍"。

对比：Final Round AI 的 mock 模式是音频优先、强制录音，用产品形态**逼**用户开口。本产品只有一行字。

后果不是"效果打点折"。keyPoints 勾选的语义是"我**刚才真的说到**的条目"。如果用户没说，那就没有"刚才"可勾，用户只能对着展开的要点判断"这条我知道吗"——**这正是 §3 开头定义的、产品声称要消灭的那个偏差**。§3 第二个洞察、§4.3 整套设计枢纽、§6 的三屏流程，全部架在这一条假设上，一起失效。

### 4.4 用户愿意每天刷 45 题 —— **与 4.3 互斥。这是本轮发现的最硬的内部矛盾**

先看这个数字是怎么来的：§5.4 说 150 张卡需要约 900 次复习，900 / 21 天 ≈ 43，所以 §10 把默认 `dailyCapacity` 定为 45。**容量不是从用户耐受推出来的，是从内容量倒推出来的。** 文档自己在 §10 承认了这一点（"若产品上线后发现每天 45 题超出用户耐受，应优先砍题量"）——一个未验证的行为假设被写进了算法的默认参数。

更硬的问题是时间预算。§6 写"一张卡三屏，目标 15–25 秒"，§10 写"45 题（约 15–20 分钟）"，两个数字内部一致（45 × 20 秒 = 15 分钟）。但这 15–25 秒里要装下：

| 动作 | 现实耗时 |
|---|---|
| 读题面 | 3–5 秒 |
| **出声讲完一个 3–6 要点的八股答案**（如"AQS 是怎么实现独占锁的"） | **30–60 秒** |
| 点预测按钮 | 2 秒 |
| 逐条勾选 3–6 项 | 8–15 秒 |
| 看屏③ 掌握度环 + 漏点 + 圆点 | 5–10 秒 |
| **合计** | **50–90 秒** |

光"出声说一遍"这一步就超过整卡预算的上限。**15–25 秒的时间预算在结构上排除了出声。**

于是：

- 按设计出声 → 单卡 60–90 秒 → 45 题 = **45–70 分钟/天**，是文档承诺的 3–4 倍，一次性击穿"快速刷题"这个 §13 决策的理由。
- 不出声以守住 15 分钟 → 4.3 的失效链条触发，核心机制崩掉。

**两条路都通向产品失效，而文档同时写下了这两个互斥的数字。**

---

## 5. 内容规模：150 道并发题能不能达到 50% 覆盖

### 结论：**§11 第 4 条的验收标准不可能达成。同时，150 道并发题在它能达标的那种读法下大到毫无意义。两个方向同时错。**

#### 5.1 一场 45 分钟后端一面到底问多少、问什么

从公开面经样本：

- **字节测开实习一面（45 分钟）**：自我介绍 + 项目 + 计算机网络（分层模型、TCP/UDP、HTTP 请求头、HTTP 方法、TCP 拥塞控制）+ 数据库（两道 SQL）+ 手撕两题 + 操作系统（死锁分析、环路等待、如何避免）+ 反问。八股点约 10 个，其中并发相关 = 死锁那 3 个（而死锁通常归 OS 章节）。[来源](https://ceshiren.com/t/topic/17560)
- **字节后端一面（已 offer）**：数据库索引、主键、ping 用什么协议、数据链路层作用、TCP 四次挥手、SYN 泛洪、输入网址到页面显示、HTTPS 连接过程 + 2–3 道算法题。八股点约 8–10 个，**并发相关 0 个**。[来源](https://leetcode.cn/discuss/post/3468205/)

典型节奏：自我介绍 3–5 分钟 → 项目深挖 10–15 分钟 → 八股 15 分钟 → 手撕 10–15 分钟 → 反问 2–3 分钟。八股题 10–20 道，方向固定在网络 / 操作系统 / 数据库 / Redis / 语言基础 / 框架 / 分布式 / 并发 这 8 个左右的大类里。

#### 5.2 算覆盖率

§11 第 4 条的原文是："你被问到的题里，有多少在这刷到过"，阈值 50%。分母有三种读法：

| 分母取法 | 一场面试的规模 | 并发能占 | 50% 可达？ |
|---|---|---|---|
| 被问到的**全部**问题（含项目深挖、手撕、反问） | 20–30 个 | 0–3 个 | **0–12%。不可能** |
| 只算**八股题** | 10–20 个 | 0–3 个 | **0–20%。不可能** |
| 只算**并发类八股题** | 0–3 个 | 0–3 个 | 可达 50–100%，但见下 |

前两种读法下，**即使 150 道并发题命中率 100%**，覆盖率上限也就是并发在面试里的天然占比，约 10–20%。50% 这个阈值不是"很难达到"，是**被第一版范围（§10：并发一个大类）在数学上排除了**。

第三种读法能达标，但那时这个指标：

- 分母经常是 **0 或 1**（上面两个真实样本，一个 3、一个 0）。5–10 个用户里会有相当一部分人分母为 0，指标无定义。
- 即使有数，它测的是"并发题库选题准不准"，不测"产品有没有用"。**JavaGuide 的并发章节、小林图解的并发部分，能拿到同样甚至更高的分数，而且免费。** 一个无法区分本产品和一个免费 markdown 文件的验收标准，是失效的验收标准。

#### 5.3 反过来看：150 道对"并发"这一类来说大到荒谬

一场面试问 0–3 道并发题。150 道并发题是这个数字的 **50–150 倍**。

把 §5.4 的数字接上：150 张卡 × 约 6 次复习 = 900 次复习，按乐观的 20 秒/次 = **5 小时**；按 5.2 节算出的真实单卡时长（出声 60–90 秒）= **15–22 小时**。

用户投入 5–22 小时的复习，换取一场面试中 0–3 个问题的命中率提升。而同样 5 小时，读完 JavaGuide 并发章节 + 小林图解的操作系统和 MySQL，覆盖的是 3 个大类而不是 1 个。**在用户的时间预算里，本产品的 ROI 是负的。**

问题不是"题不够"，是**面太窄而单点太深**。150 这个数字是从"一个大类要显得像回事"推出来的，不是从"一场面试需要什么"推出来的。

#### 5.4 修法

两条路，选一条：

- **保持第一版只做并发**：把 §11 第 4 条改成可达成且有区分度的东西。例如"被问到的并发题里命中 ≥ 70%"**且**"用户能在面试中把该题的 keyPoints 说出 ≥ 3 条"——后半句才是本产品相对于 markdown 文件的增量，也是唯一值得测的东西。
- **保持 50% 阈值**：那第一版范围必须从"并发一个大类"扩到覆盖 8 个大类的高频题（每类 20–30 道，合计 150–250 道）。这反而更接近真实面试分布，而且**总题量不变**。代价是每个大类都只有浅层覆盖——但面试本来就是浅层广度测试。

第二条路我更推荐，且它不增加 §9 的 25 小时审核成本。

---

## 6. 竞品格局与本产品的位置

### 结论：**市场已经被填满，本产品在每一个维度上都不是最优，且在自己最强的维度上主动弃权。**

| 产品 | 解决了 | 没解决 | 规模/证据 |
|---|---|---|---|
| **JavaGuide** | 内容权威性、体系完整度、免费 | 记忆、排期、口述 | 156K+ GitHub star，640+ 贡献者，6200+ commit，2018 年起持续维护。[javaguide.cn](https://www.javaguide.cn/) |
| **小林 coding** | 深度理解（图解系统 400 图 / 16 万字）、面经汇总（50+ 公司）、**已有 AI 模拟面试产品（牛面）** | 记忆排期 | 1000 道面试真题 PDF、20 万字面试题、公众号免费发放。[xiaolincoding.com](https://xiaolincoding.com/) |
| **面试鸭** | 内容规模、商业化、AI 模拟面试、排行榜 | 无间隔重复 | **11,184 道题**，30+ 方向，永久会员 129 元起。[mianshiya.com](https://www.mianshiya.com/) |
| **牛客网** | 求职全链路（笔试真题 + 面经 + 内推 + AI 模拟面试），网络效应（招聘方在此） | 无间隔重复 | 会员 119.9 元/年。[nowcoder.com](https://www.nowcoder.com/) |
| **RemNote** | **考试日期驱动排期（= 本产品 §5 全部）** + AI 生成卡片 | 中文后端八股内容 | 免费层，宣称 100 万学生。[remnote.com](https://www.remnote.com/feature/exam-scheduler) |
| **Anki + 插件** | 间隔重复 + Maximum interval + custom scheduling + Exam Scheduler/Notifier 插件 | 内容、中文八股、口述 | 见 §1.3 |
| **ChatGPT Study Mode** | 出题 + 真实批改 + 口述（语音）+ 指出薄弱点 | 跨会话排期状态 | 全平台全模型可用。[openai.com](https://openai.com/index/chatgpt-study-mode/) |
| **本产品** | — | — | 150 道题（一个大类），0 收入 |

#### 6.1 位置分析

- **内容维度**：150 道 vs 面试鸭 11,184 道 vs JavaGuide 156K star。这是所有中文竞品里最弱的一档，差距是两个数量级。
- **排期维度**：被 RemNote 完整覆盖（§1.1），且 RemNote 免费。
- **口述/判分维度**：被牛面、牛客、Final Round AI、ChatGPT 超越，而本产品把它列为"第二版"（§12 ③）。
- **获客维度**：§7 押 SSR 长尾搜索（"AQS 是怎么实现独占锁的"这类查询）。这些查询的搜索结果第一页现在就是 JavaGuide 和小林 coding——一个 156K star、8 年外链积累的域名，和一个刚上线、只有 150 页并发内容的新站。**这条获客渠道在文档里被当成"选 Next.js 的实际理由"，但它实际上是所有渠道里最不可能奏效的一条。**
- **商业化维度**：主动弃权（§10）。

**唯一没人做的组合是"中文后端八股 + 考试驱动 SRS"。** 但这是一个需要解释的空白，而不是一个机会。

#### 6.2 对"空白 = 机会"的反驳，以及公允的另一面

面试鸭有 11,184 道题、付费用户、和 AI 模拟面试功能；牛客有更多。这两家完全有能力在一周内加一个"艾宾浩斯复习计划"——这在国内刷题小程序里是极其常见的功能（固定 5 分钟 / 30 分钟 / 12 小时 / 1 天 / 2 天 / 4 天 / 7 天 / 15 天 八周期复习，随处可见的实现）。**他们没加。**

一个功能在资源充足、数据充分的在位者手里长期不被实现，先验应该是"需求不成立"而不是"他们没想到"。这两家看到的用户行为数据，比任何设计文档都更了解程序员备考时到底在干什么。

公允的另一面：也可能是因为他们的商业模式是卖题库会员，SRS 提升的是留存而不是付费转化，所以不在优先级上。这个反驳是合理的。但它对本产品没有帮助——因为本产品**也不卖会员**（§10），于是它连"SRS 不提升付费转化"这个借口都用不上：它既不提升付费转化，也没有付费转化可提升。

---

## 总评

**按现在这份文档的形态，这个产品不该做。**

不是因为设计做得差——恰恰相反，§5 经过 round 1 之后是一份工程质量相当高的排期规格。问题在于这份文档解决的是**一个已经被解决三次的问题**（RemNote / Quizlet / Anki 插件），用**一个数学上无法验收的范围**（150 道并发题 vs 50% 覆盖率），押在**四条行为假设上，其中两条互斥**（15 秒预算 vs 出声说一遍），并且**主动放弃了唯一能支撑其持续成本的收入来源**（§10 不做付费 vs §9 的 25 小时 + 持续版本衰减维护）。

值得保留的有三样：`keyPoints` 的结构化要点设计（这是内容格式上的真创新，比大段答案更适合口述训练）、`sources` + `appliesTo` 的版本可验证性（这是八股内容里真实存在的痛点，JavaGuide 和面试鸭都做得不好）、以及 §9 "题目从面经来，答案对着一手资料生成"的内容管线。**这三样都在内容侧，不在排期侧。** 而文档把 §5 写了 130 行，§9 写了 25 行。

---

## 如果只能改一件事

**把验证顺序倒过来：先用零代码验证内容和口述，再决定要不要写 §5。**

具体做法，两周，不写一行代码：

1. 拉 10 个正在面试的后端程序员进一个群。
2. 每天发 10 道并发题（纯文字，Notion 或飞书文档即可），要求**用微信语音条回答**，你人工听并回复"你漏了哪两条"。
3. 观察三件事：
   - **有多少人真的发语音**（直接证伪/证实 4.3，本文档最脆弱的假设）
   - **面试后回收命中率**，并记下分母的真实构成（直接测出 §11 第 4 条到底能到多少、分母该怎么定）
   - **有没有人问"能不能付钱让你多发点 / 扩到其他大类"**（决定 §10 和 §13 的矛盾往哪边解）

这个实验的成本约 20 小时——**比 §9 的 25 小时审核还少**，而它能同时判定本报告 6 条结论里的 3 条（AI 护城河、口述假设、内容规模）。

当前计划的顺序正好相反：先花 25 小时审核 + 完整实现 §5–§8 的全部工程，然后在 §11 第 4 条一次性验收。**这是把项目里最大的三个不确定性全部推到了成本发生之后。** §10 已经正确地把工程轨和内容轨拆成并行，还差一步——在两条轨道启动之前，先跑一条零成本的验证轨。

如果第 3 步的三个观察结果是正面的，那时再回来写 §5，并且那时你会知道 `examDate` 该怎么建模（4.1）、`dailyCapacity` 该定多少（4.4）、150 道该怎么分布（5.4）——这三个参数现在全是猜的。

---

## 附：本轮建议的文档修改清单

| 位置 | 动作 |
|---|---|
| §3 第一段 | 删除"Anki 类产品结构上做不到"。改为"Anki 官方无内置 deadline 调度器（社区最常请求功能之一），但 RemNote/Quizlet 已内置；本产品在此不构成差异化" |
| §13 决策表"排期算法"行 | 理由栏重写。当前两个分句均为事实错误 |
| §13 决策表"目标用户"行 | 理由栏是空的（`—`）。这是全表唯一没有理由的决策，也是最需要理由的一条 |
| **新增 §3.3** | 回答"为什么不直接问 ChatGPT"。答不上来则 §13 第一行无依据 |
| §6 屏① / §10 | 修正"15–25 秒"与"先出声说一遍"的互斥（4.4）。两个数字必须改一个 |
| §10 | "不做付费"与 §13"做产品给别人用"二选一 |
| §11 第 4 条 | 阈值或范围改一个（5.4 给了两条路） |
| §12 | 新增风险：① 的诊断错误（日期是滚动窗口不是单点，4.1）；③ 低估（勾选虚高是激励对齐的，4.2）；新增"零收入对上持续内容维护成本" |
| §12 / §5 | 补记：Anki 开发者的模拟显示 deadline 调度必然在 deadline 前造成复习堆积，这是问题的固有性质，不是实现缺陷 |

---

## 来源

**间隔重复产品的考试日期能力**
- [RemNote Exam Scheduler](https://www.remnote.com/feature/exam-scheduler) · [RemNote 帮助文档：Preparing for an Exam](https://help.remnote.com/en/articles/9101991-preparing-for-an-exam) · [Exam Study Plan Calculator](https://www.remnote.com/exam-study-plan-calculator)
- [Quizlet：Introducing the new Quizlet Learn](https://quizlet.com/blog/introducing-the-new-quizlet-learn) · [Campus Technology 报道](https://campustechnology.com/articles/2017/03/09/quizlet-debuts-study-feature-that-helps-students-study-efficiently.aspx)
- [Anki Manual · Deck Options（Maximum interval / Custom Scheduling / Desired retention）](https://docs.ankiweb.net/deck-options.html)
- [Anki Manual · Filtered Decks](https://docs.ankiweb.net/filtered-decks.html)
- [Anki FAQ · Settings for using Anki to prepare for a large exam](https://faqs.ankiweb.net/settings-for-using-anki-to-prepare-for-a-large-exam.html)
- [AnkiWeb · 📅 Exam Scheduler v1](https://ankiweb.net/shared/info/1640946074) · [Exam Scheduler for Anki](https://ankiweb.net/shared/info/1006001625) · [Exam Notifier](https://ankiweb.net/shared/info/236593452) · [Exam Notifier Toolbar](https://ankiweb.net/shared/info/1621748155) · [Countdown To Events and Exams](https://ankiweb.net/shared/info/1143540799)
- [fsrs4anki-helper（Advance / Load Balance / Postpone / Easy Days）](https://github.com/open-spaced-repetition/fsrs4anki-helper) · [README](https://github.com/open-spaced-repetition/fsrs4anki-helper/blob/main/README.md)
- [Anki Forums · Deadline/exam date feature](https://forums.ankiweb.net/t/deadline-exam-date-feature/56675) · [How do I use FSRS for exam?](https://forums.ankiweb.net/t/how-do-i-use-fsrs-for-exam/43631)

**竞品与市场**
- [面试鸭](https://www.mianshiya.com/) · [面试鸭会员页](https://www.mianshiya.com/vip)
- [牛客网](https://www.nowcoder.com/) · [牛客 AI 模拟面试](https://www.nowcoder.com/interview/ai/index) · [牛客大会员](https://www.nowcoder.com/users/vip/detail)
- [JavaGuide](https://www.javaguide.cn/)
- [小林 coding](https://xiaolincoding.com/) · [面试题汇总](https://xiaolincoding.com/interview/) · [牛面 AI 面试](https://www.xiaolincoding.com/project/niumian.html) · [后端面经汇总](https://www.xiaolincoding.com/backend_interview/)
- [LeetCode Premium](https://leetcode.com/subscription/change/)

**AI 竞品**
- [OpenAI · Introducing study mode](https://openai.com/index/chatgpt-study-mode/) · [Study mode FAQ](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)

**面试结构样本**
- [字节跳动后端一面面经（已 offer）](https://leetcode.cn/discuss/post/3468205/) · [字节测开实习全面经（45 分钟一面）](https://ceshiren.com/t/topic/17560)
