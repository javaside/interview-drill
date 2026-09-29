import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillSession } from '../../src/app/(drill)/DrillSession.js'
import { memoryStore } from '../../src/client/store.js'
import { flushQueue } from '../../src/client/sync-engine.js'

const V = (correct: number[]) => ({ optionTexts: ['A', 'B', 'C', 'x', 'x', 'x', 'x', 'x', 'x'], correctIndices: correct, distractorKeyPointIds: [] })
const mkCard = (id: string) => ({ cardId: id, blockId: 'b1', blockName: 'MySQL', cardType: 'enumeration', frequency: 'high', question: `Q-${id}`, keyPoints: [] })

function payloadOf(ids: string[]) {
  return {
    today: '2026-09-23', mode: 'sprint',
    queue: ids.map(id => ({ cardId: id, reason: 'due' })),
    cards: ids.map(mkCard),
    prepared: ids.map(id => ({ cardId: id, degradedTo: 'none', variants: [V([0, 1, 2])] })),
    progress: { done: 0, total: ids.length },
  } as never
}

async function answerCurrent(u: ReturnType<typeof userEvent.setup>) {
  const boxes = screen.getAllByRole('checkbox')
  await u.click(boxes[0]!); await u.click(boxes[1]!); await u.click(boxes[2]!)
  await u.click(screen.getByRole('button', { name: /交卷/ }))
  await u.click(await screen.findByRole('button', { name: /下一题|完成/ }))
}

test('在线：连续刷完 3 张 → 进度 3/3 → 完成态', async () => {
  const u = userEvent.setup()
  const deps = { store: memoryStore(), online: () => true, now: () => 1000,
    api: { postReview: vi.fn(async () => ({ score: { num: 3, den: 3 }, remainingPlan: ['2026-10-01'], replanned: false, feedback: { correctChecked: 3, wrongChecked: 0, missed: 0 } })), postSync: vi.fn() } }
  render(<DrillSession payload={payloadOf(['c1', 'c2', 'c3'])} deps={deps as never} />)
  expect(screen.getByText('0/3')).toBeInTheDocument()
  await answerCurrent(u); await answerCurrent(u); await answerCurrent(u)
  expect(await screen.findByText(/今日完成|全部完成/)).toBeInTheDocument()
  expect(deps.api.postReview).toHaveBeenCalledTimes(3)
})

test('离线刷完 3 张 → 全部入队且 postReview 未调 → 重连 flushQueue 清空', async () => {
  const u = userEvent.setup()
  const store = memoryStore()
  const postSync = vi.fn(async () => {
    const q = await store.submissions.all()
    return { results: q.map(s => ({ submissionId: s.submissionId, outcome: {} })), duplicated: [] }
  })
  const deps = { store, online: () => false, now: () => 1000,
    api: { postReview: vi.fn(), postSync } }
  render(<DrillSession payload={payloadOf(['c1', 'c2', 'c3'])} deps={deps as never} />)
  await answerCurrent(u); await answerCurrent(u); await answerCurrent(u)
  // 离线：三条全部入队，权威判分未发生
  expect(await store.submissions.all()).toHaveLength(3)
  expect(deps.api.postReview).not.toHaveBeenCalled()
  // 重连回放：队列清空
  await flushQueue({ store, api: { postReview: vi.fn(), postSync } as never, online: () => true })
  expect(await store.submissions.all()).toHaveLength(0)
  expect(postSync).toHaveBeenCalled()
})
