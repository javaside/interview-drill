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

test('首屏说人话：讲清实际动作与核心差异，且不出现内部术语', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const hero = screen.getByTestId('landing').querySelector('header')?.textContent ?? ''
  // 实际要做什么：九个说法里勾出所有对的
  expect(hero).toContain('九个说法')
  expect(hero).toContain('勾出所有对的')
  // 核心差异：告诉你错在哪一条（而不是只说答错了）
  expect(hero).toContain('漏了哪条')
  expect(hero).toContain('错勾了哪条')
  // 内部术语不得进用户可见文案：「要点判分」是数据模型词
  expect(hero).not.toContain('要点判分')
  expect(hero).not.toContain('要点明天')   // 且排期是按题的，不能说按要点
})

test('卖点与「怎么用」不重复：面试冲刺讲「临时加急」，排讲「长期倒推」', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  const loop = screen.getByTestId('landing-loop').textContent ?? ''
  const sprint = Array.from(root.querySelectorAll('ol.grid.md\\:grid-cols-2 li'))
    .map(li => li.textContent ?? '').find(t => t.includes('面试冲刺')) ?? ''
  // 冲刺卖点讲重铺计划（cram 场景）
  expect(sprint).toContain('重铺成冲刺计划')
  // 而「倒推每天刷几题」只归「排」一步，避免两处说同一句话
  expect(loop).toContain('倒推每天刷几题')
  expect(sprint).not.toContain('倒推每天刷几题')
})

test('全文不出现内部术语（用户看不懂的词）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing').textContent ?? ''
  // 逐个都是真实踩过的：数据模型词 / 黑话 / 产品内部动作名
  for (const jargon of ['要点', '闭环', '映射', '专刷', '排期']) {
    expect(root, `出现内部术语「${jargon}」`).not.toContain(jargon)
  }
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
  // 边界写成正面的专注表述（与产品实际行为一致：只围绕本题回答）
  expect(root).toHaveTextContent('只围绕这道题回答')
})

test('怎么用：学 → 练 → 判 → 排 四步都在，讲的是产品形态', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const loop = screen.getByTestId('landing-loop')
  const steps = Array.from(loop.querySelectorAll('h3')).map(el => el.textContent)
  expect(steps).toEqual(['学', '练', '判', '排'])
  expect(loop).toHaveTextContent('先理解再做题')
  expect(loop).toHaveTextContent('逐条判给你看')
  expect(loop).toHaveTextContent('答错的明天就回来')
  expect(loop).toHaveTextContent('倒推每天刷几题')
})

test('登录理由与免费口径：跟账号走 + 免费 2 个完整块 + 闭环口径与「怎么用」一致', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('进度、判分、复习计划都跟着账号走')
  expect(root).toHaveTextContent('免费刷 2 个知识块')
  expect(root).toHaveTextContent('学 → 练 → 判 → 排')
})

test('无岗位包（老库）：整条岗位价值项不渲染，不出空占位', () => {
  render(<Landing totals={totals} tracks={[]} />)
  expect(screen.queryByText(/岗位一键/)).not.toBeInTheDocument()
})
