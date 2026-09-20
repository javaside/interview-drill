import type { Pair } from './pairs.js'

export type Flagged = {
  pair: Pair
  score: number
  reason: string
}

export type Scorer = (pair: Pair) => Promise<number>

/**
 * 召回导向预筛：宁可多报不可漏报。
 * 打分失败的组合一律保留进人工队列 —— 静默丢弃会让漏网项无人发现，
 * 而这正是双模型交叉预审被否决的那个失败模式（§9.1）。
 */
export async function screenPairs(
  pairs: Pair[],
  score: Scorer,
  threshold: number,
): Promise<Flagged[]> {
  const out: Flagged[] = []
  for (const pair of pairs) {
    try {
      const s = await score(pair)
      if (s >= threshold) out.push({ pair, score: s, reason: `相似度 ${s.toFixed(2)}` })
    } catch (e) {
      out.push({ pair, score: 1, reason: `打分失败，保留待人工确认 —— ${String(e)}` })
    }
  }
  return out
}
