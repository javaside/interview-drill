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

test('价值主张：AI 追问 / 白话讲解 / 岗位一键 / 面试冲刺', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('不懂就追问 AI')
  expect(root).toHaveTextContent('白话讲解')
  expect(root).toHaveTextContent('岗位一键')
  expect(root).toHaveTextContent('面试冲刺')
  // 岗位名来自库（tracks 传入），不硬编码漂移
  expect(root).toHaveTextContent('Java 后端 / 架构师 / Agent 开发')
})

test('卖点条数为偶数：双列网格不留孤儿（奇数条末行会空一半，像排版坏了）', () => {
  const { unmount } = render(<Landing totals={totals} tracks={tracks} />)
  const grid = screen.getByTestId('landing').querySelector('ol.grid.md\\:grid-cols-2')
  expect(grid?.children.length).toBe(4)   // 2×2
  unmount()

  // 老库无岗位包时是 3 条（退化场景）：这里只保证不因缺岗位项而出错
  render(<Landing totals={totals} tracks={[]} />)
  const grid2 = screen.getByTestId('landing').querySelector('ol.grid.md\\:grid-cols-2')
  expect(grid2?.children.length).toBe(3)
})

test('AI 卖点讲清边界：只聊这道题（把约束讲成卖点，不吹成通用助手）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  // 两个真实可用场景
  expect(root).toHaveTextContent('这个选项为什么不对')
  expect(root).toHaveTextContent('交卷后我错在哪')
  // 边界（与产品实际行为一致：跑题一律拒答）
  expect(root).toHaveTextContent('只聊这一道题')
})

test('怎么用：学 → 练 → 判 → 排 四步都在，讲的是产品形态', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const loop = screen.getByTestId('landing-loop')
  const steps = Array.from(loop.querySelectorAll('h3')).map(el => el.textContent)
  expect(steps).toEqual(['学', '练', '判', '排'])
  expect(loop).toHaveTextContent('先理解再做题')
  expect(loop).toHaveTextContent('逐条判到要点')   // 「判到要点」并入此步，卖点区不再重复
  expect(loop).toHaveTextContent('答错的明天优先再来')
  expect(loop).toHaveTextContent('倒推每天刷几题')
})

test('登录理由与免费口径：跟账号走 + 免费 2 个完整块 + 闭环口径与「怎么用」一致', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('进度、判分、复习排期都跟着账号走')
  expect(root).toHaveTextContent('免费刷 2 个完整块')
  expect(root).toHaveTextContent('学 → 练 → 判 → 排')
})

test('无岗位包（老库）：整条岗位价值项不渲染，不出空占位', () => {
  render(<Landing totals={totals} tracks={[]} />)
  expect(screen.queryByText(/岗位一键/)).not.toBeInTheDocument()
})
