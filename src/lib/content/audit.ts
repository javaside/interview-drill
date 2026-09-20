import type { Card } from './types.js'

export type AuditResult = {
  errors: string[]
  warnings: string[]
}

export function auditLibrary(cards: Card[]): AuditResult {
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

  return { errors, warnings }
}
