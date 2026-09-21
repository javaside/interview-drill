/** 天偏移 → 已占用容量。含 reservedLoad 与已放置的末次占位 */
export type DayLoad = Map<number, number>

export type DroppedReview = {
  cardId: string
  /** 被丢弃的是该卡计划的第几个中间次（0 起） */
  reviewIndex: number
  /** 原本想排的那天 */
  plannedDay: number
}

/**
 * 装箱一张卡的中间次（§5.3）。约定：调用方已把末次占位写进 load。
 *
 * 往后推而非往前推：今天没有"前一天"可继续推，往前挤只会把溢出转移到
 * 唯一无法再推的日子；且提前复习等于缩短间隔，对间隔重复没有价值。
 * 少刷一遍，好过把一遍刷在没用的位置上。
 */
export function binIntermediates(
  intermediates: number[],
  finalDay: number,
  cardId: string,
  load: DayLoad,
  capacity: number,
): { plan: number[]; dropped: DroppedReview[] } {
  const placed: number[] = []
  const usedDays = new Set<number>([finalDay])   // I2：同卡不同天，末次日先占住
  const dropped: DroppedReview[] = []

  for (let i = 0; i < intermediates.length; i++) {
    let day = intermediates[i]!
    while (day < finalDay) {
      const full = (load.get(day) ?? 0) >= capacity
      if (!full && !usedDays.has(day)) break
      day++
    }
    if (day >= finalDay) {
      // 推到末次前一天仍无槽位：丢弃，不硬塞（§5.3）
      dropped.push({ cardId, reviewIndex: i, plannedDay: intermediates[i]! })
      continue
    }
    load.set(day, (load.get(day) ?? 0) + 1)
    usedDays.add(day)
    placed.push(day)
  }
  return { plan: [...placed, finalDay], dropped }
}

/**
 * 前缀和超载判据（§5.4）。总量判据只查了可行性里最松的一项，而负载天然
 * 堆在前端，卡死的永远是前缀。返回最早违反的 t（"你前 3 天就已经排不下了"）。
 */
export function prefixCheck(load: DayLoad, capacity: number, E: number): number | undefined {
  let cumulative = 0
  for (let t = 0; t <= E; t++) {
    cumulative += load.get(t) ?? 0
    if (cumulative > (t + 1) * capacity) return t
  }
  return undefined
}
