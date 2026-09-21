import { rat } from './types.js'
import type { Rational } from './types.js'

/**
 * 枚举 / 对比 / judgment 要点阶段共用（§4.4 计分表"同上"）：
 * max(0, (勾对 − 勾错) / 正确要点总数)。
 * 减勾错数堵"乱勾全选"——不扣错的话全选就能拿满分；下限 0 避免负分
 * 传进 §5.2 的起始档判断。
 */
export function scoreSelection(
  correctSelected: number,
  wrongSelected: number,
  totalCorrect: number,
): Rational {
  if (totalCorrect < 1) throw new Error(`正确要点总数必须 ≥ 1：${totalCorrect}`)
  if (correctSelected < 0 || wrongSelected < 0 || correctSelected > totalCorrect) {
    throw new Error(
      `非法勾选数：对 ${correctSelected} / 错 ${wrongSelected} / 总 ${totalCorrect}` +
      '——勾对数不得超过正确总数',
    )
  }
  return rat(Math.max(0, correctSelected - wrongSelected), totalCorrect)
}

/**
 * sequence 型（§4.4）：1 − 逆序对数/最大逆序对数，全序正确得 1。
 * n ≤ 6，O(n²) 计数足够。userOrder 必须是 canonicalOrder 的一个排列，
 * 不是则抛错——那是调用方 bug，不该被部分分掩盖。
 */
export function scoreSequence(
  userOrder: readonly string[],
  canonicalOrder: readonly string[],
): Rational {
  if (userOrder.length !== canonicalOrder.length) {
    throw new Error(`长度不一致：${userOrder.length} vs ${canonicalOrder.length}`)
  }
  const seen = new Set(userOrder)
  if (seen.size !== userOrder.length || canonicalOrder.some(id => !seen.has(id))) {
    throw new Error('userOrder 必须是 canonicalOrder 的一个排列')
  }
  const n = canonicalOrder.length
  if (n < 2) return { num: 1, den: 1 }   // 单元素无逆序可言
  const pos = new Map(canonicalOrder.map((id, i) => [id, i] as const))
  const seq = userOrder.map(id => pos.get(id)!)
  let inv = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (seq[i]! > seq[j]!) inv++
    }
  }
  const maxInv = (n * (n - 1)) / 2
  return rat(maxInv - inv, maxInv)
}

/**
 * judgment 型（§4.4）：结论错 → 0；结论对 → 结论分 0.5 + 0.5 × 要点得分。
 * 整数运算：(den + num) / (2·den)，无浮点。
 */
export function scoreJudgment(conclusionCorrect: boolean, pointsScore: Rational): Rational {
  if (!conclusionCorrect) return { num: 0, den: 1 }
  return rat(pointsScore.den + pointsScore.num, pointsScore.den * 2)
}

/** atomic 型（§4.4）：对 1 错 0，不走 keyPoints 计分 */
export function scoreAtomic(correct: boolean): Rational {
  return correct ? { num: 1, den: 1 } : { num: 0, den: 1 }
}
