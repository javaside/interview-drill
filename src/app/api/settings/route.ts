import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applySettingsChange } from '../../../server/settings.js'
import { requireUserId } from '../../../server/auth-config.js'
import type { LocalDate } from '../../../lib/scheduler/date.js'

export const dynamic = 'force-dynamic'

/**
 * 设置变更端点（薄壳，§5.5 条件 2/3）。鉴权经 requireUserId（NextAuth session）。
 * 业务全程走 applySettingsChange 纯核入口（集成测试直接调，绕过 HTTP）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json()) as { readyByDate?: LocalDate | null; dailyCapacity?: number }
  const result = await applySettingsChange(
    { db: getDb(), serverNowMs: Date.now() }, userId, body,
  )
  return NextResponse.json(result)
}
