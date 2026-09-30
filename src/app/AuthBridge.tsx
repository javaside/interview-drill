'use client'
import { SessionProvider } from 'next-auth/react'
import { withBase } from '../lib/base-path.js'
import type { Session } from 'next-auth'

/**
 * NextAuth 客户端桥（2026-09-30 /drill 基路径迁移）：
 * next-auth/react 的 signIn/signOut 默认请求 "/api/auth/*"——挂进 /drill 后，
 * 必须由 SessionProvider 的 basePath prop 指到 /drill/api/auth，否则打到老站 Spring。
 * session 由服务端根布局取好传入（无额外客户端 session 请求；本站无 useSession 消费者，
 * 此 Provider 的唯一职责就是下发 basePath）。
 */
export function AuthBridge(
  { session, children }: { session: Session | null; children: React.ReactNode },
): React.JSX.Element {
  return (
    <SessionProvider session={session} basePath={withBase('/api/auth')} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  )
}
