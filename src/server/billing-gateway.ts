/**
 * 网关选择器（§10 付费解锁 · 计划 5 · 薄壳层）。
 * Scope Check：真实 WechatPayGateway / AlipayGateway 依赖境内收款资质链条
 * （营业执照 → ICP 备案 → 公安备案 → 商户号），就绪后在此注册——实现
 * PaymentGateway 三方法即可插入，纯核与测试无需改动。
 */
import type { PaymentGateway } from './billing.js'
import type { OrderEvent } from '../lib/billing/order.js'

/**
 * 假网关（开发/测试）：验签恒真——**仅用于无真实网关的本地闭环**；
 * parseCallback 直接解析 JSON 报文 `{ orderId, amountCents, gatewayTxnId, event }`。
 */
export const fakeGateway: PaymentGateway = {
  createPayment: async () => ({ payParams: { fake: true } }),
  verifySignature: () => true,
  parseCallback: raw => {
    const b = JSON.parse(raw) as { orderId: string; amountCents: number; gatewayTxnId: string; event: OrderEvent }
    return b
  },
}

/** 网关注册表：真实 WechatPayGateway/AlipayGateway 待商户资质就绪后在此注册 */
export function gatewayOf(_name: string): PaymentGateway {
  return fakeGateway
}
