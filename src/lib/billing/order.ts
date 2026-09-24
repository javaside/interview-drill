/**
 * 订单状态机纯核（§10 付费解锁 · 计划 5）。零 IO 纯函数：
 * 状态迁移合法性 + 履约幂等决策 + 服务端金额校验。支付 SDK 绝不进此文件。
 */

/** 下单即 pending（建单与发起支付同一步，无独立 created） */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

/** 网关回调携带的事件（不含 pending——pending 是建单初态，非事件） */
export type OrderEvent = 'paid' | 'failed' | 'expired'

/** 占位价格，对标 129 元一次性买断（§10.1「价格上线前再定」——上线前替换） */
export const PRICE_CENTS = 12900

/** 终态：再收事件只允许同类（幂等 no-op），异类事件是状态冲突 */
const TERMINAL: Record<OrderEvent, OrderStatus> = { paid: 'paid', failed: 'failed', expired: 'expired' }

/**
 * 状态迁移：
 * - `pending` + 任一事件 → 对应终态；
 * - 终态 + **同类**事件 → 原状态（no-op，网关重投幂等）；
 * - 终态 + **异类**事件 → 抛错（状态冲突，如已 paid 收 failed）。
 */
export function transition(current: OrderStatus, event: OrderEvent): OrderStatus {
  if (current === 'pending') return TERMINAL[event]
  if (current === TERMINAL[event]) return current   // 同类事件幂等 no-op
  throw new Error(`非法订单迁移：${current} 收到 ${event} 事件（状态冲突）`)
}

/**
 * 履约决策（幂等键 = 订单当前状态）：
 * - `pending` → `fulfill`（首次履约）
 * - `paid` → `already`（已履约，重复回调 no-op）
 * - `failed | expired` → `reject`（不可履约）
 */
export function fulfillmentDecision(current: OrderStatus): 'fulfill' | 'already' | 'reject' {
  if (current === 'pending') return 'fulfill'
  if (current === 'paid') return 'already'
  return 'reject'
}

/** 服务端金额校验：回调金额必须等于订单价，绝不信任客户端/回调传入的任意金额 */
export function assertAmount(cents: number): void {
  if (cents !== PRICE_CENTS) throw new Error(`金额不符：期望 ${PRICE_CENTS}，实收 ${cents}`)
}
