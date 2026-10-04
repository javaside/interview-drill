import type { CardType } from './types.js'

/**
 * 同块可用干扰项池下界，**按 cardType 分派**。§4.3 的出题形式决定需求：
 *
 * - `enumeration` / `comparison`：9 选、正确要点最少 3 条 → 单次最多吃 **6 条**干扰项；
 *   且 §4.3 分层表的 `s = 1` 档是 **3:0**（干扰项全来自同块）。取 2 倍余量 = 12
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
 * 推论：池下界反过来定义了**块的最小可行规模**。
 * 对一张 k 条要点的 enumeration 卡，可用池 = 块内总要点数 T − k ≥ 12，
 * 即 T ≥ 12 + k。k 取上限 6 时 T ≥ 18 —— 按平均 4 条/卡约合 5 张卡。
 *
 * 这条约束应当反馈给内容侧：**一个块低于约 5 张卡就不该声明 ready**。
 * spec §2 定的每块 15-25 题远在这之上，所以真实块不会撞线；
 * 撞线的只有试点这种刻意做小的块。
 */
