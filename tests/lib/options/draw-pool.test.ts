import { buildExclusionIndex, sameBlockPoolOf } from '../../../src/lib/options/draw.js'
import type { OptionCard, OptionKeyPoint } from '../../../src/lib/options/types.js'

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `要点 ${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function card(id: string, blockId: string, kpIds: string[], over: Partial<OptionCard> = {}): OptionCard {
  return { id, blockId, cardType: 'enumeration', keyPoints: kpIds.map(k => kp(k)), ...over }
}

test('反向索引：excludeAsDistractorFor 被反转成 cardId → 要点 id 集合（§4.3 规格第 4 条）', () => {
  const kps = [
    kp('a1', { excludeAsDistractorFor: ['t1', 't2'] }),
    kp('a2', { excludeAsDistractorFor: ['t1'] }),
    kp('a3', { excludeAsDistractorFor: [] }),
  ]
  const idx = buildExclusionIndex(kps)
  expect(idx.get('t1')).toEqual(new Set(['a1', 'a2']))
  expect(idx.get('t2')).toEqual(new Set(['a1']))
  expect(idx.has('t3')).toBe(false)
})

test('sameBlockPoolOf：同块他题、未退役、排除本题要点与同 id 伪卡', () => {
  const target = card('t1', 'b1', ['t1a', 't1b'])
  const others = [
    card('t2', 'b1', ['x']),
    card('t3', 'b1', ['t3a']),
    card('t4', 'b2', ['t4a']),            // 不同块：不进池
    card('t1', 'b1', ['t1c']),            // 与目标同 id 的伪卡：防御性排除
  ]
  others[0] = {
    ...others[0]!,
    keyPoints: [kp('t2a'), kp('t2r', { retiredAt: '2026-01-01' }), kp('t1a')],
  }
  const pool = sameBlockPoolOf(target, others)
  expect(pool.map(k => k.id)).toEqual(['t2a', 't3a'])
})

test('反向索引与逐条内联过滤给出同一答案（两套写法不漂移）', () => {
  const kps = [
    kp('a', { excludeAsDistractorFor: ['t9'] }),
    kp('b', { excludeAsDistractorFor: [] }),
    kp('c', { excludeAsDistractorFor: ['t8', 't9'] }),
  ]
  const idx = buildExclusionIndex(kps)
  const inline = new Set(kps.filter(k => k.excludeAsDistractorFor.includes('t9')).map(k => k.id))
  expect(inline).toEqual(idx.get('t9'))
})
