import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applyBlockSelection } from '../../../server/settings.js'
import { errorResponse } from '../../../server/api-error.js'
import { requireUserId } from '../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * 块集变更端点（薄壳，§5.5 条件 4）。鉴权经 requireUserId（NextAuth session）。
 * 业务全程走 applyBlockSelection 纯核入口（集成测试直接调，绕过 HTTP）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json()) as { blockIds?: string[] }
  try {
    const result = await applyBlockSelection(
      { db: getDb(), serverNowMs: Date.now() }, userId, body.blockIds ?? [],
    )
    return NextResponse.json(result)
  } catch (e) {
    return errorResponse(e)   // 免费墙/块不存在等业务拒绝 → 400 + { error }
  }
}
