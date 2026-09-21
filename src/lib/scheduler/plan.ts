import type { Phase, Rational } from './types.js'

/** 绝对间隔阶梯（§5.2 ②）。复习次数是输出不是输入——由窗口长度决定刷几遍 */
export const INTERVALS = [1, 2, 4, 8, 16, 32, 64] as const

/**
 * buffer 查表（§5.2 ①）。早期写成 clamp(round(R×0.05),1,3)，实测在 R≤29 恒 1、
 * R≥50 恒 3，只在 [30,49] 起作用——主场景（1-3 周备考）全落在常数区。
 * 查表更诚实，也免掉 round 半值方向的歧义。
 */
export function bufferOf(R: number): number {
  if (R < 30) return 1
  if (R < 50) return 2
  return 3
}

/**
 * 起始档（§5.2 ②）。全部用整数交叉相乘，禁止浮点：
 * s=2/3 时 3·2 = 2·3，既不 <1 也不 <2，落进"大部分对了"的第 2 档——
 * 旧写法 s≥0.67 因 0.6667<0.67 把三要点卡用户平白多排一遍。
 */
export function startTier(phase: Phase, s: Rational): number {
  if (phase === 'new') return 0
  if (3 * s.num < 1 * s.den) return 0
  if (3 * s.num < 2 * s.den) return 1
  if (s.num < s.den) return 2
  return 3
}

/**
 * 铺阶梯，末端截断到 target（该卡的末次目标日 E'，§5.2 ③）。
 *
 * a = [offset]; idx = 起始档
 * while a.last < target and idx < len(INTERVALS): a.push(a.last + INTERVALS[idx]); idx += 1
 * plan = [x for x in a if x < target] + [target]
 *
 * 末项永远是 target（I1 的构造性来源）；过滤保证中间次永不与末次同天（I2）。
 * target ≤ offset（末端窗口把末次分到了首次曝光之前）时整条计划只剩末次一次。
 */
export function layLadder(offset: number, tier: number, target: number): number[] {
  if (target <= offset) return [target]
  const a: number[] = [offset]
  let idx = tier
  while (a[a.length - 1]! < target && idx < INTERVALS.length) {
    a.push(a[a.length - 1]! + INTERVALS[idx]!)
    idx++
  }
  return [...a.filter(x => x < target), target]
}
