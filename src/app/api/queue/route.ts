import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { buildDailyPayload } from '../../../server/queue.js'
import { payloadDepsOf } from '../../../server/deps.js'
import { requireUserId } from '../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * 今日队列端点（薄壳，§6/§4.3）。鉴权经 requireUserId（NextAuth session）。
 * 全部 IO 经 payloadDepsOf 注入 buildDailyPayload（集成测试直接调纯核，绕过 HTTP）。
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const payload = await buildDailyPayload(payloadDepsOf(getDb(), userId, Date.now()))
  return NextResponse.json(payload)
}
