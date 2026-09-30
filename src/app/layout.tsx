import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from '../server/auth-config.js'
import { NavBar } from './NavBar.js'
export const metadata = { title: '面试刷题' }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 登录态从服务端传给 NavBar（全站无 SessionProvider，client useSession 不可用）；
  // 各页本就 force-dynamic，layout 读会话无静态化损失
  const session = await getServerSession(authOptions)
  const authed = (session as { userId?: string } | null)?.userId !== undefined
  return (
    <html lang="zh-CN">
      <body className="grain flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          跳到主要内容
        </a>
        <NavBar authed={authed} />
        <main id="main" className="relative z-[2] flex-1">
          {children}
        </main>
        <footer className="relative z-[2] border-t border-paper-line/70 bg-paper-deep/60">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-6 text-xs text-paper-muted">
            <span className="font-bold tracking-wide">面试刷题</span>
            <span className="tnum">纸上得来终觉浅 · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
