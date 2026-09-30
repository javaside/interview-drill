import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavBar } from '../../src/app/NavBar.js'

// NavBar 是 client 组件用 usePathname 标当前页——jsdom 裸渲染无 Next 路由上下文，mock 掉
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

// signOut 是 client 侧清会话入口（拿 csrf → POST /api/auth/signout → 回跳），测试替换成 spy
const signOut = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOut(...args),
}))

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

// ===== 登录态：唯一新增元素是退出（登录入口不进导航——浏览零门槛哲学）=====

test('登录态：最右渲染「退出」按钮，点击 signOut({ callbackUrl: "/" }) 回首页', async () => {
  render(<NavBar authed />)
  const btn = screen.getByRole('button', { name: '退出' })
  expect(btn).toBeInTheDocument()
  // 退出在最右（设置之后）
  const right = document.querySelector('nav > div > div')!
  expect(right.lastElementChild).toContainElement(btn)
  await userEvent.click(btn)
  expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/drill' })
})

test('匿名态：不渲染退出按钮，也不出登录链接（导航保持三入口不变）', () => {
  render(<NavBar />)
  expect(screen.queryByRole('button', { name: '退出' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(3)
})
