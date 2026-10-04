import {
  JUDGE_VERSION, checkExclusion, emptyLedger, enumerateCandidatePairs, fingerprintOf,
  pairKey, parseLedger, pendingPairs, poolMarginsOf, projectExclusions, serializeLedger,
  verdictStatsOf,
} from '../../../src/lib/content/exclusion.js'
import type { ExclusionLedger } from '../../../src/lib/content/exclusion.js'
import { MIN_BLOCK_POOL } from '../../../src/lib/content/audit.js'
import type { Card, CardType, KeyPoint } from '../../../src/lib/content/types.js'

const URL = 'https://github.com/openjdk/jdk/blob/master/A.java'

function kp(id: string, text: string, over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id, text, public: false, verifiedAt: '2026-09-28',
    excludeAsDistractorFor: [], confirmedIndependentOf: [],
    source: { kind: 'source-code', url: URL, locator: 'x' },
    ...over,
  }
}
function card(
  id: string, blockId: string, question: string, kps: KeyPoint[],
  cardType: CardType = 'enumeration', over: Partial<Card> = {},
): Card {
  return {
    id, blockId, relatedBlocks: [], question, cardType,
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
    ...over,
  }
}

/** b1/b2 同大类 cat-a，b3 相邻大类 cat-b —— 三层都能落地 */
const CATS = new Map([['b1', 'cat-a'], ['b2', 'cat-a'], ['b3', 'cat-b']])

/**
 * t1(b1) t2(b2) o1(b3) + 一张 sequence（b1）+ 一张退役卡。
 * 候选对共 11 组：同块 1（t1←s1）/ 跨块 4 / 相邻 6。
 */
function fixture(): Card[] {
  return [
    card('t1', 'b1', '问题一？', [kp('t1a', '要点甲')]),
    card('t2', 'b2', '问题二？', [kp('t2a', '要点乙'), kp('t2b', '要点丙'), kp('t2-retired', '退役要点', { retiredAt: '2026-09-28' })]),
    card('o1', 'b3', '问题三？', [kp('o1a', '要点丁')]),
    card('s1', 'b1', '步骤题？', [kp('s1a', '步骤一', { order: 1 })], 'sequence'),
    card('r1', 'b1', '退役的题？', [kp('r1a', '要点戊')], 'enumeration', { retiredAt: '2026-09-28' }),
  ]
}

const layersOf = (cards: Card[]) => {
  const out: Record<string, number> = {}
  for (const p of enumerateCandidatePairs(cards, CATS)) out[p.layer] = (out[p.layer] ?? 0) + 1
  return out
}

// ---- 枚举 ----

test('三层枚举：同块 / 同大类跨块 / 相邻大类各归其位', () => {
  expect(layersOf(fixture())).toEqual({ sameBlock: 1, crossBlock: 4, neighbor: 6 })
})

test('目标侧排除 sequence，但 sequence 卡的要点照旧进池（只在目标题一侧排除）', () => {
  const pairs = enumerateCandidatePairs(fixture(), CATS)
  expect(pairs.some(p => p.targetCardId === 's1')).toBe(false)             // 不作为目标题
  expect(pairs.some(p => p.ownerCardId === 's1' && p.targetCardId === 't1')).toBe(true)
})

test('退役卡不出题、退役要点不进候选；枚举不按 public 剪枝（付费抽全量池）', () => {
  const pairs = enumerateCandidatePairs(fixture(), CATS)
  expect(pairs.some(p => p.targetCardId === 'r1')).toBe(false)
  expect(pairs.some(p => p.ownerCardId === 'r1')).toBe(false)
  expect(pairs.some(p => p.keyPointId === 't2-retired')).toBe(false)
  // 夹具要点全是 public:false，仍然全部被枚举 —— 剪枝会漏掉 84% 的候选
  expect(pairs).toHaveLength(11)
})

test('枚举结果与卡文件行序无关（账本 diff 必须稳定）', () => {
  const a = enumerateCandidatePairs(fixture(), CATS).map(pairKey)
  const shuffled = [...fixture()].reverse()
  const b = enumerateCandidatePairs(shuffled, CATS).map(pairKey)
  expect(b).toEqual(a)
  expect([...a].sort()).toEqual(a)   // 自身按键升序
})

