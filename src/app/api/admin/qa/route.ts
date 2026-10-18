import { getDb } from '../../../../server/db/client.js'
import { adminQaStreamHandler } from '../../../../server/admin-qa.js'
import { requireAdminUserId } from '../../../../server/admin.js'
import { errorResponse } from '../../../../server/api-error.js'

export const dynamic = 'force-dynamic'

/**
 * 管理员审题问答端点（流式）。body = { cardId, history }——
 * 与 /api/qa 同协议（QaStreamEvent SSE），差异：管理员白名单鉴权、
 * 上下文全量含答案（lib/ai/admin-qa 纯核装配）、无免费墙无每日配额。
 * 错误分界同用户版：准备段（含 provider 非 2xx）→ 400 + { error } 中文；
 * 流开始后故障带内 error 事件。x-accel-buffering: no 见 /api/qa 注释。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireAdminUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json().catch(() => null)) as { cardId?: unknown; history?: unknown } | null
  if (body === null || typeof body.cardId !== 'string' || body.cardId === '') {
    return Response.json({ error: '缺少题目参数' }, { status: 400 })
  }

  try {
    const stream = await adminQaStreamHandler({ db: getDb(), userId, cardId: body.cardId, history: body.history })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store, no-transform',
        'x-accel-buffering': 'no',
      },
    })
  } catch (e) {
    return errorResponse(e)   // 未配置/限流/连不上/题目不存在等 → 400 + { error }
  }
}
