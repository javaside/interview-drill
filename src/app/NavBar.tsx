/**
 * 全站导航（挂 RootLayout，所有页面共享）。只含功能模块入口：刷题/知识地图/设置。
 * §10.1 约束：**绝不放付费/升级入口**——产品内唯一转化入口是知识地图的未解锁块，
 * 刷题主循环与全局导航不得出现任何付费文案（tests/app/nav.test.tsx 守卫）。
 */
export function NavBar(): React.JSX.Element {
  const items = [
    { href: '/', label: '刷题' },
    { href: '/map', label: '知识地图' },
    { href: '/settings', label: '设置' },
  ] as const
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
        <span className="font-semibold">面试刷题</span>
        {items.map(i => (
          <a key={i.href} href={i.href} className="text-sm text-gray-600 hover:text-gray-900">
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
