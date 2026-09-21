import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { syncHandler } from '../../../server/sync.js'
import type { Submission } from '../../../server/types.js'
import type { DistractorPools } from '../../../lib/options/types.js'

export const dynamic = 'force-dynamic'

/**
 * 同步回放端点（薄壳，§8.3）。鉴权用开发期 x-user-id 头（Task 11 的 requireUserId 接线后替换）。
 * poolsOf 的完整装配（唯一入口 buildDistractorPools + entitlement）在 Task 7/8 接入——
 * 在此之前 route 为占位，实际回放全程走 syncHandler 的纯核（集成测试直接调 syncHandler）。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await request.json()) as { submissions?: Submission[] }
  const subs = body.submissions ?? []

  // TODO(Task 7/8)：poolsOf = cardId → buildDistractorPools(card, allCards, ent, categories)
  const poolsOf = (_cardId: string): DistractorPools => {
    throw new Error('poolsOf 尚未接入（Task 7/8）——HTTP 路径待装配唯一池入口')
  }

  const result = await syncHandler(getDb(), userId, subs, { serverNow: Date.now(), poolsOf })
  return NextResponse.json(result)
}
