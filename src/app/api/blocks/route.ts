import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applyBlockSelection } from '../../../server/settings.js'

export const dynamic = 'force-dynamic'

/**
 * 块集变更端点（薄壳，§5.5 条件 4）。鉴权用开发期 x-user-id 头（Task 11 的
 * requireUserId 接线后替换）。业务全程走 applyBlockSelection 纯核入口（集成测试直接调）。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await request.json()) as { blockIds?: string[] }
  const result = await applyBlockSelection(
    { db: getDb(), serverNowMs: Date.now() }, userId, body.blockIds ?? [],
  )
  return NextResponse.json(result)
}
