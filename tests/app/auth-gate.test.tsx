import { render, screen } from '@testing-library/react'
import { getServerSession } from 'next-auth'
import { buildDailyPayload, practiceQueue } from '../../src/server/queue.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import { buildBlockMap } from '../../src/server/map.js'
import { loadBlocks, loadTracks, loadSettings } from '../../src/server/db/adapters.js'
import { SignInPrompt } from '../../src/app/SignInPrompt.js'
import DrillPage from '../../src/app/(drill)/page.js'
import PracticePage from '../../src/app/practice/page.js'
import LearnPage from '../../src/app/learn/page.js'
import MapPage from '../../src/app/map/page.js'

// 登录逻辑 v2：默认可见（首页/知识库不重定向），动作时刻（刷题/学习）提示登录。
// redirect 一旦被调就 throw（Next 真实行为）——测试里任何静默跳转都会让用例炸掉。
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../src/server/db/client.js', () => ({ getDb: () => ({}) }))
vi.mock('../../src/server/queue.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  buildDailyPayload: vi.fn(),
  practiceQueue: vi.fn(),
}))
vi.mock('../../src/server/deps.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  payloadDepsOf: vi.fn(() => ({ marker: 'deps' })),
}))
vi.mock('../../src/server/map.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  buildBlockMap: vi.fn(),
}))
vi.mock('../../src/server/db/adapters.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  loadBlocks: vi.fn(),
  loadTracks: vi.fn(),
  loadSettings: vi.fn(),
}))
vi.mock('../../src/app/(drill)/DrillSession.js', () => ({
  DrillSession: (props: { payload: { marker?: string } }) => (
    <div data-testid="drill-stub">{props.payload.marker ?? 'no-marker'}</div>
  ),
}))

beforeEach(() => { vi.clearAllMocks() })

const anon = () => vi.mocked(getServerSession).mockResolvedValue(null)
const signedIn = (userId = 'u1') =>
  vi.mocked(getServerSession).mockResolvedValue({ userId } as never)

// ===== SignInPrompt 组件 =====

test('登录提示：动作名入题，GitHub 登录 CTA + 知识库旁路', () => {
  render(<SignInPrompt what="刷题" />)
  expect(screen.getByTestId('signin-prompt')).toHaveTextContent('刷题前，先登录')
  expect(screen.getByTestId('signin-cta')).toHaveAttribute('href', '/api/auth/signin')
  expect(screen.getByRole('link', { name: '先逛逛知识库' })).toHaveAttribute('href', '/map')
})

// ===== / 刷题首页 =====

test('匿名访问首页：渲染站点介绍落地页（真实库量），不出卷、不重定向', async () => {
  anon()
  vi.mocked(loadBlocks).mockResolvedValue(blocks)
  vi.mocked(loadTracks).mockResolvedValue([])
  render(await DrillPage())
  // 价值介绍 + 登录引导，而非一张「先登录」小卡
  expect(screen.getByTestId('landing')).toBeInTheDocument()
  expect(screen.getByTestId('signin-cta')).toHaveAttribute('href', '/api/auth/signin')
  expect(screen.getByTestId('landing-browse')).toHaveAttribute('href', '/map')
  // 刊头统计 = 真实库量（blocks 夹具 23+18=41 题）
  expect(screen.getByText('41')).toBeInTheDocument()
  expect(buildDailyPayload).not.toHaveBeenCalled()
})

test('已登录首页：照常出今日卷（登录逻辑 v2 不改已登录路径）', async () => {
  signedIn()
  vi.mocked(buildDailyPayload).mockResolvedValue({ marker: 'payload' } as never)
  render(await DrillPage())
  expect(screen.getByTestId('drill-stub')).toHaveTextContent('payload')
  expect(payloadDepsOf).toHaveBeenCalledWith(expect.anything(), 'u1', expect.any(Number))
})

// ===== /practice 自由刷题 =====

