import { prepareOptions } from '../../../src/lib/options/prepare.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, OptionMisconception } from '../../../src/lib/options/types.js'

const S0 = { num: 0, den: 1 }          // 未熟练 → 固定分支
const S_PROF = { num: 2, den: 3 }      // 熟练 → 换血分支

function kp(id: string): OptionKeyPoint {
  return { id, text: `T-${id}`, public: false, excludeAsDistractorFor: [] }
}
function pools(): DistractorPools {
  return {
    sameBlock: Array.from({ length: 10 }, (_, i) => kp(`s${i}`)),
    crossBlock: Array.from({ length: 12 }, (_, i) => kp(`c${i}`)),
    neighbor: [],
  }
}
function mc(id: string, why = `W-${id}`): OptionMisconception {
  return { id, text: `M-${id}`, why }
}
function cardWith(nMc: number): OptionCard {
  return {
    id: 'e1', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0'), kp('k1'), kp('k2')],
    misconceptions: Array.from({ length: nMc }, (_, i) => mc(`m${i}`)),
  }
}

test('专属优先：mc 文本出现在选项里，池干扰项只补缺口（3 正确 + 4 mc + 池补 2）', () => {
  const r = prepareOptions(cardWith(4), pools(), S_PROF, 'u1', 0, 1)
  const v = r.variants[0]!
  expect(v.optionTexts).toHaveLength(9)
  const mcTexts = ['M-m0', 'M-m1', 'M-m2', 'M-m3']
  for (const t of mcTexts) expect(v.optionTexts).toContain(t)
  const poolTexts = v.optionTexts.filter(t => t.startsWith('T-') && !['T-k0', 'T-k1', 'T-k2'].includes(t))
  expect(poolTexts).toHaveLength(2)
  expect(v.misconceptionIds.sort()).toEqual(['m0', 'm1', 'm2', 'm3'])
  // why 映射：mc 所在下标 → why
  const whyVals = Object.values(v.misconceptionWhy ?? {})
  expect(whyVals.sort()).toEqual(['W-m0', 'W-m1', 'W-m2', 'W-m3'])
})

test('固定分支（s<2/3）：跨 K 份、跨调用干扰项集合恒同，排列互异；s 演化跨 3s=1 档集合仍不变', () => {
  const c = cardWith(4)
  const a = prepareOptions(c, pools(), { num: 0, den: 1 }, 'u1', 0, 3)
  const b = prepareOptions(c, pools(), { num: 1, den: 2 }, 'u1', 0, 3)  // 仍在未熟练带，但跨过 layerCounts 3s=1 档
  for (let i = 0; i < 3; i++) {
    expect(new Set(b.variants[i]!.optionTexts)).toEqual(new Set(a.variants[i]!.optionTexts))
  }
  // K 份之间集合恒同、排列互异
  expect(new Set(a.variants[0]!.optionTexts)).toEqual(new Set(a.variants[1]!.optionTexts))
  expect(a.variants[0]!.optionTexts).not.toEqual(a.variants[1]!.optionTexts)
  // 跨调用（同 reviewIndexBase）逐字节相等
  const again = prepareOptions(c, pools(), { num: 0, den: 1 }, 'u1', 0, 3)
  expect(JSON.stringify(a)).toBe(JSON.stringify(again))
})

test('固定分支对无 mc 存量卡同样生效：池干扰项集合跨 K 份恒同、排列互异', () => {
  const c = cardWith(0)
  const r = prepareOptions(c, pools(), S0, 'u1', 0, 3)
  const sets = r.variants.map(v => [...v.optionTexts].sort().join('|'))
  expect(sets[0]).toBe(sets[1])
  expect(r.variants[0]!.optionTexts).not.toEqual(r.variants[1]!.optionTexts)
  expect(r.variants[0]!.misconceptionIds).toEqual([])
})

test('熟练分支（s≥2/3）：无 mc 时与现状签名一致——同输入逐字节相等、跨 reviewIndex 换血', () => {
  const c = cardWith(0)
  const a = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1)
  const again = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1)
  expect(JSON.stringify(a)).toBe(JSON.stringify(again))
  const b = prepareOptions(c, pools(), S_PROF, 'u1', 500, 1)
  expect(new Set(b.variants[0]!.optionTexts)).not.toEqual(new Set(a.variants[0]!.optionTexts))
})

