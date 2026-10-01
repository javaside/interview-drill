import { getDb } from '../../../server/db/client.js'
import { qaStreamHandler } from '../../../server/qa.js'
import { errorResponse } from '../../../server/api-error.js'
import { requireUserId } from '../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * learn 页 / 刷题页 AI 问答端点（流式）。body = { cardId, history }——
 * 上下文只含该卡（纯核保证）+ 客户端携带的该卡历史；服务端不落库。
 *
 * 错误分界（见 server/qa 的注释）：业务拒绝与「连不上 / provider 非 2xx」都发生在
 * 流开始之前，照旧 400 + { error } 中文（客户端既有错误链路不变）；流一旦开始，
 * 中途故障只能走带内 error 事件。
 * x-accel-buffering: no —— 生产经 nginx 反代，不关缓冲会把整个流攒成一坨再吐。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json().catch(() => null)) as
    { cardId?: unknown; history?: unknown; options?: unknown; attempt?: unknown } | null
  if (body === null || typeof body.cardId !== 'string' || body.cardId === '') {
    return Response.json({ error: '缺少题目参数' }, { status: 400 })
  }

  try {
    const stream = await qaStreamHandler({
      db: getDb(), userId, cardId: body.cardId, history: body.history,
      options: body.options, attempt: body.attempt,
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store, no-transform',
        'x-accel-buffering': 'no',
      },
    })
  } catch (e) {
    return errorResponse(e)   // 未配置/未解锁/限流/连不上等 → 400 + { error }
  }
}
