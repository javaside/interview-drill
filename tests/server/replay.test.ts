import { variantAt, transitionCard, scoreSubmission } from '../../src/server/replay.js'
import type { TransitionCtx } from '../../src/server/replay.js'
import type { CardSnapshot, Submission } from '../../src/server/types.js'
import { rat } from '../../src/lib/scheduler/types.js'
import type { CardState, Rational } from '../../src/lib/scheduler/types.js'
import type { DistractorPools, OptionKeyPoint } from '../../src/lib/options/types.js'
import { prepareOptions } from '../../src/lib/options/prepare.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'

/** n 条假要点池——按计划 3 测试文件 kp/poolOf 风格内联 */
function mk(n: number): OptionKeyPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, text: `T-p${i}`, public: false, excludeAsDistractorFor: [],
  }))
}

const POOLS: DistractorPools = { sameBlock: mk(10), crossBlock: mk(10), neighbor: [] }

const enumCard: CardSnapshot = {
  cardId: 'c1', blockId: 'b1', cardType: 'enumeration', frequency: 'mid',
  keyPoints: [
    { id: 'a', text: 'A', public: false, excludeAsDistractorFor: [] },
    { id: 'b', text: 'B', public: false, excludeAsDistractorFor: [] },
    { id: 'c', text: 'C', public: false, excludeAsDistractorFor: [] },
  ],
}

function mkState(over: Partial<CardState> = {}): CardState {
  return {
    cardId: 'c1', phase: 'learning', s: rat(0, 1), plan: [], phaseIndex: 0, reviewCount: 0,
    ...over,
  }
}

function mkCtx(over: Partial<TransitionCtx> = {}): TransitionCtx {
  return {
    today: 0, mode: 'sprint', E: 19,
    settings: { readyByDate: '2030-01-01', dailyCapacity: 45 },
    loadOf: () => new Map<number, number>(),
    card: { id: 'c1', frequency: 'mid' },
    ...over,
  }
}

test('variantAt 与 prepareOptions 第 reviewIndex 份逐字节一致（确定性重算契约）', () => {
  // 两边都用正确的 OptionCard 形状（id = cardId）——修复前此测试把 CardSnapshot
  // 直接传 prepareOptions（card.id=undefined），两边同错所以「一致」，掩盖了
  // 在线判分 seed 错位的真实缺陷（见 variantAt 的修复注释）。
  const oc = {
    id: enumCard.cardId, blockId: enumCard.blockId,
    cardType: enumCard.cardType, keyPoints: enumCard.keyPoints,
  }
  const v = variantAt(enumCard, POOLS, rat(0, 1), 'u1', 3)
  const full = prepareOptions(oc, POOLS, rat(0, 1), 'u1', 3, 1)
  expect(v).toEqual(full.variants[0])
})

test('scoreSubmission：selection 按 correctIndices 判勾对/勾错', () => {
  const sub: Submission = { submissionId: 's1', cardId: 'c1', reviewedAtMs: 0, kind: 'selection', selected: [0, 2, 5] }
  const v: PreparedVariant = {
    optionTexts: ['A', 'x', 'B', 'x', 'x', 'C', 'x', 'x', 'x'],
    correctIndices: [0, 2, 5], distractorKeyPointIds: [],
  }
  const r = scoreSubmission(enumCard, v, sub)
  expect(r).toEqual({ score: rat(3, 3), correctChecked: 3, wrongChecked: 0 })
  // 勾错一条：selected 含 1（干扰）
  const r2 = scoreSubmission(enumCard, v, { ...sub, selected: [0, 1, 2] })
  expect(r2).toEqual({ score: rat(1, 3), correctChecked: 2, wrongChecked: 1 })
})

