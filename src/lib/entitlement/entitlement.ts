/**
 * 免费/付费边界（§10.1）：排期免费，题量付费。
 *
 * 2026-10-02 v3 修订：付费从「一次性买断」改为「30 天通行证」。到期后有一段
 * **宽限**——宽限块 = 到期时仍有未完成排期的块，让在期排的题跑完而不中途截断。
 *
 * 三种放行来源（并集）：free 勾选（≤ FREE_BLOCK_LIMIT）/ paid / grace。
 * grace 只能由服务端结算产生（lib/entitlement/expiry.ts 决策 + adapters 落库），
 * 客户端无法设置——它不是「免费额度」，是已付费的尾巴，故不受 FREE_BLOCK_LIMIT 约束。
 */
export type Plan = 'free' | 'paid'

export type Entitlement = {
  plan: Plan
  /** 仅 free 生效：用户勾选的块（≤ FREE_BLOCK_LIMIT）。paid 恒空 */
  freeBlockIds: readonly string[]
  /** 仅 free 生效：到期宽限冻结的块。非宽限期恒空 */
  graceBlockIds: readonly string[]
}

export const FREE_BLOCK_LIMIT = 2

/**
 * 维持模式（无就绪日 / 就绪日已过）到期后的宽限天数。
 * 冲刺模式以「在期排期最后一天」为准，不用这个——但维持模式**必须**有它：
 * schedule() 的 maintenance 分支不生成计划、todayQueue 按到期状态滚动，
 * 字面执行「让排期跑完」等价于永久免费。
 */
export const GRACE_MAINTENANCE_DAYS = 14

/**
 * 返回一律冻结（浅冻）：entitlement 是长生命周期会话状态，被意外 push/sort
 * 会静默改写付费边界——fail fast 好过事后审计。要改就重建整个对象。
 */
export function makeFreeEntitlement(
  blockIds: readonly string[], graceBlockIds: readonly string[] = [],
): Entitlement {
  const unique = [...new Set(blockIds)]
  if (unique.length > FREE_BLOCK_LIMIT) {
    throw new Error(`免费层最多 ${FREE_BLOCK_LIMIT} 个块，收到 ${unique.length} 个（§10.1）`)
  }
  return Object.freeze({
    plan: 'free',
    freeBlockIds: Object.freeze(unique),
    graceBlockIds: Object.freeze([...new Set(graceBlockIds)]),
  })
}

export function makePaidEntitlement(): Entitlement {
  return Object.freeze({
    plan: 'paid',
    freeBlockIds: Object.freeze<string[]>([]),
    graceBlockIds: Object.freeze<string[]>([]),
  })
}

export function isEntitled(ent: Entitlement, blockId: string): boolean {
  return ent.plan === 'paid'
    || ent.freeBlockIds.includes(blockId)
    || ent.graceBlockIds.includes(blockId)
}

/** 已解锁块全集：paid = 全部；free = 三态并集，按 allBlockIds 顺序输出——确定 */
export function entitledBlockIds(ent: Entitlement, allBlockIds: readonly string[]): string[] {
  if (ent.plan === 'paid') return [...allBlockIds]
  return allBlockIds.filter(id => isEntitled(ent, id))
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
 *
 * v3 注记：宽限块**也**走 public-only（本函数只认 plan，不认 blockId）。
 * 宽限用户是「已到期」的免费用户，语料边界按免费层处理——不泄露、不特殊对待。
 */
export function crossBlockPoolFor<T extends { public: boolean }>(
  ent: Entitlement,
  sameCategoryKeyPoints: readonly T[],
): T[] {
  return ent.plan === 'paid' ? [...sameCategoryKeyPoints] : sameCategoryKeyPoints.filter(kp => kp.public)
}
