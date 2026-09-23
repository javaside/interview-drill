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
  await u.click(screen.getByRole('button', { name: '提交' }))
  expect(await screen.findByText(/3\s*\/\s*3/)).toBeInTheDocument()
})

test('离线提交：入队且屏②本地判分出反馈 +「计划将在联网后更新」', async () => {
  const u = userEvent.setup()
  const deps = mkDeps(false)
  render(<DrillSession payload={payload} deps={deps as never} />)
  await u.click(screen.getAllByRole('checkbox')[0]!)
  await u.click(screen.getAllByRole('checkbox')[1]!)
  await u.click(screen.getAllByRole('checkbox')[2]!)
  await u.click(screen.getByRole('button', { name: '提交' }))
  expect(await screen.findByText('计划将在联网后更新')).toBeInTheDocument()
  expect(await deps.store.submissions.all()).toHaveLength(1)
  expect(deps.api.postReview).not.toHaveBeenCalled()
})
