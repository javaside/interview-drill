import { cardSchema, MIN_KEY_POINTS } from '../../../src/lib/content/schema.js'
import type { Card, KeyPoint } from '../../../src/lib/content/types.js'

function kp(over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id: 'kp-1',
    text: 'state 是 volatile int，表示同步状态',
    source: { kind: 'source-code', url: 'https://example.org/AQS.java', locator: 'AbstractQueuedSynchronizer#state' },
    excludeAsDistractorFor: [],
    confirmedIndependentOf: [],
    verifiedAt: '2026-09-18',
    public: false,
    ...over,
  }
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: '01J8ZKQ7Y0000000000000000A',
    blockId: 'concurrency/aqs',
    relatedBlocks: [],
    question: 'AQS 是怎么实现独占锁的？',
    cardType: 'enumeration',
    keyPoints: [kp({ id: 'kp-1' }), kp({ id: 'kp-2' }), kp({ id: 'kp-3' })],
    detail: '展开讲解',
    followUps: ['为什么队列是双向的？'],
    appliesTo: 'JDK 8+',
    frequency: 'high',
    ...over,
  }
}

test('每种 cardType 的最少要点数各不相同', () => {
  expect(MIN_KEY_POINTS).toEqual({
    enumeration: 3, comparison: 3, sequence: 4, judgment: 2, atomic: 1,
  })
})

test('atomic 型只要 1 条要点也合法', () => {
  const r = cardSchema.safeParse(card({ cardType: 'atomic', keyPoints: [kp()] }))
  expect(r.success).toBe(true)
})

test('enumeration 型只给 2 条要点应失败', () => {
  const r = cardSchema.safeParse(card({ keyPoints: [kp({ id: 'a' }), kp({ id: 'b' })] }))
  expect(r.success).toBe(false)
})

test('sequence 型的每条要点必须有 order', () => {
  const four = [1, 2, 3, 4].map(i => kp({ id: `kp-${i}` }))
  const r = cardSchema.safeParse(card({ cardType: 'sequence', keyPoints: four }))
  expect(r.success).toBe(false)

  const withOrder = [1, 2, 3, 4].map(i => kp({ id: `kp-${i}`, order: i }))
  const ok = cardSchema.safeParse(card({ cardType: 'sequence', keyPoints: withOrder }))
  expect(ok.success).toBe(true)
})

test('要点上限 6 条', () => {
  const seven = [1, 2, 3, 4, 5, 6, 7].map(i => kp({ id: `kp-${i}` }))
  expect(cardSchema.safeParse(card({ keyPoints: seven })).success).toBe(false)
})

test('中文博客不能作为 source —— kind 枚举挡住它', () => {
  const bad = kp({ source: { kind: 'blog' as never, url: 'https://blog.csdn.net/x', locator: '全文' } })
  expect(cardSchema.safeParse(card({ keyPoints: [bad, kp({ id: 'b' }), kp({ id: 'c' })] })).success).toBe(false)
})

test('卡级未知字段被拒，不被静默丢弃', () => {
  const r = cardSchema.safeParse({ ...card(), retiredAT: '2026-09-18' })
  expect(r.success).toBe(false)
})

test('要点级未知字段被拒 —— 拼错的可选字段必须有信号', () => {
  const bad = { ...kp(), confirmedIndependntOf: [] }
  const r = cardSchema.safeParse(card({ keyPoints: [bad as never, kp({ id: 'b' }), kp({ id: 'c' })] }))
  expect(r.success).toBe(false)
})

test('verifiedAt 必须是 YYYY-MM-DD', () => {
  const bad = kp({ verifiedAt: '2026/09/18' })
  expect(cardSchema.safeParse(card({ keyPoints: [bad, kp({ id: 'b' }), kp({ id: 'c' })] })).success).toBe(false)
})

test('judgment 必须携带结论字段，其余型禁填（§4.4 二段式）', () => {
  const base = {
    id: 'c1', blockId: 'b', relatedBlocks: [], question: 'q', detail: 'd',
    followUps: [], appliesTo: 'JDK 8+', frequency: 'mid' as const,
    keyPoints: [
      { id: 'k1', text: 'a', source: { kind: 'official-doc' as const, url: 'https://x', locator: 's1' },
        excludeAsDistractorFor: [], confirmedIndependentOf: [], verifiedAt: '2026-01-01', public: false },
      { id: 'k2', text: 'b', source: { kind: 'official-doc' as const, url: 'https://x', locator: 's2' },
        excludeAsDistractorFor: [], confirmedIndependentOf: [], verifiedAt: '2026-01-01', public: false },
    ],
  }
  const judgment = { ...base, cardType: 'judgment' as const }
  expect(() => cardSchema.parse(judgment)).toThrow()                    // 缺 conclusion
  expect(cardSchema.parse({ ...judgment, conclusion: 'depends' })).toBeTruthy()
  expect(() => cardSchema.parse({ ...judgment, conclusion: 'maybe' })).toThrow()
  const enumCard = { ...base, cardType: 'enumeration' as const, keyPoints: [...base.keyPoints, base.keyPoints[0]!] }
  enumCard.keyPoints[2] = { ...base.keyPoints[0]!, id: 'k3' }
  expect(() => cardSchema.parse({ ...enumCard, conclusion: 'yes' })).toThrow()  // 非 judgment 禁填
})
