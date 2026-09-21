import { buildDistractorPools } from '../../src/server/queue.js'
import type { CardSnapshot } from '../../src/server/types.js'
import { makeFreeEntitlement, makePaidEntitlement } from '../../src/lib/entitlement/entitlement.js'
import type { Entitlement } from '../../src/lib/entitlement/entitlement.js'

type KpOver = Partial<CardSnapshot['keyPoints'][number]>
function kp(id: string, over: KpOver = {}): CardSnapshot['keyPoints'][number] {
  return { id, text: `要点 ${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function card(cardId: string, blockId: string, keyPoints: CardSnapshot['keyPoints']): CardSnapshot {
  return { cardId, blockId, cardType: 'enumeration', frequency: 'mid', keyPoints }
}

/**
 * 两大类夹具：cat-a（b1/b2/b3，b3 未解锁且半 public）、cat-b（b4，相邻大类）。
 * categories 按显式顺序传入 → 大类值序列确定 → neighbor 层非空可断言。
 */
function mkFixture(opts: { withExclusion?: boolean } = {}) {
  const all: CardSnapshot[] = [
    // 目标块 b1（已解锁）：本卡 + 同块他卡（同块层来源，含非 public）
    card('b1-c0', 'b1', [kp('b1-c0-a'), kp('b1-c0-b')]),
    card('b1-c1', 'b1', [kp('b1-c1-priv', { public: false }), kp('b1-c1-pub', { public: true })]),
    // 同大类他块 b2（已解锁）
    card('b2-c0', 'b2', [
      kp('b2-pub', { public: true }),
      kp('b2-priv', {
        public: false,
        excludeAsDistractorFor: opts.withExclusion ? ['b1-c0'] : [],
      }),
    ]),
    // 同大类他块 b3（未解锁，半 public）
    card('b3-c0', 'b3', [kp('b3-pub', { public: true }), kp('b3-priv', { public: false })]),
    // 相邻大类 cat-b 的 b4（未解锁，半 public）
    card('b4-c0', 'b4', [kp('b4-pub', { public: true }), kp('b4-priv', { public: false })]),
  ]
  const ent = makeFreeEntitlement(['b1', 'b2'])
  const categories = new Map<string, string>([
    ['b1', 'cat-a'], ['b2', 'cat-a'], ['b3', 'cat-a'], ['b4', 'cat-b'],
  ])
  return { all, ent, categories }
}
const cardOf = (all: CardSnapshot[], id: string): CardSnapshot => all.find(c => c.cardId === id)!

test('免费用户：crossBlock 与 neighbor 两层都过 public（终审裁决的物理保证）', () => {
  const { all, ent, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf(all, 'b1-c0'), all, ent, categories)
  for (const p of pools.crossBlock) expect(p.public || (ent.plan as string) === 'paid').toBe(true)
  for (const p of pools.neighbor) expect(p.public || (ent.plan as string) === 'paid').toBe(true)
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && p.public)).toBe(true)   // public 仍要进来
  expect(pools.neighbor.some(p => p.id.startsWith('b4') && p.public)).toBe(true)
})

test('同块层不过 public（块已解锁，语料本来可见）', () => {
  const { all, ent, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf(all, 'b1-c0'), all, ent, categories)
  expect(pools.sameBlock.some(p => !p.public)).toBe(true)
  expect(pools.sameBlock.map(p => p.id).sort()).toEqual(['b1-c1-priv', 'b1-c1-pub'])
})

test('互斥登记在装配层不过滤（drawDistractors 负责过滤）——职责分离', () => {
  const { all, ent, categories } = mkFixture({ withExclusion: true })
  // b2-priv 虽登记了排除 b1-c0，但它 public=false，免费层会被 public 过滤掉——
  // 换付费用户验证互斥登记不在装配层被抹掉
  const pools = buildDistractorPools(cardOf(all, 'b1-c0'), all, makePaidEntitlement(), categories)
  expect(pools.crossBlock.some(p => p.excludeAsDistractorFor.includes('b1-c0'))).toBe(true)
})

test('付费用户：跨块层含未解锁块的非 public 要点（他买了）', () => {
  const { all, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf(all, 'b1-c0'), all, makePaidEntitlement(), categories)
  expect(pools.crossBlock.some(p => p.id === 'b3-priv' && !p.public)).toBe(true)
})

test('跨块层排除目标块自身（同块层已覆盖，不重复）', () => {
  const { all, categories } = mkFixture()
  const pools = buildDistractorPools(cardOf(all, 'b1-c0'), all, makePaidEntitlement(), categories)
  expect(pools.crossBlock.every(p => !p.id.startsWith('b1'))).toBe(true)
})
