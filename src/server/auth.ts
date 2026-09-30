import { sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import GitHub from 'next-auth/providers/github'
import type { NextAuthOptions } from 'next-auth'
import type { SqlRunner } from './db/adapters.js'

/**
 * 首次登录铸造用户 + 默认设置（幂等）：按 githubId 复用同一 ULID userId。
 * 默认设置 = Asia/Shanghai / free / 空 freeBlockIds / capacity 45（§8.1）。
 * login（GitHub 用户名，可选）：首登写入，之后登录跟随改名更新；不传不动旧值
 * （后台台账展示「谁兑换」用）。
 * plan[] 唯一写者纪律不涉——这里只建 users/user_settings，不碰 card_state。
 */
export async function ensureUser(db: SqlRunner, githubId: string, login?: string): Promise<string> {
  return db.transaction(async tx => {
    const existing = await tx.execute<{ id: string }>(sql`
      select id from users where github_id = ${githubId}`)
    const found = existing.rows[0]
    if (found === undefined) {
      const id = ulid()
      await tx.execute(sql`
        insert into users (id, github_id, login) values (${id}, ${githubId}, ${login ?? null})
        on conflict (github_id) do nothing`)
    } else if (login !== undefined) {
      await tx.execute(sql`
        update users set login = ${login} where id = ${found.id}`)
    }
    // 并发下若他人已铸造：回读真实 id（自己插入被 DO NOTHING 吞掉）
    const row = await tx.execute<{ id: string }>(sql`
      select id from users where github_id = ${githubId}`)
    const userId = row.rows[0]!.id
    await tx.execute(sql`
      insert into user_settings (user_id, daily_capacity, timezone, plan, free_block_ids)
      values (${userId}, 45, 'Asia/Shanghai', 'free', '[]'::jsonb)
      on conflict (user_id) do nothing`)
    return userId
  })
}

export type SessionUser = { userId: string } | null

/**
 * 会话 → userId 的可注入内核（测试绕过真实 OAuth）：
 * 无会话 → 401 Response；有会话 → userId 字符串。
 */
export async function requireUserIdWith(
  _req: Request, getSession: (req: Request) => Promise<SessionUser>,
): Promise<string | Response> {
  const session = await getSession(_req)
  if (session === null) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    })
  }
  return session.userId
}

/**
 * NextAuth v4 配置（GitHub provider）。首次登录在 signIn 回调铸造用户，
 * session 回调把 userId 挂到 session（jwt 存 userId）。环境变量：
 * GITHUB_ID / GITHUB_SECRET / AUTH_SECRET。DB 经 getDb() 延迟取（避免测试期连库）。
 */
export function buildAuthOptions(deps: {
  db: () => SqlRunner
  githubId: string
  githubSecret: string
  secret: string
}): NextAuthOptions {
  return {
    secret: deps.secret,
    providers: [GitHub({ clientId: deps.githubId, clientSecret: deps.githubSecret })],
    // 自定义登录页（NextAuth 默认页与本站视觉断裂）：GET /api/auth/signin
    // 会 302 到 /signin 并自动透传 callbackUrl——全站现有登录链接无需改 href。
    pages: { signIn: '/signin' },
    session: { strategy: 'jwt' },
    callbacks: {
      async jwt({ token, account, profile }) {
        // 首次登录（account 存在）：按 github 数字 id 铸造/复用用户，userId 写入 token；
        // login（GitHub 用户名）一并落库，改名跟随
        if (account && profile) {
          const githubId = String((profile as { id: number | string }).id)
          const login = typeof (profile as { login?: unknown }).login === 'string'
            ? (profile as { login: string }).login
            : undefined
          token.userId = await ensureUser(deps.db(), githubId, login)
        }
        return token
      },
      session({ session, token }) {
        if (typeof token.userId === 'string') {
          ;(session as { userId?: string }).userId = token.userId
        }
        return session
      },
    },
  }
}
