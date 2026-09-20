import { auditLibrary, MIN_BLOCK_POOL, type BlockLike } from '../../../src/lib/content/audit.js'
import type { Card, CardType, KeyPoint } from '../../../src/lib/content/types.js'

// 不能用 example.org —— 它是脚手架占位符 token，ready 块里会被占位符检查拦下。
const URL = 'https://github.com/openjdk/jdk/blob/master/A.java'

function kp(id: string, over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id, text: '要点', public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: [], confirmedIndependentOf: [],
    source: { kind: 'source-code', url: URL, locator: 'x' },
    ...over,
  }
}
function card(id: string, kps: KeyPoint[], cardType: CardType = 'enumeration'): Card {
  return {
    id, blockId: 'b1', relatedBlocks: [], question: '问题？', cardType,
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
  }
}
const ready: BlockLike[] = [{ id: 'b1', status: 'ready' }]
const wip: BlockLike[] = [{ id: 'b1', status: 'wip' }]

/**
 * 5 张各 3 条要点的 enumeration 卡：每张卡看到其余 4 张 ×3 = 12 条可用池，
 * 正好压在 enumeration 的下界 12 上。这是"能声明 ready 的最小健康块"。
 */
function healthyBlock(): Card[] {
  return Array.from({ length: 5 }, (_, i) =>
    card(`c${i}`, [kp(`c${i}a`), kp(`c${i}b`), kp(`c${i}c`)]))
}

/** n 张 sequence 卡（池下界为 0，永远跳过池校验），用作不会自我污染的干扰项来源 */
function seqSiblings(n: number): Card[] {
  return Array.from({ length: n }, (_, i) =>
    card(`s${i}`, [1, 2, 3].map(o => kp(`s${i}-${o}`, { order: o })), 'sequence'))
}

test('下界按 cardType 分派，sequence 为 0', () => {
  expect(MIN_BLOCK_POOL).toEqual({
    enumeration: 12, comparison: 12, judgment: 8, atomic: 6, sequence: 0,
  })
})

test('enumeration 型池不足时报错，并报出实际值与下界', () => {
  const cards = [card('c1', [kp('a1'), kp('a2'), kp('a3')]), ...seqSiblings(2)]
  const msg = auditLibrary(cards, ready).errors.join()
  expect(msg).toContain('干扰项池不足')
  expect(msg).toContain('可用 6 条')
  expect(msg).toContain('下界 12')
})

test('sequence 型不要求同块池 —— 它的选项就是自己的步骤', () => {
  const solo = [card('c1', [1, 2, 3, 4].map(o => kp(`a${o}`, { order: o })), 'sequence')]
  expect(auditLibrary(solo, ready).errors).toEqual([])
})

test('atomic 型的下界低于 enumeration —— 同样的池，一个过一个不过', () => {
  // seqSiblings 提供 6 条可用要点，且自身池下界为 0 不会反过来报错
  const pool = seqSiblings(2)
  const atomicOk = auditLibrary([card('c1', [kp('a1')], 'atomic'), ...pool], ready)
  expect(atomicOk.errors).toEqual([])

  const enumBad = auditLibrary([card('c1', [kp('a1'), kp('a2'), kp('a3')]), ...pool], ready)
  expect(enumBad.errors.some(e => e.includes('c1') && e.includes('池不足'))).toBe(true)
})

test('互斥登记把池吃到不足时同样报错', () => {
  // 健康块里 c0 本来看到 12 条；让 c1 的 3 条要点全部对 c0 登记互斥 → c0 只剩 9
  const cards = healthyBlock()
  cards[1]!.keyPoints.forEach(k => { k.excludeAsDistractorFor = ['c0'] })
  const msg = auditLibrary(cards, ready).errors.join()
  expect(msg).toContain('c0')
  expect(msg).toContain('池不足')
})

test('wip 块完全跳过池校验 —— 内容生产期间大多数块是半成品', () => {
  const cards = [card('c1', [kp('a1'), kp('a2'), kp('a3')])]
  expect(auditLibrary(cards, wip).errors).toEqual([])
})

test('不传 blocks 时不做池校验 —— 只关心 id 与外键的调用方不受影响', () => {
  const cards = [card('c1', [kp('a1'), kp('a2'), kp('a3')])]
  expect(auditLibrary(cards).errors).toEqual([])
})

test('池充足时通过', () => {
  expect(auditLibrary(healthyBlock(), ready).errors).toEqual([])
})

test('ready 块里残留脚手架占位符被拦下 —— 空骨架不能算"通过校验"', () => {
  const cards = healthyBlock()
  cards[0]!.keyPoints[0]!.text = '待填写要点 1'
  expect(auditLibrary(cards, ready).errors.join()).toContain('占位符')
})

test('同一组合既登记互斥又登记不成立，必须报出矛盾', () => {
  const c = card('c1', [kp('a1', { excludeAsDistractorFor: ['x'], confirmedIndependentOf: ['x'] }), kp('a2'), kp('a3')])
  expect(auditLibrary([c]).errors.join()).toContain('矛盾')
})

test('wip 块里的占位符不报错 —— 半成品是正常状态', () => {
  const stub = card('c1', [kp('a1'), kp('a2'), kp('a3')])
  stub.keyPoints[0]!.text = '待填写要点 1'
  expect(auditLibrary([stub], wip).errors).toEqual([])
})
