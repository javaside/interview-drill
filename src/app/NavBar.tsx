'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { withBase } from '../lib/base-path.js'

/**
 * 页眉导航：考卷页眉——左品牌右链接，底部粗线压边。
 * §10.1 约束：**绝不放付费/升级入口**（tests/app/nav.test.tsx 守卫）。
 * 登录态：最右多一个安静的「退出」（signOut 回首页，落在匿名落地页）；
 * 未登录不渲染登录链接——浏览零门槛，登录入口由落地页/动作时刻提示承担。
 */
export function NavBar({ authed = false }: { authed?: boolean }): React.JSX.Element {
  const pathname = usePathname()
  const items = [
    { href: '/', label: '刷题' },
    { href: '/map', label: '知识地图' },
    { href: '/settings', label: '设置' },
  ] as const
  return (
    <nav className="sticky top-0 z-40 border-b-2 border-accent bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <span className="flex items-center gap-2.5">
          {/* 荧光笔点：品牌标记（纯装饰） */}
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-accent" />
          <span className="text-[15px] font-bold tracking-tight">面试刷题</span>
        </span>
        <div className="flex items-center gap-1">
          {items.map(i => {
            // usePathname 返回不带 /drill 前缀的站内路径，与 i.href 同口径可直判 active
            const active = pathname === i.href
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors duration-150 ease-snap ${
                  active
                    ? 'bg-accent/15 font-semibold text-accent'
                    : 'text-paper-muted hover:bg-paper-wash hover:text-paper-ink'
                }`}
              >
                {i.label}
              </Link>
            )
          })}
          {authed && (
            <button
              type="button"
              onClick={() => { void signOut({ callbackUrl: withBase('/') }) }}
              data-testid="nav-signout"
              className="ml-2 rounded-lg px-3.5 py-1.5 text-sm text-paper-muted transition-colors duration-150 ease-snap hover:bg-paper-wash hover:text-paper-ink"
            >
              退出
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
