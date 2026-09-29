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
    <nav className="sticky top-0 z-40 border-b border-paper-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center gap-6 px-5 py-3">
        <span className="flex items-center gap-2.5">
          {/* 赭红印章：品牌识别块（纯装饰） */}
          <span
            aria-hidden="true"
            className="flex h-7 w-7 select-none items-center justify-center rounded-[6px] bg-accent font-serif text-[15px] font-bold text-paper shadow-stamp"
          >
            题
          </span>
          <span className="font-serif text-lg font-bold tracking-tight">面试刷题</span>
        </span>
        <div className="flex items-center gap-1">
          {items.map(i => {
            const active = pathname === i.href
            return (
              <a
                key={i.href}
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-paper-ink font-medium text-paper shadow-paper'
                    : 'text-paper-muted hover:bg-paper-wash hover:text-paper-ink'
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
