import { buildDistractorPools } from '../../src/server/queue.js'
import type { CardSnapshot } from '../../src/server/types.js'
import { makePaidEntitlement } from '../../src/lib/entitlement/entitlement.js'
import { enumerateCandidatePairs, pairKey } from '../../src/lib/content/exclusion.js'
import type { Card } from '../../src/lib/content/types.js'

/**
 * 三层枚举（内容侧，lib/content/exclusion）必须与运行时装配（server/queue）**同一口径**。
 * 两侧各写一份是结构决定的（lib 不能依赖 server），所以用这条测试锁住等价性 ——
 * 判据写反了「谁是邻居」会换掉整个相邻层（实测 49.7% 的组），而两边总数只差 0.26%，
 * 只看总数发现不了。
 */

const kp = (id: string, over: Partial<CardSnapshot['keyPoints'][number]> = {}) =>
  ({ id, text: `要点 ${id}`, public: false, excludeAsDistractorFor: [], ...over })
const card = (cardId: string, blockId: string, keyPoints: CardSnapshot['keyPoints']): CardSnapshot =>
  ({ cardId, blockId, cardType: 'enumeration', frequency: 'mid', keyPoints })

const CATS = new Map([
  ['b1', 'cat-a'], ['b2', 'cat-a'], ['b3', 'cat-a'], ['b4', 'cat-b'], ['b5', 'cat-b'],
])

/** 覆盖：同块 / 同大类跨块 / 相邻大类 / 退役要点 / 跨卡撞 id / 已登记排除 */
function fixture(): CardSnapshot[] {
  return [
    card('c1', 'b1', [kp('c1a'), kp('c1b')]),
    card('c2', 'b2', [
      kp('c2a', { public: true }),
      kp('c2b', { excludeAsDistractorFor: ['c1'] }),   // 已登记 → 运行时会被 draw 剔掉
      kp('c1a'),                                       // 与 c1 撞 id → ownIds 会剔掉
      kp('c2-dead', { retiredAt: '2026-09-28' }),      // 退役要点 → 永不被抽
    ]),
    card('c3', 'b3', [kp('c3a', { public: true })]),
    card('c4', 'b4', [kp('c4a'), kp('c4b', { public: true })]),
    card('c5', 'b5', [kp('c5a')]),
  ]
}

/**
 * 枚举侧：把 CardSnapshot 补成 Card。keyPoints 要补上 source/verifiedAt 等字段 ——
 * 枚举本身只用 id/text/retiredAt，但类型上必须完整（这也是两侧能各写一份枚举的
 * 前提：内容侧读 Card，服务侧读 CardSnapshot）。
 */
const asContentCards = (cards: CardSnapshot[]): Card[] =>
  cards.map(c => ({
    id: c.cardId, blockId: c.blockId, question: `问题 ${c.cardId}？`,
    cardType: c.cardType, relatedBlocks: [], detail: '', followUps: [],
    appliesTo: 'x', frequency: c.frequency,
    keyPoints: c.keyPoints.map(k => ({
      ...k,
      verifiedAt: '2026-09-28',
      confirmedIndependentOf: [],
      source: { kind: 'source-code' as const, url: 'https://example.com/a', locator: 'x' },
    })),
  }))

type Pools = ReturnType<typeof buildDistractorPools>

/** 运行时实际可抽的集合：三层原始池过 draw 的 eligible 三连（退役 / ownIds / 已登记） */
function eligibleOf(pool: Pools['sameBlock'], target: CardSnapshot, targetId: string): string[] {
  const ownIds = new Set(target.keyPoints.map(k => k.id))
  return pool
    .filter(k => !k.retiredAt && !ownIds.has(k.id) && !k.excludeAsDistractorFor.includes(targetId))
    .map(k => k.id)
    .sort()
}

test('三层候选枚举与 buildDistractorPools 逐卡逐层一致（付费全量口径）', () => {
  const snaps = fixture()
  const cards = asContentCards(snaps)
  const pairs = enumerateCandidatePairs(cards, CATS)
  const ent = makePaidEntitlement()
  // 枚举**含**已登记的候选（闸门要能发现「账本说 yes 而卡文件没写」），
  // 而运行时 eligible 会把它剔掉 —— 比对时在期望一侧补上这条剔除。
  const registered = new Map(
    snaps.flatMap(c => c.keyPoints.map(k => [`${c.cardId}/${k.id}`, k.excludeAsDistractorFor] as const)),
  )

  for (const target of snaps) {
    const pools = buildDistractorPools(target, snaps, ent, CATS)
    for (const layer of ['sameBlock', 'crossBlock', 'neighbor'] as const) {
      const expected = pairs
        .filter(p => p.targetCardId === target.cardId && p.layer === layer)
        .filter(p => !(registered.get(`${p.ownerCardId}/${p.keyPointId}`) ?? []).includes(target.cardId))
        .map(p => p.keyPointId)
        .sort()
      const actual = eligibleOf(pools[layer], target, target.cardId)
      expect({ card: target.cardId, layer, ids: actual }).toEqual({ card: target.cardId, layer, ids: expected })
    }
  }
})

test('枚举不含「目标题自己」，也不含与目标卡撞 id 的候选（与运行时同一条剔除）', () => {
  const pairs = enumerateCandidatePairs(asContentCards(fixture()), CATS)
  expect(pairs.some(p => p.ownerCardId === p.targetCardId)).toBe(false)
  // c2 的 kp c1a 与目标卡 c1 撞 id → c1 看不到它
  expect(pairs.some(p => p.targetCardId === 'c1' && p.ownerCardId === 'c2' && p.keyPointId === 'c1a')).toBe(false)
  // 但它照样能当别的目标题的干扰项（撞 id 只对那个卡生效）
  expect(pairs.some(p => p.targetCardId === 'c3' && p.ownerCardId === 'c2' && p.keyPointId === 'c1a')).toBe(true)
})

test('相邻层与循环序一致：cat-b 的两块互为 cat-a 的相邻层，跨块层不含它们', () => {
  const cards = asContentCards(fixture())
  const pairs = enumerateCandidatePairs(cards, CATS)
  const layerOfOwner = (target: string, owner: string) =>
    pairs.find(p => p.targetCardId === target && p.ownerCardId === owner)?.layer
  expect(layerOfOwner('c1', 'c3')).toBe('crossBlock')       // b3 同 cat-a
  expect(layerOfOwner('c1', 'c4')).toBe('neighbor')         // b4 cat-b
  expect(layerOfOwner('c5', 'c2')).toBe('neighbor')         // cat-b 的下一项循环回 cat-a
  expect(pairKey({ ownerCardId: 'c2', keyPointId: 'c2a', targetCardId: 'c1' })).toBe('c2/c2a|c1')
})
