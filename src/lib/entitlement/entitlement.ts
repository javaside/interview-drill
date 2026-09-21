/**
 * 免费/付费边界（§10.1）：排期免费，题量付费。
 * 免费层是"完整的 2 个块"（约 30-50 题），不是"分散的 300 道"——后者每块
 * 3-5 题，恰好演示产品**不能**做什么，且超出 §5.6 的 157 道容量上限。
 */
export type Plan = 'free' | 'paid'

export type Entitlement = {
  plan: Plan
  /** 仅 free 生效：用户勾选的块。paid 恒为空数组 */
  freeBlockIds: readonly string[]
}

export const FREE_BLOCK_LIMIT = 2

export function makeFreeEntitlement(blockIds: readonly string[]): Entitlement {
  const unique = [...new Set(blockIds)]
  if (unique.length > FREE_BLOCK_LIMIT) {
    throw new Error(`免费层最多 ${FREE_BLOCK_LIMIT} 个块，收到 ${unique.length} 个（§10.1）`)
  }
  return { plan: 'free', freeBlockIds: unique }
}

export function makePaidEntitlement(): Entitlement {
  return { plan: 'paid', freeBlockIds: [] }
}

export function isEntitled(ent: Entitlement, blockId: string): boolean {
  return ent.plan === 'paid' || ent.freeBlockIds.includes(blockId)
}

/** 已解锁块全集。paid = 全部；free = 交集，按 allBlockIds 顺序输出——确定 */
export function entitledBlockIds(ent: Entitlement, allBlockIds: readonly string[]): string[] {
  if (ent.plan === 'paid') return [...allBlockIds]
  const free = new Set(ent.freeBlockIds)
  return allBlockIds.filter(id => free.has(id))
}

/**
 * 供 schedule() 的 cards[] 用（§7：entitlement 决定 cards[] 里能放哪些块）。
 * 泛型按 blockId 过滤，不耦合内容类型。
 */
export function entitledCards<T extends { blockId: string }>(
  ent: Entitlement,
  cards: readonly T[],
): T[] {
  return cards.filter(c => isEntitled(ent, c.blockId))
}

/**
 * 跨块干扰项池（§4.3 免费层）：免费用户只从**公开要点池**抽（约 200-400 条）
 * ——公开要点本来就在 SEO 页可见，泄露为零；未解锁块的非 public 要点
 * 绝不进入下发语料（§11）。付费 = 整个大类（他买了）。
 */
export function crossBlockPoolFor<T extends { public: boolean }>(
  ent: Entitlement,
  sameCategoryKeyPoints: readonly T[],
): T[] {
  return ent.plan === 'paid' ? [...sameCategoryKeyPoints] : sameCategoryKeyPoints.filter(kp => kp.public)
}
