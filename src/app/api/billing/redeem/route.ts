import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { redeemInvite } from '../../../../server/invite.js'
import { requireUserId } from '../../../../server/auth-config.js'
import { errorResponse } from '../../../../server/api-error.js'

export const dynamic = 'force-dynamic'

/**
 * 兑换邀请码（薄壳，§10.1 /upgrade 页的唯一可用解锁通道）。
 * 鉴权经 requireUserId；业务全在 redeemInvite 纯核入口：
 * 无效/已用 → 400 {error 中文}（errorResponse），成功 → { outcome }。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId
  try {
    const body = (await request.json()) as { code?: unknown }
    const code = typeof body.code === 'string' ? body.code : ''
    const outcome = await redeemInvite({ db: getDb() }, userId, code)
    return NextResponse.json({ outcome })
  } catch (e) {
    return errorResponse(e)
  }
}
