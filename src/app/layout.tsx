import './globals.css'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '../server/auth-config.js'
import { getDb } from '../server/db/client.js'
import { loadSettings } from '../server/db/adapters.js'
import { NavBar } from './NavBar.js'
import { AuthBridge } from './AuthBridge.js'
// 标签页/搜索结果里要能认出「是干嘛的」：品牌 + 品类词，别只留品牌名
export const metadata = { title: '划重点 · 后端面试题' }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 登录态从服务端传给 NavBar；完整 session 传给 AuthBridge（SessionProvider）——
  // 其唯一职责是给 next-auth/react 的 signIn/signOut 下发 /drill 基路径（见 AuthBridge 注释）。
  // plan（免费/付费）供 NavBar 的常驻「解锁」入口显隐——免费才显示，付费自动消失。
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  const plan = userId !== undefined
    ? (await loadSettings(getDb(), userId)).plan
    : null
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
          <NavBar authed={userId !== undefined} plan={plan} />
          <main id="main" className="relative z-[2] flex-1">
            {children}
          </main>
          <footer className="relative z-[2] border-t border-paper-line/70 bg-paper-deep/60">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-6 text-xs text-paper-muted">
              <span className="flex items-center gap-4">
                <span className="font-bold tracking-wide">划重点</span>
                {/* 常驻入口：登录后首页是刷题界面，介绍页得有个随时能回看/分享的地址 */}
                <Link
                  href="/about"
                  data-testid="footer-about"
                  className="transition-colors duration-150 ease-snap hover:text-paper-ink"
                >
                  关于
                </Link>
              </span>
              <span className="tnum">纸上得来终觉浅 · {new Date().getFullYear()}</span>
            </div>
          </footer>
        </AuthBridge>
      </body>
    </html>
  )
}
