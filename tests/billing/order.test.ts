import { transition, fulfillmentDecision, assertAmount, PASS_PRICE_CENTS, PASS_DAYS } from '../../src/lib/billing/order.js'

test('合法迁移：pending → paid/failed/expired', () => {
  expect(transition('pending', 'paid')).toBe('paid')
  expect(transition('pending', 'failed')).toBe('failed')
  expect(transition('pending', 'expired')).toBe('expired')
})

test('幂等：已 paid 再收 paid 事件 → 仍 paid（no-op，网关重投）', () => {
  expect(transition('paid', 'paid')).toBe('paid')
})

test('非法迁移：已 paid 收 failed → 抛错（状态冲突）', () => {
  expect(() => transition('paid', 'failed')).toThrow()
})

test('fulfillmentDecision：pending=fulfill、paid=already、failed/expired=reject', () => {
  expect(fulfillmentDecision('pending')).toBe('fulfill')
  expect(fulfillmentDecision('paid')).toBe('already')
  expect(fulfillmentDecision('failed')).toBe('reject')
  expect(fulfillmentDecision('expired')).toBe('reject')
})

test('assertAmount：金额不等于 PASS_PRICE_CENTS 抛错', () => {
  expect(() => assertAmount(PASS_PRICE_CENTS)).not.toThrow()
  expect(() => assertAmount(1)).toThrow()
})

test('定价与时长常量：¥29 / 30 天（2026-10-02 拍板，取代 129 元买断）', () => {
  expect(PASS_PRICE_CENTS).toBe(2900)
  expect(PASS_DAYS).toBe(30)
  // 原买断价的换算关系：三张 ≈ 129 元（定价理由，改动时会有意破坏这条）
  expect(PASS_PRICE_CENTS * 3).toBeGreaterThan(12900 * 0.6)
  expect(PASS_PRICE_CENTS * 3).toBeLessThan(12900)
})
