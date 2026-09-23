import { scoreLocal } from '../../src/client/scoring.js'
import { scoreSubmission } from '../../src/server/replay.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'
import type { CardSnapshot, Submission } from '../../src/server/types.js'

const variant: PreparedVariant = {
  optionTexts: ['A', 'x', 'B', 'x', 'x', 'C', 'x', 'x', 'x'],
  correctIndices: [0, 2, 5],
  distractorKeyPointIds: [],
}
const card: CardSnapshot = {
  cardId: 'c', blockId: 'b', cardType: 'enumeration', frequency: 'mid', keyPoints: [],
}

test('同构（§11）：jsdom 里客户端判分与服务端 scoreSubmission 逐字节相同', () => {
  const sub: Submission = { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0, 1, 2] }
  const client = scoreLocal({ cardType: 'enumeration' }, variant, sub)
  const server = scoreSubmission(card, variant, sub)
  expect(JSON.stringify(client.score)).toBe(JSON.stringify(server.score))
  expect(client.correctChecked).toBe(server.correctChecked)
  expect(client.wrongChecked).toBe(server.wrongChecked)
})
