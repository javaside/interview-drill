import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillSession } from '../../src/app/(drill)/DrillSession.js'
import { memoryStore } from '../../src/client/store.js'

const payload = {
  today: '2026-09-23', mode: 'sprint',
  queue: [{ cardId: 'c1', reason: 'due' }],
  cards: [{ cardId: 'c1', blockId: 'b1', blockName: 'MySQL', cardType: 'enumeration', frequency: 'high', question: 'Q?', keyPoints: [] }],
  prepared: [{ cardId: 'c1', degradedTo: 'none', variants: [{ optionTexts: ['A', 'B', 'C', 'x', 'x', 'x', 'x', 'x', 'x'], correctIndices: [0, 1, 2], distractorKeyPointIds: [] }] }],
  progress: { done: 0, total: 1 },
} as never

function mkDeps(online: boolean) {
  return {
    store: memoryStore(), online: () => online, now: () => 1000,
    api: {
      postReview: vi.fn(async () => ({ score: { num: 3, den: 3 }, remainingPlan: ['2026-09-25'], replanned: false, feedback: { correctChecked: 3, wrongChecked: 0, missed: 0 } })),
      postSync: vi.fn(),
    },
  }
}

test('答对一张：屏①→提交→屏②显示得分与进度推进', async () => {
  const u = userEvent.setup()
  render(<DrillSession payload={payload} deps={mkDeps(true) as never} />)
  expect(screen.getByText('0/1')).toBeInTheDocument()
  await u.click(screen.getAllByRole('checkbox')[0]!)
  await u.click(screen.getAllByRole('checkbox')[1]!)
  await u.click(screen.getAllByRole('checkbox')[2]!)
  await u.click(screen.getByRole('button', { name: /交卷/ }))
  expect(await screen.findByText(/3\s*\/\s*3/)).toBeInTheDocument()
})

test('离线提交：入队且屏②本地判分出反馈 +「计划将在联网后更新」', async () => {
  const u = userEvent.setup()
  const deps = mkDeps(false)
  render(<DrillSession payload={payload} deps={deps as never} />)
  await u.click(screen.getAllByRole('checkbox')[0]!)
  await u.click(screen.getAllByRole('checkbox')[1]!)
  await u.click(screen.getAllByRole('checkbox')[2]!)
  await u.click(screen.getByRole('button', { name: /交卷/ }))
  expect(await screen.findByText('计划将在联网后更新')).toBeInTheDocument()
  expect(await deps.store.submissions.all()).toHaveLength(1)
  expect(deps.api.postReview).not.toHaveBeenCalled()
})

/** 空队列 payload 模板：queue 空时的两种空态（§6 分母 queue-once 当天锁定） */
const emptyPayload = (done: number, total: number) => ({
  ...(payload as object), queue: [], cards: [], prepared: [],
  progress: { done, total },
}) as never

test('空队列且今天一题未刷（未设就绪日/未选块）→ 引导去设置', () => {
  render(<DrillSession payload={emptyPayload(0, 0)} deps={mkDeps(true) as never} />)
  expect(screen.getByText('今日队列是空的')).toBeInTheDocument()
})

test('空队列但今天已刷过（分母被当天首次访问锁 0）→ 显示今日完成，不误报引导', () => {
  render(<DrillSession payload={emptyPayload(5, 0)} deps={mkDeps(true) as never} />)
  expect(screen.getByText('今日完成')).toBeInTheDocument()
  expect(screen.queryByText('今日队列是空的')).toBeNull()
  expect(screen.queryByText('设定就绪日与知识块')).toBeNull()
})

test('空队列且分母正常（刷完了当天全部）→ 今日完成带分母', () => {
  render(<DrillSession payload={emptyPayload(5, 5)} deps={mkDeps(true) as never} />)
  expect(screen.getByText('今日完成')).toBeInTheDocument()
  expect(screen.getByText('5/5 · 明天见')).toBeInTheDocument()
})

test('常备模式空队列 → 「常备模式 · 今天没有到期卡」，不误报配置引导', () => {
  const p = { ...(payload as object), queue: [], cards: [], prepared: [],
    progress: { done: 0, total: 0 }, mode: 'maintenance', needsDateUpdate: false } as never
  render(<DrillSession payload={p} deps={mkDeps(true) as never} />)
  expect(screen.getByText(/常备模式 · 今天没有到期卡/)).toBeInTheDocument()
  expect(screen.queryByText('今日队列是空的')).toBeNull()
})

test('常备模式 + 就绪日已过期 → 附「已回到常备模式」提示（needsDateUpdate 透出）', () => {
  const p = { ...(payload as object), queue: [], cards: [], prepared: [],
    progress: { done: 0, total: 0 }, mode: 'maintenance', needsDateUpdate: true } as never
  render(<DrillSession payload={p} deps={mkDeps(true) as never} />)
  expect(screen.getByText(/就绪日已过/)).toBeInTheDocument()
})

test('今天有错题 → 空态显示「再练错题」按钮，点击调 postRequeue', async () => {
  const u = userEvent.setup()
  const postRequeue = vi.fn(async () => ({ requeued: 3 }))
  const deps = { ...mkDeps(true), postRequeue }
  const p = { ...(payload as object), queue: [], cards: [], prepared: [],
    progress: { done: 5, total: 0 }, mode: 'maintenance', needsDateUpdate: false, missesToday: 3 } as never
  render(<DrillSession payload={p} deps={deps as never} />)
  const btn = screen.getByRole('button', { name: /再练/ })
  expect(btn).toHaveTextContent('3')
  await u.click(btn)
  expect(postRequeue).toHaveBeenCalledOnce()
})

test('今天没有错题 → 不显示「再练」入口', () => {
  const p = { ...(payload as object), queue: [], cards: [], prepared: [],
    progress: { done: 0, total: 0 }, mode: 'maintenance', needsDateUpdate: false, missesToday: 0 } as never
  render(<DrillSession payload={p} deps={mkDeps(true) as never} />)
  expect(screen.queryByRole('button', { name: /再练/ })).toBeNull()
})

test('刷题中（phase=question）：进度行旁也有「错题 N」直达入口', async () => {
  const u = userEvent.setup()
  const postRequeue = vi.fn(async () => ({ requeued: 2 }))
  const deps = { ...mkDeps(true), postRequeue }
  const p = { ...(payload as object), missesToday: 2 } as never   // 队列有 1 张 + 今天还有 2 张错题
  render(<DrillSession payload={p} deps={deps as never} />)
  await u.click(screen.getByRole('button', { name: /错题\s*2/ }))
  expect(postRequeue).toHaveBeenCalledOnce()
})
