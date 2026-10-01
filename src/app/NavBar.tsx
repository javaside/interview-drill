'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { withBase } from '../lib/base-path.js'

/**
 * 页眉导航：考卷页眉——左品牌右链接，底部粗线压边。
 * 入口：刷题 / 知识地图 / 设置 / 关于，再加两个随状态出现的——
 * 「解锁」（免费常驻，2026-09-30 拍板：解锁页原本只藏在地图锁块里，用户找不到）、
 * 「退出」（登录态最右，signOut 回首页落匿名落地页）。
 *
 * 「关于」原本只在页脚。移上来（2026-10-01 用户要求）后页脚不再重复；
 * 它是全站唯一介绍产品的稳定地址（登录后首页是刷题界面），放导航随时够得着、
 * 也更容易被转发。
 *
 * 换行策略：窄屏下 4 个主链接 + 解锁 + 退出共 6 项放不下。**整项换行**（flex-wrap +
 * shrink-0）而不是让 flex 压缩——压缩会把「知识地图」折成两行、导航高度从 62 涨到 82，
 * 是加「关于」之前就存在的毛病（375px 免费用户已复现）。窄屏同时收紧内边距与字号，
 * 多数机型两行内排得下。
 */
export function NavBar(
  { authed = false, plan = null }: { authed?: boolean; plan?: 'free' | 'paid' | null },
): React.JSX.Element {
  const pathname = usePathname()
  const items = [
    { href: '/', label: '刷题' },
    { href: '/map', label: '知识地图' },
    { href: '/settings', label: '设置' },
    { href: '/about', label: '关于' },
  ] as const
  return (
    <nav className="sticky top-0 z-40 border-b-2 border-accent bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2 sm:px-6 sm:py-3.5">
        <span className="flex shrink-0 items-center gap-2.5">
          {/* 荧光笔点：品牌标记（纯装饰） */}
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-accent" />
          <span className="text-[15px] font-bold tracking-tight">划重点</span>
        </span>
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 sm:gap-x-1">
          {items.map(i => {
            // usePathname 返回不带 /drill 前缀的站内路径，与 i.href 同口径可直判 active
            const active = pathname === i.href
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ease-snap sm:px-3.5 sm:text-sm ${
                  active
                    ? 'bg-accent/15 font-semibold text-accent'
                    : 'text-paper-muted hover:bg-paper-wash hover:text-paper-ink'
                }`}
              >
                {i.label}
              </Link>
            )
          })}
          {plan === 'free' && (
            <Link
              href="/upgrade"
              data-testid="nav-upgrade"
              className="ml-1 shrink-0 whitespace-nowrap rounded-lg bg-accent/15 px-2.5 py-1.5 text-[13px] font-semibold text-accent transition-colors duration-150 ease-snap hover:bg-accent/25 sm:px-3.5 sm:text-sm"
            >
              解锁
            </Link>
          )}
          {authed && (
            <button
              type="button"
              onClick={() => { void signOut({ callbackUrl: withBase('/') }) }}
              data-testid="nav-signout"
              className="ml-2 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] text-paper-muted transition-colors duration-150 ease-snap hover:bg-paper-wash hover:text-paper-ink sm:px-3.5 sm:text-sm"
            >
              退出
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