test('匿名按块刷题：提示登录而非静默跳 OAuth', async () => {
  anon()
  render(await PracticePage({ searchParams: Promise.resolve({ block: 'b1' }) }))
  expect(screen.getByTestId('signin-prompt')).toHaveTextContent('刷题前，先登录')
  expect(practiceQueue).not.toHaveBeenCalled()
})

test('匿名不带块参数：仍回知识库（redirect /map 语义保留）', async () => {
  anon()
  await expect(PracticePage({ searchParams: Promise.resolve({}) }))
    .rejects.toThrow('NEXT_REDIRECT:/map')
})

test('已登录按块刷题：照常出练习卷', async () => {
  signedIn('u9')
  vi.mocked(practiceQueue).mockResolvedValue({ marker: 'practice' } as never)
  render(await PracticePage({ searchParams: Promise.resolve({ block: 'b1' }) }))
  expect(screen.getByTestId('drill-stub')).toHaveTextContent('practice')
})

// ===== /learn 学习页 =====

test('匿名学习：提示登录（教材不下发，也不静默跳 OAuth）', async () => {
  anon()
  render(await LearnPage({ searchParams: Promise.resolve({ block: 'b1' }) }))
  expect(screen.getByTestId('signin-prompt')).toHaveTextContent('学习前，先登录')
  expect(loadSettings).not.toHaveBeenCalled()
})

// ===== /map 知识库 =====

const blocks = [
  { blockId: 'b1', blockName: 'MySQL 索引', category: 'db', cardCount: 23 },
  { blockId: 'b2', blockName: 'Redis', category: 'db', cardCount: 18 },
]

test('匿名访问知识库：真实目录可见（块名/题量/统计），零用户数据查询', async () => {
  anon()
  vi.mocked(loadBlocks).mockResolvedValue(blocks)
  vi.mocked(loadTracks).mockResolvedValue([])
  render(await MapPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByTestId('block-b1')).toHaveTextContent('MySQL 索引')
  expect(screen.getByTestId('block-b1')).toHaveTextContent('23 题')
  expect(screen.getByTestId('block-b2')).toHaveTextContent('18 题')
  // 刊头统计 = 真实库量
  expect(screen.getByText('41')).toBeInTheDocument()   // 题目总数
  // 匿名不出掌握度/解锁位
  expect(screen.queryByTestId('locked-block')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('catalog-practice')).toHaveLength(2)
  expect(loadSettings).not.toHaveBeenCalled()
  expect(buildBlockMap).not.toHaveBeenCalled()
})

test('匿名知识库 ?track= 过滤仍生效（岗位是导航视图，与登录无关）', async () => {
  anon()
  vi.mocked(loadBlocks).mockResolvedValue(blocks)
  vi.mocked(loadTracks).mockResolvedValue([
    { id: 't1', name: 'Java 后端', tagline: '', blockIds: ['b1'] },
  ])
  render(await MapPage({ searchParams: Promise.resolve({ track: 't1' }) }))
  expect(screen.getByTestId('block-b1')).toBeInTheDocument()
  expect(screen.queryByTestId('block-b2')).not.toBeInTheDocument()
})

test('已登录知识库：完整视图不变（掌握度 + 解锁位）', async () => {
  signedIn()
  vi.mocked(buildBlockMap).mockResolvedValue([
    { blockId: 'b1', blockName: 'MySQL 索引', category: 'db', cardCount: 23, unlocked: true, mastery: { kind: 'score', value: { num: 1, den: 2 } } },
    { blockId: 'b2', blockName: 'Redis', category: 'db', cardCount: 18, unlocked: false, mastery: { kind: 'untried' } },
  ] as never)
  vi.mocked(loadTracks).mockResolvedValue([])
  vi.mocked(loadSettings).mockResolvedValue({
    readyByDate: null, dailyCapacity: 45, timezone: 'Asia/Shanghai',
    plan: 'free', freeBlockIds: ['b1'], trackId: null,
  })
  render(await MapPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByTestId('block-b1')).toHaveTextContent('掌握 50%')
  expect(screen.getByTestId('locked-block')).toHaveAttribute('href', '/upgrade')
  expect(screen.queryByTestId('catalog-practice')).not.toBeInTheDocument()
})