test('熟练分支 mc 多于缺口：跨 reviewIndex 子集轮换（每条都值得见）', () => {
  const c = cardWith(8)   // enumeration 3 正确 → 缺口 6，8 > 6
  const a = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1).variants[0]!
  const b = prepareOptions(c, pools(), S_PROF, 'u1', 1, 1).variants[0]!
  const d = prepareOptions(c, pools(), S_PROF, 'u1', 2, 1).variants[0]!
  expect(a.misconceptionIds).toHaveLength(6)
  expect(b.misconceptionIds).toHaveLength(6)
  // 8 选 6、三份不同 seed：合计见过的 mc 超过单份的 6 条（轮换的可观测签名）
  expect(new Set([...a.misconceptionIds, ...b.misconceptionIds, ...d.misconceptionIds]).size)
    .toBeGreaterThan(6)
})

test('退役 mc 不出现；mc+池全枯竭仍抛错', () => {
  const c: OptionCard = {
    id: 'e2', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0'), kp('k1'), kp('k2')],
    misconceptions: [
      { id: 'm0', text: 'M-m0', why: 'W-m0', retiredAt: '2026-10-01' },
    ],
  }
  const tiny: DistractorPools = { sameBlock: [], crossBlock: [], neighbor: [] }
  expect(() => prepareOptions(c, tiny, S_PROF, 'u1', 0, 1))
    .toThrow(/干扰项池枯竭/)
})

test('退役 mc 不出现（池充足）：只吃活 mc，退役文本与 id 都不进卷，池补其余缺口', () => {
  const c: OptionCard = {
    id: 'e3', blockId: 'b1', cardType: 'enumeration',
    keyPoints: [kp('k0'), kp('k1'), kp('k2')],
    misconceptions: [
      mc('live0'),
      mc('live1'),
      { id: 'dead0', text: 'M-dead0', why: 'W-dead0', retiredAt: '2026-10-01' },
    ],
  }
  const v = prepareOptions(c, pools(), S_PROF, 'u1', 0, 1).variants[0]!
  expect(v.optionTexts).toHaveLength(9)
  expect(v.optionTexts).toContain('M-live0')
  expect(v.optionTexts).toContain('M-live1')
  expect(v.optionTexts).not.toContain('M-dead0')   // draw 的 retiredAt 过滤是唯一防线，退役静默复出必须在此钉死
  expect(v.misconceptionIds.sort()).toEqual(['live0', 'live1'])   // 退役 id 同样不进（review_log 复现口径）
  // 缺口 6：活 mc 用 2，池只补 4
  const poolTexts = v.optionTexts.filter(t => t.startsWith('T-') && !['T-k0', 'T-k1', 'T-k2'].includes(t))
  expect(poolTexts).toHaveLength(4)
})

test('atomic 配满 mc：1 要点 + 3 mc → 4 选 1 零池依赖，distractorKeyPointIds 为空', () => {
  const c: OptionCard = {
    id: 'a1', blockId: 'b1', cardType: 'atomic',
    keyPoints: [kp('k0')],
    misconceptions: [mc('m0'), mc('m1'), mc('m2')],
  }
  const empty: DistractorPools = { sameBlock: [], crossBlock: [], neighbor: [] }
  const v = prepareOptions(c, empty, S_PROF, 'u1', 0, 1).variants[0]!
  expect(v.optionTexts).toHaveLength(4)
  expect(v.distractorKeyPointIds).toEqual([])   // 池零抽取：空池也不降级、不抛枯竭
  expect(v.misconceptionIds.sort()).toEqual(['m0', 'm1', 'm2'])
})

test('mc 恰好等于缺口：enumeration 3 要点 + 6 mc → 池零抽取，distractorKeyPointIds 为空', () => {
  const c = cardWith(6)
  const empty: DistractorPools = { sameBlock: [], crossBlock: [], neighbor: [] }
  const v = prepareOptions(c, empty, S_PROF, 'u1', 0, 1).variants[0]!
  expect(v.optionTexts).toHaveLength(9)
  expect(v.distractorKeyPointIds).toEqual([])   // 缺口 6 被 6 条 mc 恰好填满，池零消费
  expect(v.misconceptionIds).toHaveLength(6)
})
