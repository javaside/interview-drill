import { scoreLocal } from '../../src/client/scoring.js'
import { scoreSubmission } from '../../src/server/replay.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'
import type { CardSnapshot, Submission } from '../../src/server/types.js'

/** 客户端 scoreLocal 与服务端 scoreSubmission 的同构守卫（§11）：四型全覆盖。
 *  背景：sequence/judgment 曾各自漂移（四舍五入换算 vs 位置精确匹配；结论错归零 vs
 *  按实际勾选），单测 enumeration 的旧守卫拦不住——离线/弱网屏② 计数与服务端落库
 *  对不上。此测试要求两核对每种提交产出完全相同的 score/correctChecked/wrongChecked。
 */
function assertIsomorphic(card: CardSnapshot, variant: PreparedVariant, sub: Submission): void {
  const client = scoreLocal(card, variant, sub)
  const server = scoreSubmission(card, variant, sub)
  expect(JSON.stringify(client.score)).toBe(JSON.stringify(server.score))
  expect(client.correctChecked).toBe(server.correctChecked)
  expect(client.wrongChecked).toBe(server.wrongChecked)
}

const enumVariant: PreparedVariant = {
  optionTexts: ['A', 'x', 'B', 'x', 'x', 'C', 'x', 'x', 'x'],
  correctIndices: [0, 2, 5],
  distractorKeyPointIds: [],
}
const enumCard: CardSnapshot = {
  cardId: 'c', blockId: 'b', cardType: 'enumeration', frequency: 'mid', keyPoints: [],
}

test('同构（§11）enumeration：勾对/勾错/漏选计数逐字节相同', () => {
  assertIsomorphic(enumCard, enumVariant,
    { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0, 1, 2] })
})

/** sequence：呈现 [A,B,C,D]，正确呈现序 = correctIndices = [1,0,3,2]（即 B,A,D,C） */
const seqVariant: PreparedVariant = {
  optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [1, 0, 3, 2], distractorKeyPointIds: [],
}
const seqCard: CardSnapshot = {
  cardId: 'c7', blockId: 'b', cardType: 'sequence', frequency: 'mid', keyPoints: [],
}

test('同构（§11）sequence：全错位时按位置精确匹配（不是 score×n 四舍五入）', () => {
  // 用户原样不动 [A,B,C,D]：与正确序 [B,A,D,C] 相比 0 个位置对，但逆序对仅 2/6 → score 4/6，
  // 旧客户端口径 round(4×4/6)=3 ≠ 服务端 0——本用例在漂移修复前必然失败
  assertIsomorphic(seqCard, seqVariant,
    { submissionId: 's1', cardId: 'c7', reviewedAtMs: 0, kind: 'sequence', order: [0, 1, 2, 3] })
})

test('同构（§11）sequence：部分位置正确', () => {
  // 用户排 [B,A,C,D]：位 0/1 对（B,A），位 2 应为 D、位 3 应为 C → 2 个位置对
  assertIsomorphic(seqCard, seqVariant,
    { submissionId: 's2', cardId: 'c7', reviewedAtMs: 0, kind: 'sequence', order: [1, 0, 2, 3] })
})

const judgmentCard: CardSnapshot = {
  cardId: 'c9', blockId: 'b', cardType: 'judgment', frequency: 'mid', keyPoints: [], conclusion: 'no',
}

test('同构（§11）judgment：结论错但勾对部分——记账按实际勾选（不归零/不记全错）', () => {
  // 结论选「会」(0)，正确是「不会」；要点勾对 2 条（0,2）、错勾 1 条（1）
  assertIsomorphic(judgmentCard, enumVariant,
    { submissionId: 's3', cardId: 'c9', reviewedAtMs: 0, kind: 'judgment', conclusion: 0, selected: [0, 1, 2] })
})

test('同构（§11）judgment：结论对', () => {
  assertIsomorphic(judgmentCard, enumVariant,
    { submissionId: 's4', cardId: 'c9', reviewedAtMs: 0, kind: 'judgment', conclusion: 1, selected: [0, 2] })
})

const atomicVariant: PreparedVariant = {
  optionTexts: ['对', '错A', '错B', '错C'], correctIndices: [0], distractorKeyPointIds: [],
}
const atomicCard: CardSnapshot = {
  cardId: 'c5', blockId: 'b', cardType: 'atomic', frequency: 'mid', keyPoints: [],
}

test('同构（§11）atomic：选中与选错', () => {
  assertIsomorphic(atomicCard, atomicVariant,
    { submissionId: 's5', cardId: 'c5', reviewedAtMs: 0, kind: 'atomic', selected: 0 })
  assertIsomorphic(atomicCard, atomicVariant,
    { submissionId: 's6', cardId: 'c5', reviewedAtMs: 0, kind: 'atomic', selected: 1 })
})
