'use client'
import { usePathname } from 'next/navigation'

/**
 * 浮岛导航：脱离顶边的玻璃胶囊（居中悬浮），点击态墨白反转。
 * §10.1 约束：**绝不放付费/升级入口**——产品内唯一转化入口是知识地图的
 * 未解锁块（tests/app/nav.test.tsx 守卫）。
 */
export function NavBar(): React.JSX.Element {
  const pathname = usePathname()
  const items = [
    { href: '/', label: '刷题' },
    { href: '/map', label: '知识地图' },
    { href: '/settings', label: '设置' },
  ] as const
  return (
    <nav className="fixed left-1/2 top-5 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-paper/70 py-1.5 pl-2 pr-1.5 shadow-diffuse backdrop-blur-2xl">
        <span className="flex items-center gap-2 pl-1.5 pr-1">
          {/* 品牌印章（纯装饰） */}
          <span
            aria-hidden="true"
            className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-accent font-serif text-[15px] font-bold text-paper shadow-stamp"
          >
            题
          </span>
          <span className="hidden font-serif text-[15px] font-bold tracking-tight sm:inline">面试刷题</span>
        </span>
        <div className="flex items-center gap-0.5">
          {items.map(i => {
            const active = pathname === i.href
            return (
              <a
                key={i.href}
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-all duration-500 ease-fluid ${
                  active
                    ? 'bg-paper-ink font-medium text-paper'
                    : 'text-paper-muted hover:bg-white/[0.06] hover:text-paper-ink'
                }`}
              >
                {i.label}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
