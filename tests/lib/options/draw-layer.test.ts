import { layerCounts, drawDistractors } from '../../../src/lib/options/draw.js'
import { seedRng } from '../../../src/lib/options/rng.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, Rational } from '../../../src/lib/options/types.js'

const s = (num: number, den: number): Rational => ({ num, den })

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function poolOf(prefix: string, n: number): OptionKeyPoint[] {
  return Array.from({ length: n }, (_, i) => kp(`${prefix}${i}`))
}
function pools(same: OptionKeyPoint[], cross: OptionKeyPoint[], neighbor: OptionKeyPoint[] = []): DistractorPools {
  return { sameBlock: same, crossBlock: cross, neighbor }
}
function targetCard(): OptionCard {
  return { id: 't1', blockId: 'b1', cardType: 'enumeration', keyPoints: [kp('t1a'), kp('t1b'), kp('t1c')] }
}

test('分层比例分数表：四档各自正确，余数给跨块（交叉相乘，无浮点）', () => {
  expect(layerCounts(6, s(0, 1))).toEqual({ sameBlock: 2, crossBlock: 4 })   // 3s<1 → 1:2
  expect(layerCounts(6, s(1, 3))).toEqual({ sameBlock: 3, crossBlock: 3 })   // 3s=1 → 1:1
  expect(layerCounts(6, s(1, 2))).toEqual({ sameBlock: 3, crossBlock: 3 })   // 3s<2 → 1:1
  expect(layerCounts(6, s(2, 3))).toEqual({ sameBlock: 4, crossBlock: 2 })   // 3s=2 → 2:1
  expect(layerCounts(6, s(5, 6))).toEqual({ sameBlock: 4, crossBlock: 2 })   // s<1 → 2:1
  expect(layerCounts(6, s(1, 1))).toEqual({ sameBlock: 6, crossBlock: 0 })   // s=1 → 3:0
  // 余数给跨块：5 条按 1:2 → 1 + 4；按 2:1 → 3 + 2
  expect(layerCounts(5, s(0, 1))).toEqual({ sameBlock: 1, crossBlock: 4 })
  expect(layerCounts(5, s(2, 3))).toEqual({ sameBlock: 3, crossBlock: 2 })
  // 未约分输入同样正确：2/4 与 1/2 同档
  expect(layerCounts(6, s(2, 4))).toEqual({ sameBlock: 3, crossBlock: 3 })
})

test('按层抽取：条数精确、层来源符合比例、无重复', () => {
  const r = drawDistractors(targetCard(), pools(poolOf('s', 10), poolOf('c', 10)), 6, s(0, 1), seedRng(1))
  expect(r.keyPoints).toHaveLength(6)
  expect(r.degradedTo).toBe('none')
  const ids = r.keyPoints.map(k => k.id)
  expect(new Set(ids).size).toBe(6)
  expect(ids.filter(i => i.startsWith('s'))).toHaveLength(2)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(4)
})

test('互斥与本题要点永不被抽中（§11）', () => {
  const same = [
    kp('sx1', { excludeAsDistractorFor: ['t1'] }),   // 对目标卡成立：禁抽
    kp('t1a'),                                        // 与本题要点同 id：禁抽
    kp('s0'), kp('s1'), kp('s2'),
  ]
  const cross = [
    kp('cx1', { excludeAsDistractorFor: ['t2', 't1'] }),   // 对目标卡成立：禁抽
    ...poolOf('c', 6),
  ]
  const r = drawDistractors(targetCard(), pools(same, cross), 6, s(0, 1), seedRng(2))
  const ids = r.keyPoints.map(k => k.id)
  expect(ids).not.toContain('sx1')
  expect(ids).not.toContain('cx1')
  expect(ids).not.toContain('t1a')
  expect(r.keyPoints).toHaveLength(6)   // 被过滤掉的不占名额——总数绝不少给
})

test('同块不足 → 缺口滚给跨块，总数不变、不算降级', () => {
  const r = drawDistractors(targetCard(), pools(poolOf('s', 1), poolOf('c', 10)), 6, s(1, 1), seedRng(3))
  // s=1 → 3:0 全要同块，但同块只有 1 条 → 5 条缺口由跨块补
  const ids = r.keyPoints.map(k => k.id)
  expect(ids.filter(i => i.startsWith('s'))).toHaveLength(1)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(5)
  expect(r.degradedTo).toBe('none')
})

test('两层枯竭 → 相邻大类兜底并降级标记', () => {
  const r = drawDistractors(targetCard(), pools([], poolOf('c', 1), poolOf('n', 10)), 6, s(0, 1), seedRng(4))
  const ids = r.keyPoints.map(k => k.id)
  expect(ids.filter(i => i.startsWith('c'))).toHaveLength(1)
  expect(ids.filter(i => i.startsWith('n'))).toHaveLength(5)
  expect(r.degradedTo).toBe('neighbor')
})

test('三层全枯竭 → 抛错，绝不静默少给（§4.3 规格第 2 条）', () => {
  expect(() =>
    drawDistractors(targetCard(), pools([], [], poolOf('n', 1)), 3, s(0, 1), seedRng(5)),
  ).toThrow()
})

test('跨层重叠也不重复：同 id 要点在两层都出现时只抽一次，总数不少给', () => {
  const shared = kp('d0')
  const same = [shared, kp('s1'), kp('s2')]
  const cross = [shared, ...poolOf('c', 6)]
  const r = drawDistractors(targetCard(), pools(same, cross), 6, s(0, 1), seedRng(6))
  const ids = r.keyPoints.map(k => k.id)
  expect(new Set(ids).size).toBe(6)                    // 无重复
  expect(ids).toHaveLength(6)                          // 且绝不少给
})
