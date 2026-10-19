import { checkIdLock } from '../../../src/lib/content/audit.js'
import type { Card, Misconception } from '../../../src/lib/content/types.js'

function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id, blockId: 'b1', relatedBlocks: [], question: '问题？', cardType: 'atomic',
    keyPoints: [{
      id: 'kp-1', text: '要点', public: false, verifiedAt: '2026-09-18',
      excludeAsDistractorFor: [], confirmedIndependentOf: [],
      source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
    }],
    detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid', ...over,
  }
}

test('新增 id 允许', () => {
  expect(checkIdLock([card('c1'), card('c2')], ['card:c1'])).toEqual([])
})

test('卡 id 凭空消失被拦下', () => {
  const errs = checkIdLock([card('c1')], ['card:c1', 'card:c2'])
  expect(errs.join()).toContain('c2')
  expect(errs.join()).toContain('消失')
})

test('退役卡仍在库里，不算消失', () => {
  expect(checkIdLock([card('c1'), card('c2', { retiredAt: '2026-09-18' })], ['card:c1', 'card:c2'])).toEqual([])
})

test('改名时写了 movedFrom 就放行', () => {
  expect(checkIdLock([card('c1'), card('c2-new', { movedFrom: 'c2' })], ['card:c1', 'card:c2'])).toEqual([])
})

test('改名但没写 movedFrom 被拦下', () => {
  expect(checkIdLock([card('c1'), card('c2-new')], ['card:c1', 'card:c2']).join()).toContain('c2')
})

test('要点 id 消失同样被拦下 —— review_log.distractorIds 引用的是它', () => {
  const errs = checkIdLock([card('c1')], ['card:c1', 'kp:b1/kp-gone'])
  expect(errs.join()).toContain('kp-gone')
})

test('要点 id 还在则放行', () => {
  expect(checkIdLock([card('c1')], ['card:c1', 'kp:b1/kp-1'])).toEqual([])
})

test('要点 id 的作用域含块前缀 —— 不同块的同名要点互不顶替', () => {
  const a = card('c1')                          // b1/kp-1
  const b = card('c2', { blockId: 'b2' })       // b2/kp-1
  expect(checkIdLock([a, b], ['card:c1', 'card:c2', 'kp:b1/kp-1', 'kp:b2/kp-1'])).toEqual([])
  // 只剩 b2 那张时，b1/kp-1 仍应被判为消失
  expect(checkIdLock([b], ['card:c2', 'kp:b1/kp-1']).join()).toContain('b1/kp-1')
})

test('要点写了 movedFrom 就放行，报错文案给出出路', () => {
  const moved = card('c1')
  moved.keyPoints[0]!.id = 'kp-new'
  moved.keyPoints[0]!.movedFrom = 'kp-1'
  expect(checkIdLock([moved], ['card:c1', 'kp:b1/kp-1'])).toEqual([])
  const errs = checkIdLock([card('c1')], ['card:c1', 'kp:b1/kp-gone'])
  expect(errs.join()).toContain('movedFrom')
  expect(errs.join()).toContain('retiredAt')
})

test('无法识别的 lockfile 行被报出，而不是静默忽略', () => {
  expect(checkIdLock([card('c1')], ['垃圾行']).join()).toContain('无法识别')
})

// ---- mc: 行（专属错误选项）----

const mc = (id: string, over: Partial<Misconception> = {}): Misconception =>
  ({ id, text: `错误说法 ${id}`, why: `误解：${id}`, ...over })

test('mc id 相对上一次 main 消失被拦下 —— 报错文案给出 movedFrom / retiredAt 两条出路', () => {
  const errs = checkIdLock([card('c1')], ['card:c1', 'mc:m-1'])
  expect(errs.join()).toContain('m-1')
  expect(errs.join()).toContain('消失')
  expect(errs.join()).toContain('movedFrom')
  expect(errs.join()).toContain('retiredAt')
})

test('mc id 认活（含退役）与 movedFrom —— 行内无块前缀，全库唯一', () => {
  // 还在源里（活）→ 放行
  const live = card('c1', { misconceptions: [mc('m-1')] })
  expect(checkIdLock([live], ['card:c1', 'mc:m-1'])).toEqual([])
  // 退役 mc 仍在库里，不算消失（tombstone 供 review_log 复现）
  const retired = card('c1', { misconceptions: [mc('m-1', { retiredAt: '2026-10-01' })] })
  expect(checkIdLock([retired], ['card:c1', 'mc:m-1'])).toEqual([])
  // 源里 mc id 改为 m-2 且 movedFrom: m-1 → 放行
  const renamed = card('c1', { misconceptions: [mc('m-2', { movedFrom: 'm-1' })] })
  expect(checkIdLock([renamed], ['card:c1', 'mc:m-1'])).toEqual([])
  // 不同块的两卡各配 mc：mc id 全库唯一，任何一张卡上的 m-1 都能让 mc:m-1 行通过
  const a = card('c1', { misconceptions: [mc('m-1')] })
  const b = card('c2', { blockId: 'b2', misconceptions: [mc('m-9')] })
  expect(checkIdLock([a, b], ['card:c1', 'card:c2', 'mc:m-1', 'mc:m-9'])).toEqual([])
})
