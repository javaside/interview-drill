import type { Card, CardType } from './types.js'
import { checkPlaceholders } from './rules.js'

export type AuditResult = {
  errors: string[]
  warnings: string[]
}

/**
 * 块元数据的最小形状。Task 12 的 `Block` 在结构上满足它 ——
 * 这样本任务不必向后依赖那个还不存在的类型。
 */
export type BlockLike = { id: string; status: 'wip' | 'ready' }

/**
 * 同块可用干扰项池下界，**按 cardType 分派**。§4.3 的出题形式决定需求：
 *
 * - `enumeration` / `comparison`：9 选、正确要点最少 3 条 → 单次最多吃 **6 条**干扰项；
 *   且 §4.3 分层表的 `s = 1` 档是 **3:0**（干扰项全来自同块）。取 2 倍余量 = 12
 * - `judgment`：二段式，结论占一半，支撑要点部分需求减半 = 8
 * - `atomic`：4 选 1，单次 3 条干扰项，2 倍余量 = 6
 * - `sequence`：**排序题，选项就是本卡自己的步骤，不抽同块干扰项** = 0
 *
 * 早期版本对所有卡一视同仁要求 12 条，对 `sequence` 是定义上的错误。按 §4.3 的
 * 目标占比，那会让约 28% 的卡被一条与它们无关的规则卡住，作者只能往块里注水凑题。
 */
export const MIN_BLOCK_POOL: Record<CardType, number> = {
  enumeration: 12,
  comparison: 12,
  judgment: 8,
  atomic: 6,
  sequence: 0,
}

/**
 * 推论：池下界反过来定义了**块的最小可行规模**。
 * 对一张 k 条要点的 enumeration 卡，可用池 = 块内总要点数 T − k ≥ 12，
 * 即 T ≥ 12 + k。k 取上限 6 时 T ≥ 18 —— 按平均 4 条/卡约合 5 张卡。
 *
 * 这条约束应当反馈给内容侧：**一个块低于约 5 张卡就不该声明 ready**。
 * spec §2 定的每块 15-25 题远在这之上，所以真实块不会撞线；
 * 撞线的只有试点这种刻意做小的块。
 */