test('与目标卡要点撞 id 的候选不进枚举（运行时会被 ownIds 静默剔除）', () => {
  const cards = [
    card('t1', 'b1', '问题一？', [kp('kp-x', '要点甲')]),
    card('t2', 'b2', '问题二？', [kp('kp-x', '别的卡的同一个 id')]),
  ]
  expect(enumerateCandidatePairs(cards, CATS).some(p => p.ownerCardId === 't2')).toBe(false)
})

test('指纹只取决于判定的两个输入（候选文本 + 目标题干）', () => {
  expect(fingerprintOf('甲', '乙')).toBe(fingerprintOf('甲', '乙'))
  expect(fingerprintOf('甲', '乙')).not.toBe(fingerprintOf('甲', '乙改'))
  expect(fingerprintOf('甲', '乙')).not.toBe(fingerprintOf('甲改', '乙'))
})

// ---- 账本 ----

function ledgerFor(cards: Card[], verdict: (p: ReturnType<typeof enumerateCandidatePairs>[number]) => 'yes' | 'no'): ExclusionLedger {
  const ledger = emptyLedger({ provider: 'deepseek', model: 'deepseek-flash', generatedAt: '2026-10-04T12:00:00Z' })
  for (const p of enumerateCandidatePairs(cards, CATS)) {
    ledger.entries.set(pairKey(p), { verdict: verdict(p), fingerprint: fingerprintOf(p.keyPointText, p.targetQuestion) })
  }
  return ledger
}

test('账本序列化 → 解析往返一致，头部与行序都稳定', () => {
  const ledger = ledgerFor(fixture(), () => 'no')
  const text = serializeLedger(ledger)
  expect(text.startsWith(`# judge=${JUDGE_VERSION} provider=deepseek model=deepseek-flash generated=2026-10-04T12:00:00Z`)).toBe(true)
  const back = parseLedger(text)
  expect(back.ok).toBe(true)
  if (!back.ok) return
  expect(serializeLedger(back.ledger)).toBe(text)
  expect(back.ledger.entries.size).toBe(11)
})

test('账本格式错误直接报错，不静默跳过', () => {
  const header = `# judge=${JUDGE_VERSION} provider=deepseek model=m generated=t`
  const bad = [
    [`${header}\nc1/k1|t1|yes`, '字段数不是 4'],
    [`${header}\nc1/k1|t1|maybe|abc12345`, '判定只能是 yes 或 no'],
    [`${header}\nc1/k1|t1|yes|`, '缺少内容指纹'],
    [`${header}\nc1|t1|yes|abc12345`, '主键格式无法识别'],
    [`${header}\nnot-a-header`, '字段数不是 4'],
    [`c1/k1|t1|yes|abc12345`, '缺少头部'],
  ] as const
  for (const [text, needle] of bad) {
    const r = parseLedger(text)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.join()).toContain(needle)
  }
})

test('同一组合在账本里出现两次 → 报错（判定状态必须唯一）', () => {
  const header = `# judge=${JUDGE_VERSION} provider=d model=m generated=t`
  const r = parseLedger(`${header}\nc1/k1|t1|yes|aaaaaaaa\nc1/k1|t1|no|bbbbbbbb`)
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.issues.join()).toContain('组合重复出现')
})

test('pendingPairs：判过且指纹未变 → 跳过；指纹过期或没判 → 待判', () => {
  const cards = fixture()
  const pairs = enumerateCandidatePairs(cards, CATS)
  const ledger = ledgerFor(cards, () => 'no')
  expect(pendingPairs(pairs, ledger)).toHaveLength(0)

  // 改题干 → 该目标题的全部判定失效
  const edited = fixture()
  edited.find(c => c.id === 't1')!.question = '问题一改？'
  const editedPairs = enumerateCandidatePairs(edited, CATS)
  const stale = pendingPairs(editedPairs, ledger)
  expect(stale.every(p => p.targetCardId === 't1' || p.ownerCardId === 't1')).toBe(true)
  expect(stale.length).toBeGreaterThan(0)

  // 删掉一条判定 → 只有它待判
  ledger.entries.delete(pairKey(pairs[0]!))
  expect(pendingPairs(pairs, ledger).map(pairKey)).toEqual([pairKey(pairs[0]!)])
})

// ---- 投影 ----

