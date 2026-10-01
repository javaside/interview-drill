import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { qaHandler } from '../../../server/qa.js'
import { errorResponse } from '../../../server/api-error.js'
import { requireUserId } from '../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * learn 页 AI 问答端点（薄壳，§6/§8.1）。body = { cardId, history }——
 * 上下文只含该卡（纯核保证）+ 客户端携带的该卡历史；服务端不落库。
 * 业务拒绝（未配置/未解锁/限流/题目不存在）→ 400 + { error } 中文消息。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json().catch(() => null)) as { cardId?: unknown; history?: unknown } | null
  if (body === null || typeof body.cardId !== 'string' || body.cardId === '') {
    return NextResponse.json({ error: '缺少题目参数' }, { status: 400 })
  }

  try {
    const result = await qaHandler({ db: getDb(), userId, cardId: body.cardId, history: body.history })
    return NextResponse.json(result)
  } catch (e) {
    return errorResponse(e)   // 未配置/未解锁/限流等业务拒绝 → 400 + { error }
  }
}
