import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { billingDepsOf } from '../../../../server/deps.js'
import { createOrder } from '../../../../server/billing.js'
import { requireUserId } from '../../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * 下单端点（薄壳，§10 付费解锁）。鉴权经 requireUserId（NextAuth session）。
 * 业务全程走 createOrder 纯核入口：金额由服务端 PASS_PRICE_CENTS 决定，
 * 请求体不接收任何金额参数（绝不信任客户端定价）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const order = await createOrder(billingDepsOf(getDb()), userId, 'fake')
  return NextResponse.json(order)
}
