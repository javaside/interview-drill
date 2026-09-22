import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { syncHandler } from '../../../server/sync.js'
import { poolsOfFor } from '../../../server/deps.js'
import { requireUserId } from '../../../server/auth-config.js'
import type { Submission } from '../../../server/types.js'

export const dynamic = 'force-dynamic'

/**
 * 同步回放端点（薄壳，§8.3）。鉴权经 requireUserId（NextAuth session）。
 * poolsOf 走唯一装配入口（poolsOfFor → buildDistractorPools）。
 * 回放全程走 syncHandler 纯核（集成测试直接调，绕过 HTTP）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json()) as { submissions?: Submission[] }
  const subs = body.submissions ?? []
  const db = getDb()
  const poolsOf = await poolsOfFor(db, userId)

  const result = await syncHandler(db, userId, subs, { serverNow: Date.now(), poolsOf })
  return NextResponse.json(result)
}
