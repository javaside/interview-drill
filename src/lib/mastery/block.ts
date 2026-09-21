import { rat, FREQ_WEIGHT } from './types.js'
import type { Frequency, Phase, Rational } from './types.js'

export type BlockEntry = {
  frequency: Frequency
  phase: Phase
  s: Rational
}

/** untried = 全部被排除/空输入：地图显示"未刷"，不是 0%（§4.4） */
export type BlockMastery = { kind: 'untried' } | { kind: 'score'; value: Rational }

/**
 * 块掌握度（§4.4）：块内**当前计划内**卡片的 s 加权平均，权重 high=3
 * mid=2 low=1。
 *
 * 口径三条：
 * - 分母只算**传入**的条目——被 §5.4 收窄排除的低频卡、别的块的卡，
 *   由调用方先过滤掉再传（spec 明文：分母只算计划内的卡）
 * - phase='new' 不进分母（从未刷过，s 无意义）；'paused' 不进分母
 *   （所属块被取消勾选，不在当前计划内）；'learning'/'done' 计入
 * - 计入项为空 → untried——避免"全是新卡的块显示 0% 红地图"这个死结
 *
 * 精确有理数：通分累加，**每步累加后立即约分**——无归约的连乘分母会在
 * 块规模内溢出（50 条 × den 6 → 6⁵⁰ ≫ 2⁵³；s 来自 weightedS，den 可达
 * 1296，更糟）。逐步归约后分母收敛到各 denᵢ 的 lcm 因子，安全。
 */
export function blockMastery(entries: readonly BlockEntry[]): BlockMastery {
  const counted = entries.filter(e => e.phase === 'learning' || e.phase === 'done')
  if (counted.length === 0) return { kind: 'untried' }

  let accNum = 0
  let accDen = 1
  let weightSum = 0
  for (const e of counted) {
    const w = FREQ_WEIGHT[e.frequency]
    // acc = acc + w · numᵢ/denᵢ —— 通分后立即 rat() 归约，防连乘溢出
    const next = rat(accNum * e.s.den + w * e.s.num * accDen, accDen * e.s.den)
    accNum = next.num
    accDen = next.den
    weightSum += w
  }
  return { kind: 'score', value: rat(accNum, accDen * weightSum) }
}
