import { scoreLocal } from '../../src/client/scoring.js'
import { rat } from '../../src/lib/scheduler/types.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'
import type { Submission } from '../../src/server/types.js'

const variant: PreparedVariant = {
  optionTexts: ['A', 'x', 'B', 'x', 'x', 'C', 'x', 'x', 'x'],
  correctIndices: [0, 2, 5],
  distractorKeyPointIds: [],
}

test('selection：全对 3/3，missed=0 wrong=0', () => {
  const sub: Submission = { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0, 2, 5] }
  expect(scoreLocal({ cardType: 'enumeration' }, variant, sub)).toEqual({ score: rat(3, 3), correctChecked: 3, wrongChecked: 0, missed: 0 })
})

test('selection：漏一条 + 错勾一条 → correct=1 wrong=1 missed=2', () => {
  const sub: Submission = { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0, 1] }
  const r = scoreLocal({ cardType: 'enumeration' }, variant, sub)
  expect(r.correctChecked).toBe(1)   // 只勾中 0
  expect(r.wrongChecked).toBe(1)     // 勾了 1（干扰）
  expect(r.missed).toBe(2)           // 2、5 未勾
})

test('judgment：结论错 → 0 分；记账按实际勾选（与染色同口径，不再归零/记全错）', () => {
  const sub: Submission = { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'judgment', conclusion: 0, selected: [0] }
  const r = scoreLocal({ cardType: 'judgment', conclusion: 'depends' }, { ...variant, correctIndices: [0] }, sub)
  expect(r.score).toEqual(rat(0, 1))     // 结论错一票否决
  expect(r.correctChecked).toBe(1)       // 要点勾对了（染色也是绿）
  expect(r.missed).toBe(0)               // 没有漏选——header 与屏② 染色一致
  expect(r.wrongChecked).toBe(0)
})

test('atomic：命中 1 分', () => {
  const sub: Submission = { submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'atomic', selected: 0 }
  expect(scoreLocal({ cardType: 'atomic' }, { ...variant, correctIndices: [0] }, sub).score).toEqual(rat(1, 1))
})
