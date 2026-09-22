import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { reviewHandler } from '../../../server/review.js'
import type { Submission } from '../../../server/types.js'
import type { DistractorPools } from '../../../lib/options/types.js'

export const dynamic = 'force-dynamic'

/**
 * 在线刷一张卡端点（薄壳，§6/§8.1）。鉴权用开发期 x-user-id 头（Task 11 替换）。
 * poolsOf 的唯一装配（buildDistractorPools）随 Task 11 的鉴权与内容装配一并接入——
 * 在此之前 route 为占位，判分流程全程走 reviewHandler 纯核（集成测试直接调）。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const submission = (await request.json()) as Submission
  const poolsOf = (_cardId: string): DistractorPools => {
    throw new Error('poolsOf 尚未接入（Task 11）——HTTP 路径待装配唯一池入口')
  }

  const result = await reviewHandler(getDb(), userId, submission, { serverNow: Date.now(), poolsOf })
  return NextResponse.json(result)
}
