import type { Card } from '../../src/lib/content/types.js'

export type Pair = {
  /** 要点所属的卡 */
  ownerCardId: string
  keyPointId: string
  keyPointText: string
  /** 被问"这条要点对它也成立吗"的那道题 */
  targetCardId: string
  targetQuestion: string
}

function liveCardsOf(cards: Card[], blockId: string): Card[] {
  return cards.filter(c => c.blockId === blockId && !c.retiredAt)
}

/** 组合总数（含已登记的），用于向审核者展示这个块的工作量 */
export function countPairs(cards: Card[], blockId: string): number {
  const live = liveCardsOf(cards, blockId)
  if (live.length < 2) return 0
  return live.reduce((sum, c) => sum + c.keyPoints.length * (live.length - 1), 0)
}

/** 待人工确认的组合：跳过已登记的，避免重复确认 */
export function buildPairs(cards: Card[], blockId: string): Pair[] {
  const live = liveCardsOf(cards, blockId)
  const out: Pair[] = []
  for (const owner of live) {
    for (const kp of owner.keyPoints) {
      for (const target of live) {
        if (target.id === owner.id) continue
        // 两类已决组合都要跳过。只跳过"是"的话，答过"否"的组合不留痕，
        // 每次重跑 CLI 都会原样再问一遍 —— 而重跑是常态（加新题、调阈值、中途退出）。
        if (kp.excludeAsDistractorFor.includes(target.id)) continue
        if (kp.confirmedIndependentOf.includes(target.id)) continue
        out.push({
          ownerCardId: owner.id,
          keyPointId: kp.id,
          keyPointText: kp.text,
          targetCardId: target.id,
          targetQuestion: target.question,
        })
      }
    }
  }
  return out
}