export function auditLibrary(cards: Card[], blocks: BlockLike[] = []): AuditResult {
  const errors: string[] = []
  const warnings: string[] = []

  const cardIds = new Set<string>()
  for (const c of cards) {
    if (cardIds.has(c.id)) errors.push(`卡 id 重复：${c.id}`)
    cardIds.add(c.id)
  }

  const blockIds = new Set(cards.map(c => c.blockId))

  // 要点 id 只要求块内唯一，跨块重复是允许的
  const seenPerBlock = new Map<string, Set<string>>()
  for (const c of cards) {
    let set = seenPerBlock.get(c.blockId)
    if (!set) { set = new Set(); seenPerBlock.set(c.blockId, set) }
    for (const kp of c.keyPoints) {
      if (set.has(kp.id)) {
        errors.push(`要点 id 在块 ${c.blockId} 内重复：${kp.id}（卡 ${c.id}）`)
      }
      set.add(kp.id)
    }
  }

  for (const c of cards) {
    for (const b of c.relatedBlocks) {
      if (!blockIds.has(b)) errors.push(`卡 ${c.id} 的 relatedBlocks 指向不存在的块：${b}`)
    }
    for (const kp of c.keyPoints) {
      for (const target of kp.excludeAsDistractorFor) {
        if (!cardIds.has(target)) {
          errors.push(`卡 ${c.id} 要点 ${kp.id} 的 excludeAsDistractorFor 指向不存在的卡：${target}`)
        }
      }
    }
  }

  // 干扰项池容量：对每张卡，同块其他卡的要点里有多少是可用的
  const byBlock = new Map<string, Card[]>()
  for (const c of cards) {
    const list = byBlock.get(c.blockId)
    if (list) list.push(c)
    else byBlock.set(c.blockId, [c])
  }

  // 只校验**声明为 ready** 的块。内容生产要持续 4-9 个月，期间绝大多数块是半成品，
  // 让在建块把 CI 一直染红，等于让所有人学会忽略它。
  // 不传 blocks（如只关心 id 与外键的调用方）则完全跳过池校验。
  const readyBlocks = new Set(blocks.filter(b => b.status === 'ready').map(b => b.id))

  for (const [blockId, blockCards] of byBlock) {
    if (!readyBlocks.has(blockId)) continue
    for (const c of blockCards) {
      if (c.retiredAt) continue
      const need = MIN_BLOCK_POOL[c.cardType]
      if (need === 0) continue
      let usable = 0
      for (const other of blockCards) {
        if (other.id === c.id || other.retiredAt) continue
        for (const kp of other.keyPoints) {
          if (!kp.excludeAsDistractorFor.includes(c.id)) usable++
        }
      }
      if (usable < need) {
        errors.push(
          `块 ${blockId} 卡 ${c.id}（${c.cardType}）的同块干扰项池不足：可用 ${usable} 条，下界 ${need}`,
        )
      }
    }
  }

  // 同一 (要点, 目标题) 不能既登记为"成立"又登记为"不成立" ——
  // 出现说明有人改错了文件，或两次确认给了相反答案。不报的话，
  // buildPairs 会跳过它，矛盾永远不被发现。
  for (const c of cards) {
    for (const kp of c.keyPoints) {
      const both = kp.excludeAsDistractorFor.filter(t => kp.confirmedIndependentOf.includes(t))
      for (const t of both) {
        errors.push(`卡 ${c.id} 要点 ${kp.id} 对 ${t} 同时登记了互斥与不成立，二者矛盾`)
      }
    }
  }

  // 占位符：同样只对 ready 块报错。wip 块里全是半成品，那是正常的。
  for (const c of cards) {
    if (!readyBlocks.has(c.blockId) || c.retiredAt) continue
    const texts = [c.question, c.detail, ...c.keyPoints.flatMap(k => [k.text, k.source.url, k.source.locator])]
    for (const t of texts) {
      for (const msg of checkPlaceholders(t)) {
        errors.push(`块 ${c.blockId} 卡 ${c.id}：${msg}`)
        break
      }
    }
  }

  // 卡与块的归属一致性。只在传了 blocks 时校验。
  if (blocks.length > 0) {
    const declared = new Set(blocks.map(b => b.id))
    for (const c of cards) {
      if (!declared.has(c.blockId)) {
        errors.push(`卡 ${c.id} 的 blockId ${c.blockId} 没有对应的 block.yml`)
      }
    }
    const ids = new Set<string>()
    for (const b of blocks) {
      if (ids.has(b.id)) errors.push(`块 id 重复：${b.id}`)
      ids.add(b.id)
    }
  }

  return { errors, warnings }
}

/**
 * 跨提交 id 守卫。`lockedIds` 是上一次 main 的 content/.ids.lock 内容，
 * 每行形如 `card:<cardId>` 或 `kp:<blockId>/<keyPointId>`。
 *
 * 两类 id 都要守：review_log.distractorIds 存的是**要点** id，
 * 只守卡 id 的话要点改名一样让历史日志悬空。
 */
export function checkIdLock(cards: Card[], lockedIds: string[]): string[] {
  const liveCards = new Set(cards.map(c => c.id))
  const movedFrom = new Set(cards.map(c => c.movedFrom).filter((x): x is string => !!x))
  const liveKeyPoints = new Set(
    cards.flatMap(c => c.keyPoints.map(kp => `${c.blockId}/${kp.id}`)),
  )
  const kpMovedFrom = new Set(
    cards.flatMap(c => c.keyPoints
      .map(kp => kp.movedFrom ? `${c.blockId}/${kp.movedFrom}` : null)
      .filter((x): x is string => !!x)),
  )

  const errors: string[] = []
  for (const line of lockedIds) {
    const [kind, ...rest] = line.split(':')
    const id = rest.join(':')
    if (kind === 'card') {
      if (liveCards.has(id) || movedFrom.has(id)) continue
      errors.push(
        `卡 id ${id} 相对上一次 main 消失了。` +
        `若为改名，请在新卡上写 movedFrom: ${id}；若为下线，请保留该卡并设 retiredAt。` +
        `直接删除会让 review_log 与 excludeAsDistractorFor 变成悬空引用。`,
      )
    } else if (kind === 'kp') {
      if (liveKeyPoints.has(id) || kpMovedFrom.has(id)) continue
      errors.push(
        `要点 id ${id} 相对上一次 main 消失了。` +
        `若为改名，请在新要点上写 movedFrom: ${id.split('/').pop()}；` +
        `若判定写错要作废，请保留该要点并设 retiredAt，不要直接删除 —— ` +
        `review_log.distractorIds 引用的正是它。`,
      )
    } else {
      errors.push(`lockfile 行格式无法识别：${line}`)
    }
  }
  return errors
}
