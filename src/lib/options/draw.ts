import type { OptionCard, OptionKeyPoint, OptionMisconception } from './types.js'
import { shuffle } from './rng.js'
import type { Rng } from './rng.js'
import type { DistractorPools, Rational } from './types.js'

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

/**
 * 分层比例（§4.3 算法规格第 3 条）：分数表 + 交叉相乘，与 §5.2 起始档表同构。
 * 掌握度越高同块占比越大——池子不变而辨别难度上升。这是 §12 ④ 修正后的
 * 唯一难度调节旋钮（"缩窄池子/加干扰项数"两条旧路径都在加速枯竭，已作废）。
 */
export function layerCounts(
  total: number,
  s: Rational,
): { sameBlock: number; crossBlock: number } {
  let wSame = 1
  let wCross = 2                                   // 3·s < 1 → 1:2
  if (s.num === s.den) {
    wSame = 3; wCross = 0                          // s = 1 → 3:0
  } else if (3 * s.num >= 2 * s.den) {
    wSame = 2; wCross = 1                          // 3·s ≥ 2 且 s < 1 → 2:1
  } else if (3 * s.num >= s.den) {
    wSame = 1; wCross = 1                          // 3·s ≥ 1 且 3·s < 2 → 1:1
  }
  const same = Math.floor((total * wSame) / (wSame + wCross))
  return { sameBlock: same, crossBlock: total - same }   // 余数给跨块层
}

export type Degradation = 'none' | 'neighbor'

/**
 * 干扰项抽取（§4.3 + spec §3.1 专属优先）。
 *
 * - 专属优先（spec §3.1）：本卡 misconceptions 活的全用，多于缺口按 rng 选
 *   子集；池只补剩下的缺口。无 mc 时 shuffle([]) 零消费——rng 序与旧实现
 *   逐字节一致（熟练分支回归锁的前提）
 * - 过滤三连：退役、本题要点、excludeAsDistractorFor 含目标卡（三个池同一套）
 * - 分层抽取：缺口双向回填（§4.3"优先从同大类补足"）——同块不足滚给跨块，
 *   跨块不足回捞同块剩余；两层都枯竭 → 相邻大类兜底并置
 *   degradedTo='neighbor'（调用方记日志告警——跨大类概念撞车率低，抽检即可）
 * - 绝不少给：三层全枯竭仍不足 → 抛错。少给会让选项总数变化，直接泄露
 *   正确条数（§4.3），比崩溃更糟
 * - 同一条绝不重复（按 id 去重，跨层重叠也防）
 */
export function drawDistractors(
  card: OptionCard,
  pools: DistractorPools,
  count: number,
  s: Rational,
  rng: Rng,
): { keyPoints: OptionKeyPoint[]; misconceptions: OptionMisconception[]; degradedTo: Degradation } {
  // 专属优先（spec §3.1）：活的全用；多于缺口按 rng 选子集
  const ownLive = (card.misconceptions ?? []).filter(m => !m.retiredAt)
  const misconceptions = shuffle(ownLive, rng).slice(0, count)
  const poolCount = count - misconceptions.length

  // 池缺口走三层（互斥过滤、双向回填、枯竭抛错，全部照旧——
  // 原 takeFrom 逻辑不动，只是入口计数变 poolCount；poolCount=0 时三层自然空转）
  const ownIds = new Set(card.keyPoints.map(kp => kp.id))
  const eligible = (pool: OptionKeyPoint[]) =>
    pool.filter(
      kp => !kp.retiredAt && !ownIds.has(kp.id) && !kp.excludeAsDistractorFor.includes(card.id),
    )

  const taken = new Map<string, OptionKeyPoint>()   // 插入序 = 层序，输出确定
  const takeFrom = (pool: OptionKeyPoint[], want: number): number => {
    for (const kp of shuffle(eligible(pool), rng)) {
      if (want === 0) break
      if (taken.has(kp.id)) continue
      taken.set(kp.id, kp)
      want--
    }
    return want                                     // 返回剩余缺口
  }

  const layers = layerCounts(poolCount, s)
  let shortfall = takeFrom(pools.sameBlock, layers.sameBlock)
  shortfall = takeFrom(pools.crossBlock, layers.crossBlock + shortfall)
  // 双向回填（spec §4.3"优先从同大类补足"）：块 ⊂ 大类，同块剩余仍属于同大类，
  // 跨块不足时先回捞同块剩余（takeFrom 按 taken 去重，天然只取剩余条目），
  // 仍缺才降级到相邻大类——同块有货就走 neighbor 是错误的降级。
  shortfall = takeFrom(pools.sameBlock, shortfall)
  let degradedTo: Degradation = 'none'
  if (shortfall > 0) {
    degradedTo = 'neighbor'
    shortfall = takeFrom(pools.neighbor, shortfall)
  }
  if (shortfall > 0) {
    throw new Error(
      `干扰项池枯竭：${card.id} 需要 ${count} 条（专属 ${misconceptions.length} + 池 ${poolCount}），三层合计仍缺 ${shortfall} 条` +
      '（内容缺陷，构建期解决，绝不静默少给）',
    )
  }
  return { keyPoints: [...taken.values()], misconceptions, degradedTo }
}
