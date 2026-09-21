/** 排期需要的卡的最小形状。故意不 import lib/content —— scheduler 零依赖（§7） */
export type Frequency = 'high' | 'mid' | 'low'

export const FREQ_ORDER: Record<Frequency, number> = { high: 3, mid: 2, low: 1 }

export type SchedulableCard = { id: string; frequency: Frequency }

/**
 * 精确有理数。§5.2 ②：s 必须以整数分子/分母存储，比较用交叉相乘。
 * s 是 3:2:1 加权平均，分母 3-6，通分后分母不超过 6³×6，整数运算绰绰有余。
 */
export type Rational = { num: number; den: number }

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function rat(num: number, den: number): Rational {
  if (den <= 0) throw new Error(`分母必须为正：${num}/${den}`)
  const g = gcd(Math.abs(num), den) || 1
  return { num: num / g, den: den / g }
}

/** 交叉相乘比较。负 = a<b，0 = 相等，正 = a>b。 */
export function cmpRat(a: Rational, b: Rational): number {
  return a.num * b.den - b.num * a.den
}

/**
 * 最近 3 次得分的 3:2:1 加权平均（§4.4）。scores[0] 最新；不足 3 次按已有
 * 次数归一。取加权平均而非"最近一次"：单次观测方差太大（§4.4）。
 */
export function weightedS(scores: Rational[]): Rational {
  const take = scores.slice(0, 3)
  if (take.length === 0) return rat(0, 1)
  const weights = [3, 2, 1]
  let den = 1
  for (const s of take) den *= s.den
  let acc = 0
  for (let i = 0; i < take.length; i++) {
    acc += weights[i]! * take[i]!.num * (den / take[i]!.den)
  }
  const wSum = weights.slice(0, take.length).reduce((a, b) => a + b, 0)
  return rat(acc, den * wSum)
}

/** §4.4：new 是独立状态，不是 s=0 —— 从没见过的卡和见过但说不出的卡干预不同 */
export type Phase = 'new' | 'learning' | 'done' | 'paused'

export type CardState = {
  cardId: string
  phase: Phase
  /** phase='new' 时无意义，约定 0/1 */
  s: Rational
  /**
   * 已生成的计划：相对 today 的天偏移，严格递增（I2）。负数 = 逾期未刷（§5.5）。
   * 调用方在 DB 里存绝对日期 + planGeneratedAt，调 scheduler 前用 diffDays 转偏移。
   */
  plan: number[]
  /** 维持模式档位（§5.7），冲刺模式不参与。新卡 k=0 */
  phaseIndex: number
  reviewCount: number
}

export function compareCardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 全库唯一允许的卡片排序：(frequency 降序, cardId 升序)。
 * §5.1：排序键末尾必须追加 cardId，否则同键顺序取决于数据库返回顺序，
 * "输入确定则输出确定"就是假的。
 */
export function sortForScheduling(cards: SchedulableCard[]): SchedulableCard[] {
  return [...cards].sort(
    (a, b) => FREQ_ORDER[b.frequency] - FREQ_ORDER[a.frequency] || compareCardId(a.id, b.id),
  )
}
