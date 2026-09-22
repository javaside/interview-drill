import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { buildDailyPayload } from '../../../server/queue.js'
import { payloadDepsOf } from '../../../server/deps.js'

export const dynamic = 'force-dynamic'

/**
 * 今日队列端点（薄壳，§6/§4.3）。鉴权用开发期 x-user-id 头（Task 11 的 requireUserId
 * 接线后替换）。全部 IO 经 payloadDepsOf 注入 buildDailyPayload（集成测试直接调纯核）。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const payload = await buildDailyPayload(payloadDepsOf(getDb(), userId, Date.now()))
  return NextResponse.json(payload)
}
