import { transition, fulfillmentDecision, assertAmount, PRICE_CENTS } from '../../src/lib/billing/order.js'

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

test('assertAmount：金额不等于 PRICE_CENTS 抛错', () => {
  expect(() => assertAmount(PRICE_CENTS)).not.toThrow()
  expect(() => assertAmount(1)).toThrow()
})
