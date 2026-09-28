import { render, screen } from '@testing-library/react'
import { NavBar } from '../../src/app/NavBar.js'

// NavBar 是 client 组件用 usePathname 标当前页——jsdom 裸渲染无 Next 路由上下文，mock 掉
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

test('导航含三个功能模块入口：刷题/知识地图/设置', () => {
  render(<NavBar />)
  expect(screen.getByRole('link', { name: '刷题' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: '知识地图' })).toHaveAttribute('href', '/map')
  expect(screen.getByRole('link', { name: '设置' })).toHaveAttribute('href', '/settings')
})

test('当前页链接带 aria-current=page', () => {
  render(<NavBar />)
  expect(screen.getByRole('link', { name: '刷题' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '知识地图' })).not.toHaveAttribute('aria-current')
})

test('§10.1 守卫：导航绝不出现付费入口（无 /upgrade 链接、无购买/解锁/升级文案）', () => {
  render(<NavBar />)
  const links = screen.getAllByRole('link')
  expect(links.every(a => a.getAttribute('href') !== '/upgrade')).toBe(true)
  const text = document.body.textContent ?? ''
  expect(/解锁|购买|升级|付费/.test(text)).toBe(false)
})
