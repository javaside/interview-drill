import { cardSchema, MIN_KEY_POINTS } from '../../../src/lib/content/schema.js'
import type { Card, KeyPoint, Misconception } from '../../../src/lib/content/types.js'

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

function mc(over: Partial<Misconception> = {}): Misconception {
  return {
    id: 'mc-1',
    text: 'synchronized 锁的是方法而不是对象',
    why: 'synchronized 锁的始终是对象（实例方法锁 this，静态方法锁 Class 对象）',
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

test('misconceptions：why 必填、id 禁含 #、上限 8、strict 拒未知字段', () => {
  // 1) 缺 why → parse 拒，issue 提到 why（错勾永远有「为什么错」，spec §2.1）
  const r1 = cardSchema.safeParse(card({ misconceptions: [mc({ why: undefined })] }))
  expect(r1.success).toBe(false)
  if (r1.success) throw new Error('缺 why 的 mc 必须被拒')
  expect(r1.error.issues.some(i => i.path.includes('why'))).toBe(true)

  // 2) id 含 # → parse 拒：content-upsert 的 tombstone 以 cardId#id 作 unnest 拼接键，# 会撞键
  const r2 = cardSchema.safeParse(card({ misconceptions: [mc({ id: 'mc-1#2' })] }))
  expect(r2.success).toBe(false)
  if (r2.success) throw new Error('id 含 # 的 mc 必须被拒')
  expect(r2.error.issues.some(i => i.message.includes('#'))).toBe(true)

  // 3) 9 条 mc → parse 拒（.max(8)）
  const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => mc({ id: `mc-${i}` }))
  const r3 = cardSchema.safeParse(card({ misconceptions: nine }))
  expect(r3.success).toBe(false)
  if (r3.success) throw new Error('9 条 mc 必须被拒')

  // 4) mc 里写未知字段 → parse 拒，issue 提到拼错的键名（.strict()，静默剥离 = 无信号）
  const r4 = cardSchema.safeParse(card({ misconceptions: [{ ...mc(), foo: 1 } as never] }))
  expect(r4.success).toBe(false)
  if (r4.success) throw new Error('未知字段 foo 必须被拒')
  expect(r4.error.issues.some(i => i.message.includes('foo'))).toBe(true)

  // 5) 合法 3 条（含可选字段）→ parse 过，Card.misconceptions 逐字段还原
  const three = [
    mc({ id: 'mc-a' }),
    mc({ id: 'mc-b', retiredAt: '2026-10-01' }),
    mc({ id: 'mc-c', movedFrom: 'mc-old' }),
  ]
  const r5 = cardSchema.safeParse(card({ misconceptions: three }))
  if (!r5.success) throw new Error(`合法 3 条 mc 应通过：${r5.error.issues.map(i => i.message).join('; ')}`)
  expect(r5.data.misconceptions).toEqual(three)

  // 6) 不带 misconceptions 字段 → parse 过且 undefined（存量 404 卡零迁移）
  const r6 = cardSchema.safeParse(card())
  if (!r6.success) throw new Error('不带 misconceptions 的存量卡必须照常通过')
  expect(r6.data.misconceptions).toBeUndefined()
})

test('sequence 卡配 misconceptions → superRefine 拒（死内容防线）', () => {
  const four = [1, 2, 3, 4].map(i => kp({ id: `kp-${i}`, order: i }))
  const r = cardSchema.safeParse(card({ cardType: 'sequence', keyPoints: four, misconceptions: [mc()] }))
  expect(r.success).toBe(false)
  if (r.success) throw new Error('sequence + mc 必须被拒')
  expect(r.error.issues.some(i => i.path.includes('misconceptions'))).toBe(true)
})
