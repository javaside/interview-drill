import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillSession } from '../../src/app/(drill)/DrillSession.js'
import { memoryStore } from '../../src/client/store.js'

/**
 * 刷题页单题 AI 问答：入口挂在 DrillSession（首页与 /practice 共用主循环），
 * 上下文只含当前卡——换题必须重置，对话绝不串到下一题。
 */

/** 造一个流式 /api/qa 响应：把整段回答切成 chunks 逐帧下发（模拟真实流式） */
function sseResponse(chunks: string[], status = 200): Response {
  const enc = new TextEncoder()
  return new Response(new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`))
      }
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      c.close()
    },
  }), { status, headers: { 'content-type': 'text/event-stream' } })
}

const V = () => ({ optionTexts: ['A', 'B', 'C', 'x', 'x', 'x', 'x', 'x', 'x'], correctIndices: [0, 1, 2], distractorKeyPointIds: [] })
const mkCard = (id: string) => ({
  cardId: id, blockId: 'b1', blockName: 'MySQL', cardType: 'enumeration',
  frequency: 'high', question: `Q-${id}`, detail: `D-${id}`, keyPoints: [],
})

function payloadOf(ids: string[]) {
  return {
    today: '2026-09-23', mode: 'sprint',
    queue: ids.map(id => ({ cardId: id, reason: 'due' })),
    cards: ids.map(mkCard),
    prepared: ids.map(id => ({ cardId: id, degradedTo: 'none', variants: [V()] })),
    progress: { done: 0, total: ids.length },
  } as never
}

function depsOf() {
  return {
    store: memoryStore(),
    online: () => true,
    now: () => 1000,
    api: {
      postReview: vi.fn(async () => ({
        score: { num: 3, den: 3 }, remainingPlan: [], replanned: false,
        feedback: { correctChecked: 3, wrongChecked: 0, missed: 0 },
      })),
      postSync: vi.fn(),
    },
  }
}

/** 交卷（不推进下一题） */
async function submitCurrent(u: ReturnType<typeof userEvent.setup>) {
  const boxes = screen.getAllByRole('checkbox')
  await u.click(boxes[0]!); await u.click(boxes[1]!); await u.click(boxes[2]!)
  await u.click(screen.getByRole('button', { name: /交卷/ }))
}

/** 展开问答框并提问，返回发出请求的 body */
async function askAI(
  u: ReturnType<typeof userEvent.setup>, question: string,
  fetchMock: ReturnType<typeof vi.fn>, callIndex: number,
) {
  await u.click(screen.getByRole('button', { name: /问 AI/ }))
  await u.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), question)
  await u.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(callIndex + 1))
  const init = (fetchMock.mock.calls[callIndex] as unknown[])[1] as RequestInit
  return JSON.parse(String(init.body)) as { cardId: string; history: Array<{ role: string; content: string }> }
}

afterEach(() => vi.unstubAllGlobals())

test('刷题页每题有 AI 问答，请求只带当前题的 cardId 与本轮提问', async () => {
  const u = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['c1 ', '的回答']))
  vi.stubGlobal('fetch', fetchMock)
  render(<DrillSession payload={payloadOf(['c1', 'c2'])} deps={depsOf() as never} />)

  const body = await askAI(u, '这题没懂', fetchMock, 0)
  await waitFor(() => expect(screen.getByText('c1 的回答')).toBeInTheDocument())

  expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe('/drill/api/qa')
  expect(body.cardId).toBe('c1')
  expect(body.history).toEqual([{ role: 'user', content: '这题没懂' }])
})

test('换到下一题：问答框重置，上一题的问答不出现，cardId 跟着换', async () => {
  const u = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['回答']))
  vi.stubGlobal('fetch', fetchMock)
  render(<DrillSession payload={payloadOf(['c1', 'c2'])} deps={depsOf() as never} />)

  await askAI(u, 'c1 的问题', fetchMock, 0)
  await waitFor(() => expect(screen.getByText('回答')).toBeInTheDocument())

  await submitCurrent(u)
  await u.click(await screen.findByRole('button', { name: /下一题/ }))

  // 到 c2：问答框回到折叠态，上一题的问答一字不留
  expect(screen.queryByText('c1 的问题')).not.toBeInTheDocument()
  expect(screen.queryByText('回答')).not.toBeInTheDocument()
  expect(screen.getByText('Q-c2')).toBeInTheDocument()

  const body = await askAI(u, 'c2 的问题', fetchMock, 1)
  expect(body.cardId).toBe('c2')
  expect(body.history).toEqual([{ role: 'user', content: 'c2 的问题' }])
})

test('屏① 问过的到屏② 仍在（交卷不丢对话），且此时仍能继续追问', async () => {
  const u = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['第一轮回答']))
  vi.stubGlobal('fetch', fetchMock)
  render(<DrillSession payload={payloadOf(['c1'])} deps={depsOf() as never} />)

  await askAI(u, '交卷前的问题', fetchMock, 0)
  await waitFor(() => expect(screen.getByText('第一轮回答')).toBeInTheDocument())

  await submitCurrent(u)
  // 屏②：上一轮的问答仍在（问答框位置固定，不随 phase 重建）
  expect(await screen.findByText('交卷前的问题')).toBeInTheDocument()
  expect(screen.getByText('第一轮回答')).toBeInTheDocument()

  // 追问时携带该卡完整历史
  await u.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '追问')
  await u.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const body = JSON.parse(String(((fetchMock.mock.calls[1] as unknown[])[1] as RequestInit).body)) as {
    cardId: string; history: Array<{ role: string; content: string }>
  }
  expect(body.cardId).toBe('c1')
  expect(body.history).toEqual([
    { role: 'user', content: '交卷前的问题' },
    { role: 'assistant', content: '第一轮回答' },
    { role: 'user', content: '追问' },
  ])
})

test('主循环不被问答打断：「下一题」按钮始终在问答入口之前', async () => {
  const u = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['x'])))
  render(<DrillSession payload={payloadOf(['c1', 'c2'])} deps={depsOf() as never} />)

  await submitCurrent(u)
  const next = await screen.findByRole('button', { name: /下一题/ })
  const qa = screen.getByRole('button', { name: /问 AI/ })
  // DOCUMENT_POSITION_FOLLOWING：下一题按钮位于问答入口之前（用户先看到主行动）
  expect(next.compareDocumentPosition(qa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('离线时不发请求，直接提示恢复联网', async () => {
  const u = userEvent.setup()
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  render(<DrillSession payload={payloadOf(['c1'])} deps={depsOf() as never} />)

  await u.click(screen.getByRole('button', { name: /问 AI/ }))
  await u.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '离线提问')
  await u.click(screen.getByRole('button', { name: '提问' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('现在没有网络')
  expect(fetchMock).not.toHaveBeenCalled()
  onLine.mockRestore()
})

test('完成态不再渲染问答框', async () => {
  const u = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['x'])))
  render(<DrillSession payload={payloadOf(['c1'])} deps={depsOf() as never} />)

  await submitCurrent(u)
  await u.click(await screen.findByRole('button', { name: /完成/ }))

  await screen.findByText('今日完成')
  expect(screen.queryByRole('button', { name: /问 AI/ })).not.toBeInTheDocument()
})

test('每屏只渲染当前题一个问答框（不把整队题目都挂上）', () => {
  render(<DrillSession payload={payloadOf(['c1', 'c2', 'c3'])} deps={depsOf() as never} />)
  expect(screen.getAllByRole('button', { name: /问 AI/ })).toHaveLength(1)
  const article = within(document.body)
  expect(article.queryByText('Q-c2')).not.toBeInTheDocument()
})

test('流式增量渲染：先到的片段先上屏，不必等整段回答完', async () => {
  const u = userEvent.setup()
  // 手控流：第一个分片到达后暂停，等断言完再放后续
  let releaseSecond: (() => void) | null = null
  const gate = new Promise<void>(resolve => { releaseSecond = resolve })
  const enc = new TextEncoder()
  const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
    async start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'delta', text: '第一段' })}\n\n`))
      await gate                                  // ← 卡住：此时只有第一段到达
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'delta', text: '第二段' })}\n\n`))
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      c.close()
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
  vi.stubGlobal('fetch', fetchMock)
  render(<DrillSession payload={payloadOf(['c1'])} deps={depsOf() as never} />)

  await u.click(screen.getByRole('button', { name: /问 AI/ }))
  await u.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '流式问题')
  await u.click(screen.getByRole('button', { name: '提问' }))

  // 整段回答尚未到达，但第一段已经可见（这正是流式相对一次性返回的价值）
  await waitFor(() => expect(screen.getByText('第一段')).toBeInTheDocument())
  expect(screen.queryByText(/第二段/)).not.toBeInTheDocument()
  // 未产出内容时才显示「AI 正在想」——开始吐字后不再显示
  expect(screen.queryByText(/AI 正在想/)).not.toBeInTheDocument()

  releaseSecond!()
  await waitFor(() => expect(screen.getByText(/第一段第二段/)).toBeInTheDocument())
})

test('流中途报错：已吐出的部分保留在屏上，错误进 role=alert', async () => {
  const u = userEvent.setup()
  const enc = new TextEncoder()
  let pulled = 0
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
    pull(c) {
      if (pulled++ === 0) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'delta', text: '半截回答' })}\n\n`))
      } else {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'error', message: 'DeepSeek 连接中断，请重试' })}\n\n`))
        c.close()
      }
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))
  render(<DrillSession payload={payloadOf(['c1'])} deps={depsOf() as never} />)

  await u.click(screen.getByRole('button', { name: /问 AI/ }))
  await u.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '会断的问题')
  await u.click(screen.getByRole('button', { name: '提问' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('DeepSeek 连接中断，请重试')
  // 已产出的半截回答不因报错消失；问题也不退回输入框（避免重复提问的困惑）
  expect(screen.getByText('半截回答')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /向 AI 提问/ })).toHaveValue('')
})
