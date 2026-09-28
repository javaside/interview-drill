import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { billingDepsOf } from '../../../../server/deps.js'
import { handleWebhook } from '../../../../server/billing.js'

export const dynamic = 'force-dynamic'

/**
 * 支付回调端点（薄壳）。**无 session 鉴权**——这是网关服务器对服务器的回调，
 * 唯一安全边界是 gateway.verifySignature(rawBody, headers)（HMAC/公钥验签，
 * 依赖原始报文，故先 request.text() 再交纯核）。履约异常（如金额不符）在此
 * 捕获记录后回 500，让网关重投；验签失败 401（handleWebhook 内拒绝履约）。
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => { headers[k] = v })
  try {
    const { status, body } = await handleWebhook(billingDepsOf(getDb()), raw, headers)
    return NextResponse.json(body, { status })
  } catch (err) {
    console.error('[billing/webhook] 履约异常（网关将重投）：', err)
    return NextResponse.json({ error: 'fulfillment failed' }, { status: 500 })
  }
}
