import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import { buildBlockMap } from '../../../server/map.js'
import { mapDepsOf } from '../../../server/deps.js'
import { requireUserId } from '../../../server/auth-config.js'

export const dynamic = 'force-dynamic'

/**
 * 知识地图端点（薄壳，§4.4/§10.1）。鉴权经 requireUserId（NextAuth session）。
 * 全部 IO 经 mapDepsOf 注入 buildBlockMap（集成测试直接调纯核，绕过 HTTP）。
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const entries = await buildBlockMap(mapDepsOf(getDb(), userId))
  return NextResponse.json(entries)
}