test('投影只取 yes，且按键取到具体要点；悬空条目跳过', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, p => (p.ownerCardId === 't2' && p.targetCardId === 't1' ? 'yes' : 'no'))
  ledger.entries.set('ghost/gone|t1', { verdict: 'yes', fingerprint: 'deadbeef' })

  const project = projectExclusions(cards, ledger)
  expect([...(project.get('t2')?.get('t2a') ?? [])]).toEqual(['t1'])
  expect(project.get('t1')).toBeUndefined()          // t1 只有 no 判定
  expect(projectExclusions(cards, ledger).size).toBe(1)
})

// ---- 池余量 ----

test('池余量：三层各自可数，免费口径只认 public，扣除投影后余量下降', () => {
  const cards = [
    card('c1', 'b1', '题一？', [kp('c1a', '要点一')]),
    card('c2', 'b1', '题二？', [kp('c2a', '同块要点', { public: true })]),
    card('c3', 'b2', '题三？', [kp('c3a', '跨块私有点'), kp('c3b', '跨块公开点', { public: true })]),
    card('c4', 'b3', '题四？', [kp('c4a', '相邻私有点'), kp('c4b', '相邻公开点', { public: true })]),
  ]
  const before = poolMarginsOf(cards, CATS).find(m => m.cardId === 'c1')!
  expect(before.sameBlock).toBe(1)
  expect(before.crossFull).toBe(2)
  expect(before.crossPublic).toBe(1)
  expect(before.neighborFull).toBe(2)
  expect(before.neighborPublic).toBe(1)
  expect(before.need).toBe(MIN_BLOCK_POOL.enumeration)

  // 投影把跨块/相邻的公开点都排除掉 → 两个口径同时缩水
  const projected = new Map([['c3', new Map([['c3a', ['c1']], ['c3b', ['c1']]])], ['c4', new Map([['c4a', ['c1']], ['c4b', ['c1']]])]])
  const after = poolMarginsOf(cards, CATS, projected).find(m => m.cardId === 'c1')!
  expect(after.crossFull).toBe(0)
  expect(after.crossPublic).toBe(0)
  expect(after.neighborFull).toBe(0)
  expect(after.neighborPublic).toBe(0)
  expect(after.sameBlock).toBe(1)   // 同块没有登记 → 不变
})

// ---- 闸门 ----

test('没有账本 → 只警告不报错（否则首次上线就把已有内容染红）', () => {
  const r = checkExclusion(fixture(), CATS, undefined)
  expect(r.errors).toEqual([])
  expect(r.warnings.join()).toContain('尚无互斥判定账本')
  expect(r.warnings.join()).toContain('11 组')
})

test('分层推进中途：没扫过的层照旧报错，另给一条「尚未扫过」的警告说明红的原因', () => {
  const cards = fixture()
  const pairs = enumerateCandidatePairs(cards, CATS)
  const ledger = emptyLedger({ generatedAt: 't' })
  // 只判同块层（--layer same）
  for (const p of pairs) {
    if (p.layer === 'sameBlock') {
      ledger.entries.set(pairKey(p), { verdict: 'no', fingerprint: fingerprintOf(p.keyPointText, p.targetQuestion) })
    }
  }
  const r = checkExclusion(cards, CATS, ledger)
  // 不为「整层没判」开静默口子：该红的还是红，只是另有一条警告解释原因
  expect(r.errors.join()).toContain('未判定')
  expect(r.errors.join()).toContain('t2a')
  expect(r.warnings.join()).toContain('crossBlock 层尚未扫过')
  expect(r.warnings.join()).toContain('neighbor 层尚未扫过')
})

test('扫过的层里出现新组合 → 报错并指名是哪条要点 × 哪道题', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, () => 'no')
  // 加一张新卡（跨块/相邻层的组合都变新）
  cards.push(card('t9', 'b2', '新题？', [kp('t9a', '新要点')]))
  const r = checkExclusion(cards, CATS, ledger)
  expect(r.errors.join()).toContain('未判定')
  expect(r.errors.join()).toContain('t9a')
  expect(r.errors.join()).toContain('《问题一？》')
})

test('内容改过 → 该判定报「已过期」并指名', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, () => 'no')
  cards.find(c => c.id === 't1')!.question = '问题一改？'
  const r = checkExclusion(cards, CATS, ledger)
  expect(r.errors.join()).toContain('判定已过期')
  expect(r.errors.join()).toContain('t2a')            // 目标题变了 → 指它的候选对全部失效
  expect(r.errors.join()).toContain('《问题一改？》')
})

