'use client'
import { usePathname } from 'next/navigation'

/**
 * 全站导航（挂 RootLayout，所有页面共享）。只含功能模块入口：刷题/知识地图/设置。
 * §10.1 约束：**绝不放付费/升级入口**——产品内唯一转化入口是知识地图的未解锁块，
 * 刷题主循环与全局导航不得出现任何付费文案（tests/app/nav.test.tsx 守卫）。
 * 当前页以 aria-current + 墨色标出（审计项：无当前页指示）。
 */
export function NavBar(): React.JSX.Element {
  const pathname = usePathname()
  const items = [
    { href: '/', label: '刷题' },
    { href: '/map', label: '知识地图' },
    { href: '/settings', label: '设置' },
  ] as const
  return (
    <nav className="border-b border-paper-line bg-paper">
      <div className="mx-auto flex max-w-2xl items-baseline gap-5 px-5 py-4">
        <span className="font-serif text-lg font-bold tracking-tight">面试刷题</span>
        {items.map(i => {
          const active = pathname === i.href
          return (
            <a
              key={i.href}
              href={i.href}
              aria-current={active ? 'page' : undefined}
              className={`text-sm transition-colors ${
                active
                  ? 'font-medium text-paper-ink underline decoration-accent decoration-2 underline-offset-8'
                  : 'text-paper-muted hover:text-paper-ink'
              }`}
            >
              {i.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
