/**
 * lib/mastery 最小类型。Rational 与 lib/scheduler 同形（{ num, den }，den > 0）
 * ——掌握度得分可直接喂 scheduler 的 startTier / maintenanceStep，两边零 import。
 */
export type Rational = { num: number; den: number }

export type Frequency = 'high' | 'mid' | 'low'

export type Phase = 'new' | 'learning' | 'done' | 'paused'

/** §4.4：块掌握度权重 high=3 mid=2 low=1（与 scheduler FREQ_ORDER 同值，零 import） */
export const FREQ_WEIGHT: Record<Frequency, number> = { high: 3, mid: 2, low: 1 }

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function rat(num: number, den: number): Rational {
  if (den <= 0) throw new Error(`分母必须为正：${num}/${den}`)
  const g = gcd(Math.abs(num), den) || 1
  return { num: num / g, den: den / g }
}
