import { scoreLocal } from '../../src/client/scoring.js'
import { scoreSubmission } from '../../src/server/replay.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'
import type { CardSnapshot, Submission } from '../../src/server/types.js'

/** 客户端 scoreLocal 与服务端 scoreSubmission 的同构守卫（§11）：四型全覆盖。
 *  背景：sequence/judgment 曾各自漂移（四舍五入换算 vs 位置精确匹配；结论错归零 vs
 *  按实际勾选），单测 enumeration 的旧守卫拦不住——离线/弱网屏② 计数与服务端落库
 *  对不上。此测试要求两核对每种提交产出完全相同的 score/correctChecked/wrongChecked。
 *
 *  mc 路径扩展（专属错误项，Task 6）：enumeration/judgment/atomic 夹具各混入 3 条 mc，
 *  comparison 单列——判分/计数只看 correctIndices，correct:false 不分来源，mc 与池
 *  干扰项必须同构。sequence 禁配 mc（spec §2.4），本组恒为无 mc 对照。
 */
function assertIsomorphic(card: CardSnapshot, variant: PreparedVariant, sub: Submission): void {
  const client = scoreLocal(card, variant, sub)
  const server = scoreSubmission(card, variant, sub)
  expect(JSON.stringify(client.score)).toBe(JSON.stringify(server.score))
  expect(client.correctChecked).toBe(server.correctChecked)
  expect(client.wrongChecked).toBe(server.wrongChecked)
}

/** 9 选项混排卷：3 正确（0/2/5）+ 3 mc（1/3/6 带 why）+ 3 池干扰项（4/7/8 带 origins） */
const enumVariant: PreparedVariant = {
  optionTexts: ['A', '误解1', 'B', '误解2', '池1', 'C', '误解3', '池2', '池3'],
  correctIndices: [0, 2, 5],
  distractorKeyPointIds: ['kp-1', 'kp-2', 'kp-3'],
  distractorOrigins: {
    4: { cardId: 'c2', blockId: 'b', question: '池1 的来源题？' },
    7: { cardId: 'c3', blockId: 'b', question: '池2 的来源题？' },
    8: { cardId: 'c4', blockId: 'b', question: '池3 的来源题？' },
  },
  misconceptionIds: ['mc-1', 'mc-2', 'mc-3'],
  misconceptionWhy: { 1: '误解1 的 why', 3: '误解2 的 why', 6: '误解3 的 why' },
}
const enumCard: CardSnapshot = {
  cardId: 'c', blockId: 'b', cardType: 'enumeration', frequency: 'mid', keyPoints: [],
}

test('同构（§11）enumeration：mc 混排卷上勾对/勾错/漏选计数逐字节相同', () => {
  // 勾 [0,1,2]：0/2 对，1 是 mc 错勾——错勾记账必须与池干扰项来源无关
  assertIsomorphic(enumCard, enumVariant,
    { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0, 1, 2] })
})

test('同构（§11）enumeration：错勾全走 mc（1/3/6）与全走池（4/7/8）两核口径一致', () => {
  assertIsomorphic(enumCard, enumVariant,
    { submissionId: 's9', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [1, 3, 6] })
  assertIsomorphic(enumCard, enumVariant,
    { submissionId: 's10', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [4, 7, 8] })
})

/** comparison：选项层与枚举同构（§4.3 分型表），同样吃 mc 混排卷 */
const comparisonCard: CardSnapshot = {
  cardId: 'c8', blockId: 'b', cardType: 'comparison', frequency: 'mid', keyPoints: [],
}

test('同构（§11）comparison：mc 与池干扰项混排卷上计数逐字节相同', () => {
  // 勾 正确(0) + mc(1) + 池(4) 各一条：wrong 的两种来源一并记 2
  assertIsomorphic(comparisonCard, enumVariant,
    { submissionId: 's8', cardId: 'c8', reviewedAtMs: 0, kind: 'selection', selected: [0, 1, 4] })
})

/** sequence：呈现 [A,B,C,D]，正确呈现序 = correctIndices = [1,0,3,2]（即 B,A,D,C） */
const seqVariant: PreparedVariant = {
  optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [1, 0, 3, 2], distractorKeyPointIds: [], misconceptionIds: [],
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
  // 结论选「会」(0)，正确是「不会」；要点勾对 2 条（0,2）、错勾 1 条（1 = mc）——
  // mc 错勾与池错勾在「按实际勾选」口径下同样记账
  assertIsomorphic(judgmentCard, enumVariant,
    { submissionId: 's3', cardId: 'c9', reviewedAtMs: 0, kind: 'judgment', conclusion: 0, selected: [0, 1, 2] })
})

test('同构（§11）judgment：结论对', () => {
  assertIsomorphic(judgmentCard, enumVariant,
    { submissionId: 's4', cardId: 'c9', reviewedAtMs: 0, kind: 'judgment', conclusion: 1, selected: [0, 2] })
})

/** atomic 全 mc 卷：1 正确 + 3 mc（spec §5.1 atomic 配满 3 条错误项即豁免的典型形态） */
const atomicVariant: PreparedVariant = {
  optionTexts: ['对', '误解A', '误解B', '误解C'], correctIndices: [0],
  distractorKeyPointIds: [],
  misconceptionIds: ['mc-a', 'mc-b', 'mc-c'],
  misconceptionWhy: { 1: '误解A 的 why', 2: '误解B 的 why', 3: '误解C 的 why' },
}
const atomicCard: CardSnapshot = {
  cardId: 'c5', blockId: 'b', cardType: 'atomic', frequency: 'mid', keyPoints: [],
}

test('同构（§11）atomic：全 mc 卷上选中与选错', () => {
  assertIsomorphic(atomicCard, atomicVariant,
    { submissionId: 's5', cardId: 'c5', reviewedAtMs: 0, kind: 'atomic', selected: 0 })
  // 选错 = 落在 mc 上：wrongChecked 记 1，与选到池干扰项无差别
  assertIsomorphic(atomicCard, atomicVariant,
    { submissionId: 's6', cardId: 'c5', reviewedAtMs: 0, kind: 'atomic', selected: 1 })
})
