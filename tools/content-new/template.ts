import { MIN_KEY_POINTS } from '../../src/lib/content/schema.js'
import type { CardType } from '../../src/lib/content/types.js'

export type TemplateInput = {
  id: string
  blockId: string
  cardType: CardType
  today: string
}

function keyPointBlock(prefix: string, i: number, today: string, withOrder: boolean): string {
  const orderLine = withOrder ? `\n    order: ${i}` : ''
  return `  - id: ${prefix}-${i}
    text: 待填写要点 ${i}
    public: ${i === 1}
    verifiedAt: ${today}
    excludeAsDistractorFor: []
    confirmedIndependentOf: []${orderLine}
    source:
      kind: official-doc
      url: https://example.org/REPLACE-ME
      locator: REPLACE-ME`
}

export function renderTemplate(input: TemplateInput): string {
  const { id, blockId, cardType, today } = input
  const n = MIN_KEY_POINTS[cardType]
  const withOrder = cardType === 'sequence'
  // 要点 id 必须**块内**唯一（§7 与 Task 6 的审计）。固定写 kp-1/kp-2/kp-3 的话，
  // 同一个块的第二张卡就会撞 id、审计必炸；而作者最自然的补救 ——
  // 手工改成 kp-4/kp-5 —— 正好重演 §7 点名禁止的序号派生 id：
  // 中间插一道题就要重编号，下游 review_log 全部悬空。
  // 从卡自己的 ULID 尾 6 位派生前缀，既块内唯一又与位置无关。
  const prefix = `kp-${id.slice(-6).toLowerCase()}`
  const kps = Array.from({ length: n }, (_, i) => keyPointBlock(prefix, i + 1, today, withOrder)).join('\n')

  return `---
id: ${id}
blockId: ${blockId}
relatedBlocks: []
question: 待填写题面（面试官口吻的问法，不是教科书标题）
cardType: ${cardType}
appliesTo: 待填写版本范围
frequency: mid
followUps:
  - 待填写追问
keyPoints:
${kps}
---

待填写展开讲解。
`
}
