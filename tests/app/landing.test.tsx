import { render, screen } from '@testing-library/react'
import { Landing } from '../../src/app/(drill)/Landing.js'

const totals = { cards: 404, blocks: 81, categories: 12 }
const tracks = ['Java 后端', '架构师', 'Agent 开发']

test('首屏价值主张：题海刷不完知识点刷得完 + 真实库量统计', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('题海刷不完')
  expect(root).toHaveTextContent('知识点刷得完')
  // 真实数字入页（非演示数字）
  expect(root).toHaveTextContent('404')
  expect(root).toHaveTextContent('81')
  expect(root).toHaveTextContent('12')
})

test('双 CTA：GitHub 登录（主）+ 先逛逛知识库（旁路）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  expect(screen.getByTestId('signin-cta')).toHaveAttribute('href', '/api/auth/signin?callbackUrl=/drill')
  expect(screen.getByTestId('landing-browse')).toHaveAttribute('href', '/map')
})

test('四条价值主张：判到要点 / 白话讲解 / 岗位一键 / 面试冲刺', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('判到要点')
  expect(root).toHaveTextContent('白话讲解')
  expect(root).toHaveTextContent('岗位一键')
  expect(root).toHaveTextContent('面试冲刺')
  // 岗位名来自库（tracks 传入），不硬编码漂移
  expect(root).toHaveTextContent('Java 后端 / 架构师 / Agent 开发')
})

test('登录理由与免费口径：跟账号走 + 免费 2 个完整块', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('进度、判分、复习排期都跟着账号走')
  expect(root).toHaveTextContent('免费刷 2 个完整块')
})

test('无岗位包（老库）：整条岗位价值项不渲染，不出空占位', () => {
  render(<Landing totals={totals} tracks={[]} />)
  expect(screen.queryByText(/岗位一键/)).not.toBeInTheDocument()
})
