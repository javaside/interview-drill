/**
 * 履约纯核入口（§10 付费解锁 · 计划 5）：注入 IO 的编排层——
 * 下单（createOrder）与支付回调履约（fulfillOrder）。状态合法性/幂等/金额校验
 * 全部委托 lib/billing/order 纯核；SQL 只在 adapters。支付 SDK 绝不进此文件——
 * 网关通过 PaymentGateway 接口注入（测试给假网关，生产给真实适配器）。
 */
import { ulid } from 'ulid'
import { transition, fulfillmentDecision, assertAmount, PRICE_CENTS } from '../lib/billing/order.js'
import type { OrderEvent } from '../lib/billing/order.js'
import {
  insertOrder, loadOrder, markOrderPaid, markOrderStatus, upgradeToPaid,
} from './db/adapters.js'
import type { SqlRunner } from './db/adapters.js'

/**
 * 支付网关抽象（Scope Check：真实 WechatPayGateway/AlipayGateway 待商户资质就绪后在
 * billing-gateway.ts 注册，此处只认接口）。verifySignature 是 webhook 的唯一安全边界。
 */
export interface PaymentGateway {
  createPayment(o: { orderId: string; amountCents: number }): Promise<{ payParams: unknown }>
  verifySignature(rawBody: string, headers: Record<string, string>): boolean
  parseCallback(rawBody: string): {
    orderId: string; amountCents: number; gatewayTxnId: string; event: OrderEvent
  }
}

export type BillingDeps = { db: SqlRunner; gateway: PaymentGateway }

/**
 * 下单：铸 ULID → 落库（pending + 服务端定价 PRICE_CENTS，绝不接受调用方传金额）
 * → 网关发起支付 → 返回拉起支付所需参数。建单与发起支付是同一步（无独立 created）。
 */
export async function createOrder(
  deps: BillingDeps, userId: string, gateway: string,
): Promise<{ orderId: string; amountCents: number; payParams: unknown }> {
  const orderId = ulid()
  await insertOrder(deps.db, { id: orderId, userId, amountCents: PRICE_CENTS, gateway })
  const { payParams } = await deps.gateway.createPayment({ orderId, amountCents: PRICE_CENTS })
  return { orderId, amountCents: PRICE_CENTS, payParams }
}

/**
 * 履约（幂等键 = 订单当前状态，网关重投安全）：
 * - 无此单 → rejected；
 * - 已 paid → already（no-op，不重复升级权限）；
 * - failed/expired → rejected；
 * - pending + paid 事件 → 金额校验（不符抛错、履约中止、订单不置 paid）
 *   → 订单置 paid → 用户权限升级 → fulfilled；
 * - pending + failed/expired 事件 → 订单迁终态 → rejected。
 */
export async function fulfillOrder(
  deps: BillingDeps,
  cb: { orderId: string; amountCents: number; gatewayTxnId: string; event: OrderEvent },
): Promise<{ outcome: 'fulfilled' | 'already' | 'rejected' }> {
  const order = await loadOrder(deps.db, cb.orderId)
  if (order === null) return { outcome: 'rejected' }
  const decision = fulfillmentDecision(order.status)
  if (decision === 'already') return { outcome: 'already' }
  if (decision === 'reject') return { outcome: 'rejected' }
  if (cb.event !== 'paid') {
    await markOrderStatus(deps.db, cb.orderId, transition(order.status, cb.event))
    return { outcome: 'rejected' }
  }
  assertAmount(cb.amountCents)
  await markOrderPaid(deps.db, cb.orderId, cb.gatewayTxnId)
  await upgradeToPaid(deps.db, order.userId)
  return { outcome: 'fulfilled' }
}

/**
 * webhook 处理纯核（可测：IO 与网关全注入）。**安全边界**：这是无 session 的
 * 对外写端点，唯一防线是 verifySignature——验签失败必须拒绝履约（401）。
 * 验签通过 → 解析回调 → fulfillOrder（幂等）→ 200 + outcome。
 * 履约异常（如金额不符的 assertAmount 抛错）不在纯核吞掉——向上抛给 route
 * 捕获记录后回非 2xx，让网关重投。
 */
export async function handleWebhook(
  deps: BillingDeps, rawBody: string, headers: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  if (!deps.gateway.verifySignature(rawBody, headers)) {
    return { status: 401, body: { error: 'bad signature' } }
  }
  const cb = deps.gateway.parseCallback(rawBody)
  const { outcome } = await fulfillOrder(deps, cb)
  return { status: 200, body: { outcome } }
}
