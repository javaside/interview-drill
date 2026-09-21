import { prepareOptions } from '../../../src/lib/options/prepare.js'
import { drawDistractors, sameBlockPoolOf } from '../../../src/lib/options/draw.js'
import type { OptionCard, OptionKeyPoint, DistractorPools } from '../../../src/lib/options/types.js'
import { crossBlockPoolFor, makeFreeEntitlement } from '../../../src/lib/entitlement/entitlement.js'
import { seedRng } from '../../../src/lib/options/rng.js'

const S0 = { num: 0, den: 1 }

function kp(id: string, over: Partial<OptionKeyPoint> = {}): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [], ...over }
}
function card(id: string, blockId: string, cardType: OptionCard['cardType'], points: OptionKeyPoint[]): OptionCard {
  return { id, blockId, cardType, keyPoints: points }
}

/** 大类 mysql：b1/b2/b3 各 3 卡 × 每卡 3 要点；b3 未解锁，其要点 1 public + 2 私有 */
function buildCategory() {
  const mk = (blockId: string, n: number, publicFirst = false) =>
    Array.from({ length: n }, (_, i) =>
      card(`${blockId}-c${i}`, blockId, 'enumeration', [
        kp(`${blockId}-c${i}-p`, { public: publicFirst }),
        kp(`${blockId}-c${i}-x1`, { public: !publicFirst }),
        kp(`${blockId}-c${i}-x2`),
      ]),
    )
  const all = [...mk('b1', 3), ...mk('b2', 3), ...mk('b3', 3, true)]
  // b2 那条 public 要点对目标卡 t1 也成立：互斥登记。选 public 那条（b2-c0-x1）
  // 是刻意的——非 public 要点根本进不了免费跨块池，断言会空洞通过
  all[3]!.keyPoints[1] = { ...all[3]!.keyPoints[1]!, excludeAsDistractorFor: ['t1'] }
  // 目标卡固定用 b1 第一张，id 改为 t1
  all[0] = { ...all[0]!, id: 't1' }
  return all
}

function poolsFor(target: OptionCard, all: OptionCard[]): DistractorPools {
  const ent = makeFreeEntitlement(['b1', 'b2'])
  const otherBlocksPoints = all
    .filter(c => c.blockId !== target.blockId)
    .flatMap(c => c.keyPoints)
    .filter(p => !p.retiredAt)
  return {
    sameBlock: sameBlockPoolOf(target, all),
    crossBlock: crossBlockPoolFor(ent, otherBlocksPoints),
    // 相邻大类池同样过 public——免费用户手里不该有任何未解锁语料（§4.3
    // 「客户端永远不持有未解锁内容」，server 装配约定，计划 4 落实）
    neighbor: crossBlockPoolFor(
      ent,
      Array.from({ length: 5 }, (_, i) => kp(`nb${i}`, { public: true })),
    ),
  }
}

test('§11 免费用户：跨块干扰项只来自公开要点池，未解锁块的非 public 要点零出现', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  // 夹具自检：跨块池确实含 b3 的 public 要点且不含其私有要点
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && p.public)).toBe(true)
  expect(pools.crossBlock.some(p => p.id.startsWith('b3') && !p.public)).toBe(false)

  const forbidden = new Set(
    all.filter(c => c.blockId === 'b3').flatMap(c => c.keyPoints).filter(p => !p.public).map(p => p.text),
  )
  const r = prepareOptions(t1, pools, S0, 'u-free', 0, 21)   // 21 次复习全扫
  for (const v of r.variants) {
    expect(v.optionTexts).toHaveLength(9)
    for (const text of v.optionTexts) {
      expect(forbidden.has(text)).toBe(false)   // 泄露边界：一次都不许出现
    }
  }
})

test('§11 互斥项永不被抽中', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  const r = prepareOptions(t1, pools, S0, 'u1', 0, 21)
  for (const v of r.variants) {
    expect(v.distractorKeyPointIds).not.toContain('b2-c0-x1')
  }
})

test('§11 同一 seed 输出可复现：两次调用 JSON 逐字节相等', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const pools = poolsFor(t1, all)
  const a = prepareOptions(t1, pools, S0, 'u1', 0, 5)
  const b = prepareOptions(t1, pools, S0, 'u1', 0, 5)
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
})

test('§11 选项总数恒定：五种 cardType 全型扫描', () => {
  const all = buildCategory()
  const pools = poolsFor(all[0]!, all)
  const cards: Array<{ card: OptionCard; wantTotal: number }> = [
    { card: card('e', 'b1', 'enumeration', [kp('a'), kp('b'), kp('c')]), wantTotal: 9 },
    { card: card('e4', 'b1', 'enumeration', [kp('a'), kp('b'), kp('c'), kp('d')]), wantTotal: 9 },
    { card: card('cmp', 'b1', 'comparison', [kp('a'), kp('b'), kp('c')]), wantTotal: 9 },
    { card: card('jd', 'b1', 'judgment', [kp('a'), kp('b')]), wantTotal: 9 },   // 2 要点 → 7 干扰项
    { card: card('at', 'b1', 'atomic', [kp('a')]), wantTotal: 4 },
    {
      card: card('seq', 'b1', 'sequence', [kp('a', { order: 1 }), kp('b', { order: 2 }), kp('c', { order: 3 }), kp('d', { order: 4 })]),
      wantTotal: 4,   // sequence = 要点数，不打乱
    },
  ]
  for (const { card: c, wantTotal } of cards) {
    const r = prepareOptions(c, pools, S0, 'u1', 0, 2)
    for (const v of r.variants) expect(v.optionTexts).toHaveLength(wantTotal)
  }
})

test('§11 池不足降级不断供：两层枯竭走相邻大类，总数仍 9', () => {
  const all = buildCategory()
  const t1 = all[0]!
  const starved: DistractorPools = {
    sameBlock: [],
    // 挑一条无互斥登记的 public 要点——夹具里 b2-c0-x1 恰好对 t1 互斥禁抽，
    // 直接 slice(0,1) 会拿到它，跨块层可用实为 0 条，测试含义就变了
    crossBlock: poolsFor(t1, all).crossBlock.filter(p => p.id !== 'b2-c0-x1').slice(0, 1),
    neighbor: Array.from({ length: 8 }, (_, i) => kp(`nb${i}`)),
  }
  const d = drawDistractors(t1, starved, 6, S0, seedRng(11))
  expect(d.degradedTo).toBe('neighbor')
  expect(d.keyPoints).toHaveLength(6)
  const r = prepareOptions(t1, starved, S0, 'u1', 0, 1)
  expect(r.variants[0]!.optionTexts).toHaveLength(9)
})
