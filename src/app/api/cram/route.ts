import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applyCram } from '../../../server/cram.js'
import { errorResponse } from '../../../server/api-error.js'
import { requireUserId } from '../../../server/auth-config.js'
import type { LocalDate } from '../../../lib/scheduler/date.js'

export const dynamic = 'force-dynamic'

/**
 * 临时加密端点（§5.8 薄壳）。鉴权经 requireUserId。
 * 业务全程走 applyCram 纯核入口（集成测试直接调，绕过 HTTP）：
 * 选中块 s 最低的卡在面试前重铺冲刺，其余块计划逐字节不变。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json()) as { examDate: LocalDate; blockIds: string[] }
  try {
    const result = await applyCram({ db: getDb(), serverNowMs: Date.now() }, userId, body)
    return NextResponse.json(result)
  } catch (e) {
    return errorResponse(e)   // 块未解锁等业务拒绝 → 400 + { error }
  }
}