test('scoreSubmission：judgment 结论错 → 0 分，但记账按实际勾选（与染色口径一致）', () => {
  const card = { ...enumCard, cardType: 'judgment', conclusion: 'depends' } as CardSnapshot
  const v: PreparedVariant = { optionTexts: [], correctIndices: [0, 1, 2, 3], distractorKeyPointIds: [] }
  // 结论错（want=2，选了 0）+ 勾了对 2 条要点、错 0 条
  const r = scoreSubmission(card, v, {
    submissionId: 's', cardId: 'c1', reviewedAtMs: 0, kind: 'judgment', conclusion: 0, selected: [0, 1],
  })
  expect(r.score).toEqual(rat(0, 1))          // 分数层面：结论一票否决
  expect(r.correctChecked).toBe(2)            // 记账层面：实际勾对 2（染色口径）
  expect(r.wrongChecked).toBe(0)              // 实际错勾 0（不再把全部要点记成错勾）
})

test('transitionCard：答对消费今天项，s 加权，剩余遍数 = plan 长度', () => {
  // plan 偏移 [0, 2, 6]，today=0：消费 0 → 剩 [2,6]
  const st = mkState({ plan: [0, 2, 6], s: rat(1, 2), phase: 'learning' })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0 }), [])
  expect(r.state.plan).toEqual([2, 6])
  expect(r.outcome.remainingReviews).toBe(2)
  expect(r.outcome.replanned).toBe(false)
})

test('transitionCard：答错（ratio<1/2）触发 regenerateAfterFailure——新计划从明天起', () => {
  const st = mkState({ plan: [0, 5], s: rat(1, 3) })
  const r = transitionCard(st, rat(1, 3), mkCtx({ today: 0 }), [])
  expect(r.outcome.replanned).toBe(true)
  expect(r.state.plan[0]).toBeGreaterThan(0)   // 绝不今天
})

test('transitionCard：维持模式走 maintenanceStep，plan = [today + nextInDays]', () => {
  const st = mkState({ plan: [0], phase: 'learning', phaseIndex: 2 })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0, mode: 'maintenance' }), [])
  expect(r.state.phaseIndex).toBe(3)
  expect(r.state.plan).toEqual([15])           // MAINTAIN_INTERVALS[3] = 15（k: 2→3）
  expect(r.outcome.maintenanceAdvanced).toBe(true)
})

test('transitionCard：计划耗尽（答对消费完末项）→ 维持滚动兜底，不再 done', () => {
  const st = mkState({ plan: [0], phase: 'learning', phaseIndex: 0 })
  const r = transitionCard(st, rat(1, 1), mkCtx({ today: 0 }), [])
  expect(r.state.phase).toBe('learning')       // 自动毕业废除
  expect(r.state.plan).toEqual([3])            // k 0→1 进档，MAINTAIN_INTERVALS[1]=3
  expect(r.outcome.maintenanceAdvanced).toBe(true)
  expect(r.outcome.replanned).toBe(false)      // 互斥契约
})

test('transitionCard：E=0 答错（重排空计划）→ 明天再见（临阵磨枪），flag 互斥', () => {
  const st = mkState({ plan: [0], phase: 'learning', phaseIndex: 2 })
  const r = transitionCard(st, rat(0, 1), mkCtx({ today: 0, E: 0 }), [])
  expect(r.state.phase).toBe('learning')
  expect(r.state.plan).toEqual([1])            // 答错退 0 档 → 明天
  expect(r.state.phaseIndex).toBe(0)
  expect(r.outcome.replanned).toBe(true)       // 答错语义：UI 显示「计划已重排」
  expect(r.outcome.maintenanceAdvanced).toBe(false)   // 互斥契约：两 flag 不同真
})

test('transitionCard：E>0 答错 → 原重排行为不变（阶梯计划、replanned=true）', () => {
  const st = mkState({ plan: [0, 5], s: rat(1, 3) })
  const r = transitionCard(st, rat(1, 3), mkCtx({ today: 0, E: 19 }), [])
  expect(r.outcome.replanned).toBe(true)
  expect(r.outcome.maintenanceAdvanced).toBe(false)
  expect(r.state.plan.length).toBeGreaterThan(0)
  expect(r.state.plan[0]).toBeGreaterThan(0)
})
