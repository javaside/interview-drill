import { applyExclusionsToRaw, registerDecision } from '../../tools/review/register.js'
import { parseCard } from '../../src/lib/content/parse.js'

const SRC = `---
id: c1
blockId: b1
relatedBlocks: []
question: 问题？
cardType: enumeration
appliesTo: JDK 8+
frequency: mid
followUps: []
keyPoints:
  - id: kp-1
    text: 要点一
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/a
      locator: x
  - id: kp-2
    text: 要点二
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/b
      locator: y
  - id: kp-3
    text: 要点三
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://example.org/c
      locator: z
---

正文`

test('写回后源文件仍可解析，且登记生效', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2'])
})

test('答"否"写进 confirmedIndependentOf，不影响出题', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'independent')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual([])
  expect(r.card.keyPoints[0]!.confirmedIndependentOf).toEqual(['c2'])
})

test('是纯函数 —— 同一输入调用两次，第二次不带出第一次的结果', () => {
  const a = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const b = registerDecision(SRC, 'kp-1', 'c9', 'exclude')
  const ra = parseCard(a, 'x.md'); const rb = parseCard(b, 'x.md')
  expect(ra.ok && rb.ok).toBe(true)
  if (!ra.ok || !rb.ok) return
  expect(ra.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2'])
  expect(rb.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c9'])
})

test('重复登记同一目标后内容逐字节不变 —— diff 稳定', () => {
  const once = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  const twice = registerDecision(once, 'kp-1', 'c2', 'exclude')
  expect(twice).toBe(once)
})

test('登记目标按字典序排列，便于 diff 审查', () => {
  let out = registerDecision(SRC, 'kp-1', 'c9', 'exclude')
  out = registerDecision(out, 'kp-1', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2', 'c9'])
})

test('无关字段不被改写 —— verifiedAt 不变成时间戳、url 不被加引号', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  expect(out).toContain('verifiedAt: 2026-09-18')
  expect(out).toContain('url: https://example.org/a')
  expect(out).not.toContain('T00:00:00')
})

test('写进的是指定的那条要点，不是第一条', () => {
  const out = registerDecision(SRC, 'kp-2', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual([])
  expect(r.card.keyPoints[1]!.excludeAsDistractorFor).toEqual(['c2'])
  expect(r.card.keyPoints[2]!.excludeAsDistractorFor).toEqual([])
})

test('只动目标要点，其余要点的其他字段一律不变', () => {
  const out = registerDecision(SRC, 'kp-2', 'c2', 'exclude')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints.map(k => k.text)).toEqual(['要点一', '要点二', '要点三'])
  expect(r.card.keyPoints.map(k => k.public)).toEqual([true, false, false])
  expect(r.card.keyPoints.map(k => k.source.locator)).toEqual(['x', 'y', 'z'])
})

test('要点 id 不存在时抛出明确错误', () => {
  expect(() => registerDecision(SRC, 'no-such-kp', 'c2', 'exclude')).toThrow(/no-such-kp/)
})

test('正文部分不被改动', () => {
  const out = registerDecision(SRC, 'kp-1', 'c2', 'exclude')
  expect(out.trimEnd().endsWith('正文')).toBe(true)
})

// ---- 批处理变体（账本 → 卡文件投影）----

test('批处理：按投影置位，未在投影里的要点被清空（账本是权威）', () => {
  const withOld = registerDecision(SRC, 'kp-3', 'c-old', 'exclude')
  const out = applyExclusionsToRaw(withOld, new Map([['kp-1', ['c9', 'c2']]]))
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.excludeAsDistractorFor).toEqual(['c2', 'c9'])   // 去重 + 字典序
  expect(r.card.keyPoints[1]!.excludeAsDistractorFor).toEqual([])
  expect(r.card.keyPoints[2]!.excludeAsDistractorFor).toEqual([])             // 旧登记被清掉
})

test('批处理：幂等 —— 同一投影跑两次逐字节相同（diff 只显示真正变化）', () => {
  const once = applyExclusionsToRaw(SRC, new Map([['kp-1', ['c2']]]))
  expect(applyExclusionsToRaw(once, new Map([['kp-1', ['c2']]]))).toBe(once)
})

test('批处理：无关字段不被改写，confirmedIndependentOf 原样保留', () => {
  const withNote = registerDecision(SRC, 'kp-1', 'c2', 'independent')
  const out = applyExclusionsToRaw(withNote, new Map())
  expect(out).toContain('verifiedAt: 2026-09-18')
  expect(out).toContain('url: https://example.org/a')
  expect(out).not.toContain('T00:00:00')
  const r = parseCard(out, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.confirmedIndependentOf).toEqual(['c2'])   // 人工判定不被账本清掉
  expect(out.trimEnd().endsWith('正文')).toBe(true)
})

test('批处理：缺 keyPoints 时抛出明确错误', () => {
  expect(() => applyExclusionsToRaw('---\nid: c1\n---\n正文', new Map())).toThrow(/keyPoints/)
})