test('判据版本变化 → 整体失效，且 pendingPairs 必须全量待判（否则修复路径是死路）', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, () => 'no')
  const pairs = enumerateCandidatePairs(cards, CATS)
  expect(pendingPairs(pairs, ledger)).toHaveLength(0)      // 版本一致时都已判
  ledger.header.judgeVersion = 'v0'
  // 闸门说「整体失效」时，--judge 必须真的有事可做：否则它的修复指引指向一条空转命令，
  // 唯一出路只剩手改账本（这是评审实测出来的死锁）
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('整体失效')
  expect(pendingPairs(pairs, ledger)).toHaveLength(pairs.length)
})

test('判据版本变化 → 整体失效', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, () => 'no')
  ledger.header.judgeVersion = 'v0'
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('整体失效')
})

test('卡文件与账本投影不一致 → 报错（双向：多登记与少登记都拦）', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, p => (p.keyPointId === 't2a' && p.targetCardId === 't1' ? 'yes' : 'no'))

  // 少登记：账本说 yes，卡文件空着
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('卡文件与账本不一致')

  // 多登记：卡文件手写了一条账本没有的
  const extra = fixture()
  extra.find(c => c.id === 't1')!.keyPoints[0]!.excludeAsDistractorFor = ['o1']
  expect(checkExclusion(extra, CATS, ledger).errors.join()).toContain('卡文件与账本不一致')
})

test('项目完全一致时闸门全绿', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, p => (p.keyPointId === 't2a' && p.targetCardId === 't1' ? 'yes' : 'no'))
  cards.find(c => c.id === 't2')!.keyPoints.find(k => k.id === 't2a')!.excludeAsDistractorFor = ['t1']
  const r = checkExclusion(cards, CATS, ledger)
  expect(r.errors).toEqual([])
  expect(r.warnings).toEqual([])
})

test('卡/要点 id 含账本保留字符 → 闸门报错（写得出读不回，发现时机是花完钱之后）', () => {
  const cards = fixture()
  const bad = cards.map(c => (c.id === 't1' ? { ...c, keyPoints: c.keyPoints.map(k => ({ ...k, id: 'kp|1' })) } : c))
  expect(checkExclusion(bad, CATS, ledgerFor(cards, () => 'no')).errors.join()).toContain('保留字符')

  const hashId = cards.map(c => (c.id === 't2' ? { ...c, id: '#t2' } : c))
  expect(checkExclusion(hashId, CATS, ledgerFor(cards, () => 'no')).errors.join()).toContain('保留字符')
})

test('退役卡不参与投影一致性检查（运行时根本不读它，别逼着改写它的文件）', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, p => (p.keyPointId === 't2a' && p.targetCardId === 't1' ? 'yes' : 'no'))
  // 卡文件空着 → 活跃卡会报不一致
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('卡文件与账本不一致')
  // 把 owner 卡整体退役 → 这条不再算漂移
  const retired = cards.map(c => (c.id === 't2' ? { ...c, retiredAt: '2026-10-04' } : c))
  const r = checkExclusion(retired, CATS, ledger)
  expect(r.errors.join()).not.toContain('卡文件与账本不一致')
})

test('账本里的悬空条目 → 警告（内容删改后组合消失，不改变出题结果）', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, () => 'no')
  ledger.entries.set('gone/kp|t1', { verdict: 'yes', fingerprint: 'deadbeef' })
  const r = checkExclusion(cards, CATS, ledger)
  expect(r.warnings.join()).toContain('1 条已不再对应任何候选组合')
})

test('「是」率统计：只算指纹未过期的判定（漂移指标）', () => {
  const cards = fixture()
  const ledger = ledgerFor(cards, p => (p.layer === 'neighbor' ? 'yes' : 'no'))
  const stats = verdictStatsOf(enumerateCandidatePairs(cards, CATS), ledger)
  expect(stats.map(s => [s.layer, s.total, s.judged, s.yes])).toEqual([
    ['sameBlock', 1, 1, 0],
    ['crossBlock', 4, 4, 0],
    ['neighbor', 6, 6, 6],
  ])
})
