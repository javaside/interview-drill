import { auditLibrary } from '../../../src/lib/content/audit.js'
import type { Card, KeyPoint } from '../../../src/lib/content/types.js'

function kp(id: string, over: Partial<KeyPoint> = {}): KeyPoint {
  return {
    id, text: '要点', public: false, verifiedAt: '2026-09-18',
    excludeAsDistractorFor: [], confirmedIndependentOf: [],
    source: { kind: 'official-doc', url: 'https://example.org/a', locator: 'x' },
    ...over,
  }
}

function card(id: string, blockId: string, kps: KeyPoint[], over: Partial<Card> = {}): Card {
  return {
    id, blockId, relatedBlocks: [], question: '问题？', cardType: 'enumeration',
    keyPoints: kps, detail: '', followUps: [], appliesTo: 'JDK 8+', frequency: 'mid',
    ...over,
  }
}

// 要点 id 只保证块内唯一（§7），所以同块的不同卡必须用不同前缀。
// 计划原文里 K3() 无参、两张卡在 b1 里共用 kp-1/2/3，会触发本任务刚写的
// 块内唯一性检查 —— review-1 F3 记录了这个夹具缺陷，这里按其最小修正补全。
const K3 = (p = 'kp') => [kp(`${p}-1`), kp(`${p}-2`), kp(`${p}-3`)]

test('干净的库通过审计', () => {
  const r = auditLibrary([card('c1', 'b1', K3('a')), card('c2', 'b1', K3('b'))])
  expect(r.errors).toEqual([])
})

test('卡 id 全局重复被发现', () => {
  const r = auditLibrary([card('dup', 'b1', K3()), card('dup', 'b2', K3())])
  expect(r.errors.join()).toContain('卡 id 重复')
})

test('要点 id 在同一个块内重复被发现（跨文件也能抓到）', () => {
  const a = card('c1', 'b1', [kp('kp-x'), kp('kp-2'), kp('kp-3')])
  const b = card('c2', 'b1', [kp('kp-x'), kp('kp-5'), kp('kp-6')])
  expect(auditLibrary([a, b]).errors.join()).toContain('要点 id 在块 b1 内重复')
})

test('要点 id 跨块重复是允许的', () => {
  const a = card('c1', 'b1', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  const b = card('c2', 'b2', [kp('kp-1'), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([a, b]).errors).toEqual([])
})

test('excludeAsDistractorFor 指向不存在的卡被发现', () => {
  const c = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['ghost'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([c]).errors.join()).toContain('ghost')
})

test('relatedBlocks 指向不存在的块被发现', () => {
  const c = card('c1', 'b1', K3(), { relatedBlocks: ['no-such-block'] })
  expect(auditLibrary([c]).errors.join()).toContain('no-such-block')
})

test('退役卡仍算存在，指向它的外键不算悬空', () => {
  // tombstone 的意义正在于此：卡退役后不再出题，但 review_log 和
  // excludeAsDistractorFor 里的历史引用必须继续有效（§7）
  const dead = card('c-dead', 'b1', K3('d'), { retiredAt: '2026-01-01' })
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['c-dead'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([dead, live]).errors).toEqual([])
})

test('真正不存在的卡才算悬空外键', () => {
  const live = card('c1', 'b1', [kp('kp-1', { excludeAsDistractorFor: ['never-existed'] }), kp('kp-2'), kp('kp-3')])
  expect(auditLibrary([live]).errors.join()).toContain('never-existed')
})
