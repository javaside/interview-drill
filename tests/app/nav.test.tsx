import { render, screen } from '@testing-library/react'
import { NavBar } from '../../src/app/NavBar.js'

test('导航含三个功能模块入口：刷题/知识地图/设置', () => {
  render(<NavBar />)
  expect(screen.getByRole('link', { name: '刷题' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: '知识地图' })).toHaveAttribute('href', '/map')
  expect(screen.getByRole('link', { name: '设置' })).toHaveAttribute('href', '/settings')
})

test('§10.1 守卫：导航绝不出现付费入口（无 /upgrade 链接、无购买/解锁/升级文案）', () => {
  render(<NavBar />)
  const links = screen.getAllByRole('link')
  expect(links.every(a => a.getAttribute('href') !== '/upgrade')).toBe(true)
  const text = document.body.textContent ?? ''
  expect(/解锁|购买|升级|付费/.test(text)).toBe(false)
})
