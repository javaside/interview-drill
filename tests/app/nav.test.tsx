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

test('导航含四个入口：刷题/知识地图/设置/关于', () => {
  render(<NavBar />)
  expect(screen.getByRole('link', { name: '刷题' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: '知识地图' })).toHaveAttribute('href', '/map')
  expect(screen.getByRole('link', { name: '设置' })).toHaveAttribute('href', '/settings')
  // 关于：2026-10-01 用户要求从页脚移到顶部导航（登录后首页是刷题界面，
  // 介绍页得有随时够得着的入口，也更容易转发）；页脚不再重复放
  expect(screen.getByRole('link', { name: '关于' })).toHaveAttribute('href', '/about')
})

test('当前页链接带 aria-current=page', () => {
  render(<NavBar />)
  expect(screen.getByRole('link', { name: '刷题' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '知识地图' })).not.toHaveAttribute('aria-current')
})

test('「解锁」入口三态（2026-09-30 拍板）：免费常驻 / 付费消失 / 匿名不显示', () => {
  // 免费：导航常驻「解锁」——解锁页原本只藏在地图锁块/免费墙提示里，用户找不到
  const free = render(<NavBar authed access="free" />)
  expect(screen.getByTestId('nav-upgrade')).toHaveAttribute('href', '/upgrade')
  expect(screen.getByTestId('nav-upgrade')).toHaveTextContent('解锁')
  free.unmount()
  // 付费：已解锁，入口自动消失（不出现任何付费文案）
  const paid = render(<NavBar authed access="paid" />)
  expect(screen.queryByTestId('nav-upgrade')).not.toBeInTheDocument()
  expect(/解锁|升级|付费|续期/.test(document.body.textContent ?? '')).toBe(false)
  paid.unmount()
  // 匿名：不显示（免费口径由落地页自己讲）
  render(<NavBar />)
  expect(screen.queryByTestId('nav-upgrade')).not.toBeInTheDocument()
})

test('通行证到期（grace）：chip 改叫「续期」而非消失——宽限期正是续期的自然时机', () => {
  render(<NavBar authed access="grace" />)
  const chip = screen.getByTestId('nav-upgrade')
  expect(chip).toHaveTextContent('续期')
  expect(chip).toHaveAttribute('href', '/upgrade')
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

test('匿名态：不渲染退出按钮，也不出登录链接（导航保持四个入口不变）', () => {
  render(<NavBar />)
  expect(screen.queryByRole('button', { name: '退出' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(4)
})
