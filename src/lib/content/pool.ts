import type { Card, CardType } from './types.js'
import { ATOMIC_OPTIONS_TOTAL, OPTIONS_TOTAL } from '../options/types.js'

/**
 * 同块可用干扰项池下界，**按 cardType 分派**。§4.3 的出题形式决定需求：
 *
 * - `enumeration` / `comparison`：7 选（2026-10-19 由 9 收窄）、正确要点最少
 *   3 条 → 单次最多吃 **4 条**干扰项；且 §4.3 分层表的 `s = 1` 档是
 *   **3:0**（干扰项全来自同块）。取 2 倍余量 = 12（下界未随总数收窄下调：
 *   余量还防互斥登记吃池，见文末另注）
 * - `judgment`：二段式，结论占一半，支撑要点部分需求减半 = 8
 * - `atomic`：4 选 1，单次 3 条干扰项，2 倍余量 = 6
 * - `sequence`：**排序题，选项就是本卡自己的步骤，不抽同块干扰项** = 0
 *
 * 早期版本对所有卡一视同仁要求 12 条，对 `sequence` 是定义上的错误。按 §4.3 的
 * 目标占比，那会让约 28% 的卡被一条与它们无关的规则卡住，作者只能往块里注水凑题。
 *
 * 为什么从 audit.ts 挪到这里：池下界有两个消费者 —— `content:audit` 的池校验，与
 * `content:exclusion --apply` 的池余量报告（互斥登记会吃掉池，触线必须在落盘前看见）。
 * 放在 audit.ts 会让 exclusion → audit → exclusion 成环。audit.ts 仍原样再导出它，
 * 既有调用方不受影响。
 */
export const MIN_BLOCK_POOL: Record<CardType, number> = {
  enumeration: 12,
  comparison: 12,
  judgment: 8,
  atomic: 6,
  sequence: 0,
}

/**
 * 专属错误项把抽取缺口**配满**的卡（spec §5.1 保守豁免）：整卡跳过同块池下界。
 * 缺口 = 选项总数 − 正确要点数（多选型 OPTIONS_TOTAL − 活要点数；atomic 恒
 * ATOMIC_OPTIONS_TOTAL − 1 = 3），常量直引 lib/options/types.ts——运行时真值
 * 与本豁免口径同一来源，与 `prepare.buildVariant` 逐字同口径。
 *
 * 豁免只认「配满」：部分配照旧全额检查，need **不**按活 mc 数折减——
 * 部分配时池仍要补缺口，池规模下界仍有运行时意义。
 *
 * 本函数是唯一实现，`auditLibrary`（content:audit）与 `poolMarginsOf`
 * （content:exclusion --apply 的触线判定）都必须走它——两处各写一份迟早漂移，
 * 漂移的形态是「配满卡 audit 绿了、--apply 仍拒落盘」，内容工作流被假触线卡死。
 */
export function mcGapFilled(card: Card): boolean {
  const liveMc = card.misconceptions?.filter(m => !m.retiredAt).length ?? 0
  const optionsTotal = card.cardType === 'atomic' ? ATOMIC_OPTIONS_TOTAL : OPTIONS_TOTAL
  const correctCount = card.cardType === 'atomic' ? 1
    : card.keyPoints.filter(kp => !kp.retiredAt).length
  return liveMc >= optionsTotal - correctCount
}

/**
 * 推论：池下界反过来定义了**块的最小可行规模**。
 * 对一张 k 条要点的 enumeration 卡，可用池 = 块内总要点数 T − k ≥ 12，
 * 即 T ≥ 12 + k。k 取上限 6 时 T ≥ 18 —— 按平均 4 条/卡约合 5 张卡。
 *
 * 这条约束应当反馈给内容侧：**一个块低于约 5 张卡就不该声明 ready**。
 *
 * **2026-10-04 实测更正**：曾以为「spec §2 定的每块 15-25 题远在这之上，真实块不会撞线」——
 * 错的。库里有 11 张 ready 卡的同块池**恰好等于下界、余量为零**（java/arraylist ×3、
 * java/hashmap ×3、java/equals-hashcode ×3、mysql/mvcc-undo ×2）：它们的块只有 5 张卡 ×
 * 4 条要点，正落在 T ≥ 12 + k 的边界上。所以任何一条同块互斥登记都会让它们触线，
 * 这是本设计的**已知前置工作**（评估：先补内容），不是异常。
 *
 * 另注：下界含 2 倍余量，**不是运行时的硬需求**（enumeration 单次最多吃 6 条干扰项）。
 * 触线意味着余量被吃光、运行时更容易走 neighbor 兜底甚至抛「池枯竭」，不等于必然 500。
 */
