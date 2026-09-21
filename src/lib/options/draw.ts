import type { OptionCard, OptionKeyPoint } from './types.js'

/**
 * 互斥反向索引（§4.3 算法规格第 4 条）。字段语义是"本要点对**这些题**也
 * 成立"，而抽取时要反向查询：给定目标题 T，排除所有 excludeAsDistractorFor
 * 含 T 的要点。内容同步 job（计划 4）物化一次，供运行期 O(1) 查询与审计。
 * 注意：库内的 drawDistractors 走内联过滤（池小，线性扫可忽略）——本索引
 * 是给外部消费者的物化形式，两套写法的等价性由 draw-pool.test.ts 锁住。
 */
export function buildExclusionIndex(
  keyPoints: readonly OptionKeyPoint[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const index = new Map<string, Set<string>>()
  for (const kp of keyPoints) {
    for (const targetCardId of kp.excludeAsDistractorFor) {
      const set = index.get(targetCardId) ?? new Set<string>()
      set.add(kp.id)
      index.set(targetCardId, set)
    }
  }
  return index
}

/**
 * 同块干扰项池（§4.3 层 1）：同 blockId、别的卡、未退役的要点。
 * 互斥过滤不在这一步——三个池在 drawDistractors（Task 3）里走同一套过滤。
 */
export function sameBlockPoolOf(card: OptionCard, cards: readonly OptionCard[]): OptionKeyPoint[] {
  const ownIds = new Set(card.keyPoints.map(kp => kp.id))
  return cards
    .filter(c => c.blockId === card.blockId && c.id !== card.id)
    .flatMap(c => c.keyPoints)
    .filter(kp => !kp.retiredAt && !ownIds.has(kp.id))
}
