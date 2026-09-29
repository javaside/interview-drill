import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { applySettingsChange, loadSettingsView } from '../../../server/settings.js'
import { requireUserId } from '../../../server/auth-config.js'
import type { LocalDate } from '../../../lib/scheduler/date.js'

export const dynamic = 'force-dynamic'

/**
 * 设置屏视图端点（薄壳，Task 11）：返回当前就绪日/容量/计划 + 块选择态。
 * 业务全程走 loadSettingsView 纯核入口（复用 loadSettings + buildBlockMap）。
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const view = await loadSettingsView({ db: getDb(), serverNowMs: Date.now() }, userId)
  return NextResponse.json(view)
}

/**
 * 设置变更端点（薄壳，§5.5 条件 2/3）。鉴权经 requireUserId（NextAuth session）。
 * 业务全程走 applySettingsChange 纯核入口（集成测试直接调，绕过 HTTP）。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const body = (await request.json()) as { readyByDate?: LocalDate | null; dailyCapacity?: number; trackId?: string | null }
  const result = await applySettingsChange(
    { db: getDb(), serverNowMs: Date.now() }, userId, body,
  )
  return NextResponse.json(result)
}
