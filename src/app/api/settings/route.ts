import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applySettingsChange } from '../../../server/settings.js'
import type { LocalDate } from '../../../lib/scheduler/date.js'

export const dynamic = 'force-dynamic'

/**
 * 设置变更端点（薄壳，§5.5 条件 2/3）。鉴权用开发期 x-user-id 头（Task 11 的
 * requireUserId 接线后替换）。业务全程走 applySettingsChange 纯核入口（集成测试直接调）。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await request.json()) as { readyByDate?: LocalDate | null; dailyCapacity?: number }
  const result = await applySettingsChange(
    { db: getDb(), serverNowMs: Date.now() }, userId, body,
  )
  return NextResponse.json(result)
}
