import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from '../server/auth-config.js'
import { getDb } from '../server/db/client.js'
import { loadSettings, accessStateOfRow, daysLeftOf } from '../server/db/adapters.js'
import { NavBar } from './NavBar.js'
import { AuthBridge } from './AuthBridge.js'
// 标签页/搜索结果里要能认出「是干嘛的」：品牌 + 品类词，别只留品牌名
export const metadata = { title: '划重点 · 后端面试题' }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 登录态从服务端传给 NavBar；完整 session 传给 AuthBridge（SessionProvider）——
  // 其唯一职责是给 next-auth/react 的 signIn/signOut 下发 /drill 基路径（见 AuthBridge 注释）。
  // 档位（free/grace/paid）供 NavBar 的常驻入口：free「解锁」/ grace「续期」/
  // paid「剩 N 天」，三者都指向 /upgrade。剩余天数取唯一实现 daysLeftOf。
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  const nowMs = Date.now()
  const row = userId === undefined ? null : await loadSettings(getDb(), userId, nowMs)
  const access = row === null ? null : accessStateOfRow(row, nowMs)
  const daysLeft = row === null ? null : daysLeftOf(row, nowMs)
  return (
    <html lang="zh-CN">
      <body className="grain flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          跳到主要内容
        </a>
        <AuthBridge session={session}>
          <NavBar authed={userId !== undefined} access={access} daysLeft={daysLeft} />
          <main id="main" className="relative z-[2] flex-1">
            {children}
          </main>
          <footer className="relative z-[2] border-t border-paper-line/70 bg-paper-deep/60">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-6 text-xs text-paper-muted">
              {/* 「关于」已移到顶部导航（见 NavBar）：这里不再重复放同一个入口 */}
              <span className="font-bold tracking-wide">划重点</span>
              <span className="tnum">纸上得来终觉浅 · {new Date().getFullYear()}</span>
            </div>
          </footer>
        </AuthBridge>
      </body>
    </html>
  )
}
