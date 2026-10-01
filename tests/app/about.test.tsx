import { render, screen } from '@testing-library/react'
import { loadBlocks, loadTracks } from '../../src/server/db/adapters.js'
import AboutPage from '../../src/app/about/page.js'

/**
 * /about 产品介绍页：**复用同一个 Landing 组件**（内容零重复）。
 * 这里只验证「接线」——真实库量取到并交给组件；组件本身的表现由 landing.test.tsx 覆盖。
 */

vi.mock('../../src/server/db/client.js', () => ({ getDb: () => ({}) }))
vi.mock('../../src/server/db/adapters.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  loadBlocks: vi.fn(),
  loadTracks: vi.fn(),
}))

const mockedBlocks = vi.mocked(loadBlocks)
const mockedTracks = vi.mocked(loadTracks)

beforeEach(() => {
  // 清调用历史：否则跨用例累积，"只被调一次"这类断言会误判
  vi.clearAllMocks()
  mockedBlocks.mockResolvedValue([
    { blockId: 'b1', blockName: 'B1', category: 'mysql', cardCount: 40 },
    { blockId: 'b2', blockName: 'B2', category: 'mysql', cardCount: 35 },
    { blockId: 'b3', blockName: 'B3', category: 'java', cardCount: 25 },
  ])
  mockedTracks.mockResolvedValue([
    { id: 't1', name: 'Java 后端', tagline: '', blockIds: [] },
    { id: 't2', name: '架构师', tagline: '', blockIds: [] },
  ])
})

test('/about：渲染介绍页，且数字来自真实库（题量求和、块数、分类去重）', async () => {
  render(await AboutPage())
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('题海刷不完')
  expect(root).toHaveTextContent('100')   // 40 + 35 + 25
  expect(root).toHaveTextContent('3')     // 3 个块
  expect(root).toHaveTextContent('2')     // mysql / java 两个分类
  expect(root).toHaveTextContent('Java 后端 / 架构师')
})

test('/about：登录 CTA 回首页（登录后落到刷题界面，而不是又绕回介绍页）', async () => {
  render(await AboutPage())
  expect(screen.getByTestId('signin-cta')).toHaveAttribute('href', '/api/auth/signin?callbackUrl=/drill')
})

test('/about：只读 blocks/tracks——不查任何用户数据（匿名可访问）', async () => {
  render(await AboutPage())
  // 适配器只被这两张“公共目录表”调用；没有 settings/session 之类的用户数据入口
  expect(mockedBlocks).toHaveBeenCalledTimes(1)
  expect(mockedTracks).toHaveBeenCalledTimes(1)
})
