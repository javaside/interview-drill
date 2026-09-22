import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { reviewHandler } from '../../../server/review.js'
import { poolsOfFor } from '../../../server/deps.js'
import { requireUserId } from '../../../server/auth-config.js'
import type { Submission } from '../../../server/types.js'

export const dynamic = 'force-dynamic'

/**
 * 在线刷一张卡端点（薄壳，§6/§8.1）。鉴权经 requireUserId（NextAuth session）。
 * poolsOf 走唯一装配入口（poolsOfFor → buildDistractorPools）。
 * 判分流程全程走 reviewHandler 纯核（集成测试直接调，绕过 HTTP）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const submission = (await request.json()) as Submission
  const db = getDb()
  const poolsOf = await poolsOfFor(db, userId)

  const result = await reviewHandler(db, userId, submission, { serverNow: Date.now(), poolsOf })
  return NextResponse.json(result)
}
