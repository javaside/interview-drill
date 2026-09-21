import { sameBlockPoolOf } from '../lib/options/draw.js'
import type { OptionCard, OptionKeyPoint, DistractorPools } from '../lib/options/types.js'
import { crossBlockPoolFor } from '../lib/entitlement/entitlement.js'
import type { Entitlement } from '../lib/entitlement/entitlement.js'
import type { CardSnapshot } from './types.js'

/** CardSnapshot → OptionCard（lib/options 的最小输入投影） */
function toOptionCard(c: CardSnapshot): OptionCard {
  return { id: c.cardId, blockId: c.blockId, cardType: c.cardType, keyPoints: c.keyPoints }
}

/**
 * 大类值序列里 current 的下一项（循环）——neighbor 层的相邻大类。
 * 少于两个大类或 current 不在序列中 → undefined（neighbor 层空）。
 */
function neighborCategoryOf(categories: Map<string, string>, current: string): string | undefined {
  const seq = [...new Set(categories.values())]
  if (seq.length < 2) return undefined
  const i = seq.indexOf(current)
  if (i < 0) return undefined
  return seq[(i + 1) % seq.length]
}

/**
 * 唯一池装配入口（终审裁决）：全库唯一构造 DistractorPools 的地方。
 *
 * - sameBlock：目标块其他卡的要点（块已解锁，语料本来可见，**不过 public**）。
 * - crossBlock：同大类**其他块**的要点，过 crossBlockPoolFor——免费层只留 public，
 *   付费层全量（终审裁决：免费用户 crossBlock 必过 public）。
 * - neighbor：相邻大类的要点，**同样**过 crossBlockPoolFor——免费层只留 public
 *   （终审裁决：neighbor 层也必过 public，两层都不得泄露未解锁语料）。
 *
 * 互斥（excludeAsDistractorFor）过滤不在这里做——drawDistractors 负责（职责分离）。
 */
export function buildDistractorPools(
  target: CardSnapshot,
  all: CardSnapshot[],
  ent: Entitlement,
  categories: Map<string, string>,
): DistractorPools {
  const optionCards = all.map(toOptionCard)
  const sameBlock = sameBlockPoolOf(toOptionCard(target), optionCards)

  const targetCategory = categories.get(target.blockId)
  const neighborCategory = targetCategory === undefined
    ? undefined
    : neighborCategoryOf(categories, targetCategory)

  // 同大类其他块（排除目标块自身——同块层已覆盖，不重复）的全部要点
  const crossRaw: OptionKeyPoint[] = []
  const neighborRaw: OptionKeyPoint[] = []
  for (const c of all) {
    if (c.blockId === target.blockId) continue
    const cat = categories.get(c.blockId)
    if (cat === undefined) continue
    if (cat === targetCategory) crossRaw.push(...c.keyPoints)
    else if (neighborCategory !== undefined && cat === neighborCategory) neighborRaw.push(...c.keyPoints)
  }

  return {
    sameBlock,
    crossBlock: crossBlockPoolFor(ent, crossRaw),
    neighbor: crossBlockPoolFor(ent, neighborRaw),
  }
}
