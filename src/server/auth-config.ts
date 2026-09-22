import { getServerSession } from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import { buildAuthOptions, requireUserIdWith } from './auth.js'
import { getDb } from './db/client.js'

/**
 * 生产 NextAuth 配置：从环境变量读 GitHub 凭据与 AUTH_SECRET，DB 用 getDb()。
 * 纯核 buildAuthOptions 在 auth.ts（可注入、可测），此处只做生产接线。
 */
export const authOptions: NextAuthOptions = buildAuthOptions({
  db: getDb,
  githubId: process.env.GITHUB_ID ?? '',
  githubSecret: process.env.GITHUB_SECRET ?? '',
  secret: process.env.AUTH_SECRET ?? '',
})

/**
 * 生产鉴权：从 NextAuth session 取 userId；无会话 → 401 Response。
 * route handler 用法：`const uid = await requireUserId(req); if (uid instanceof Response) return uid`
 */
export function requireUserId(req: Request): Promise<string | Response> {
  return requireUserIdWith(req, async () => {
    const session = await getServerSession(authOptions)
    const userId = (session as { userId?: string } | null)?.userId
    return userId ? { userId } : null
  })
}
