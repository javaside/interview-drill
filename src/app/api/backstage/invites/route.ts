import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { listInviteCodes } from '../../../../server/db/adapters.js'
import { mintInviteCodes } from '../../../../server/invite.js'
import { isAdminUser } from '../../../../server/admin.js'
import { requireUserId } from '../../../../server/auth-config.js'
import { errorResponse } from '../../../../server/api-error.js'

export const dynamic = 'force-dynamic'

/** 鉴权：登录（NextAuth session）+ 管理员白名单（ADMIN_GITHUB_IDS）。非管理员 403。 */
async function requireAdmin(request: Request): Promise<string | Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId
  if (!(await isAdminUser({ db: getDb(), adminGithubIds: process.env.ADMIN_GITHUB_IDS ?? '' }, userId))) {
    return Response.json({ error: '无权限' }, { status: 403 })
  }
  return userId
}

/**
 * GET 邀请码台账（后台薄壳）：全部码倒序，不含明文（哈希不可逆，仅前 8 位识别）。
 */
export async function GET(request: Request): Promise<Response> {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin
  return NextResponse.json(await listInviteCodes(getDb()))
}

/**
 * POST 铸码（后台薄壳）：{ n, note } → 明文码数组（仅此一次返回，库里只有哈希）。
 * 业务与校验全在 mintInviteCodes 纯核。
 */
export async function POST(request: Request): Promise<Response> {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin
  try {
    const body = (await request.json()) as { n?: unknown; note?: unknown }
    const n = typeof body.n === 'number' ? body.n : 0
    const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null
    const codes = await mintInviteCodes({ db: getDb() }, n, note)
    return NextResponse.json({ codes })
  } catch (e) {
    return errorResponse(e)
  }
}
