import type { Phase, Rational, SchedulableCard } from './types.js'
import { sortForScheduling } from './types.js'

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

/**
 * 新卡配额（§5.2 ④）。不加配额的话，150 张新卡各自还带一次"+1 天"复习，
 * day0 必然拥塞。剩余容量留给复习。
 */
export function newPerDayOf(capacity: number): number {
  return Math.max(1, Math.floor(capacity * 0.35))
}

/**
 * 第 rank 张新卡（0 起，已按 (frequency 降序, cardId 升序) 排位）的首次曝光日。
 * min(…, E)：短窗口时不把首次曝光排到窗口之外。
 */
export function firstExposureOffset(rank: number, capacity: number, E: number): number {
  return Math.min(Math.floor(rank / newPerDayOf(capacity)), E)
}

/**
 * 末次目标日分配（§5.2 ④ 末端窗口）。所有卡的末次都想落在 E，那天必然爆——
 * 分散到 [E-fw+1, E]，fw 从 ceil(n/C) 起；按 (frequency 降序, cardId 升序)
 * 从 E 往前贪心填，每天最多 capacity 个末次。高频卡天然拿到最靠近 E 的日子。
 *
 * 这是对早期"末次严格落在 E"的明确降级（spec §5.2 ④）：单日末端对齐与容量
 * 约束在满载时互斥，互斥的保证必须明着选一个。
 */
export function assignFinalDays(
  cards: SchedulableCard[],
  capacity: number,
  E: number,
): ReadonlyMap<string, number> {
  const ordered = sortForScheduling(cards)
  const finals = new Map<string, number>()
  if (E <= 0) {
    // E=0 是唯一容量豁免路径（§5.4）：全部排今天并告警，由调用方负责告警
    for (const c of ordered) finals.set(c.id, 0)
    return finals
  }
  let day = E
  let slots = capacity
  for (const c of ordered) {
    while (slots === 0) {
      day -= 1
      slots = capacity
    }
    if (day < 0) {
      // 超载是常态而非异常（§5.6）：窗口装不下所有末次时堆到 day 0，
      // 由前缀和判据捕获并触发收窄建议——绝不在引擎里抛异常打断排期。
      finals.set(c.id, 0)
      continue
    }
    finals.set(c.id, day)
    slots--
  }
  return finals
}
