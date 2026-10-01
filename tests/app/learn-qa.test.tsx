import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearnView } from '../../src/app/learn/LearnView.js'
import type { LearnCard } from '../../src/app/learn/LearnView.js'

/**
 * learn 页 AI 问答组件：每题一个折叠问答框；对话历史在组件实例内——
 * 在 A 题提问后，B 题的框里没有 A 的问答（独立上下文的行为级验证）。
 */

const cards: LearnCard[] = [
  { cardId: 'c1', question: 'undo log 有哪些作用？', frequency: 'high', detail: 'undo 讲解' },
  { cardId: 'c2', question: 'ReadView 生成时机？', frequency: 'mid', detail: 'ReadView 讲解' },
]

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

afterEach(() => vi.unstubAllGlobals())

test('每张卡各有一个折叠问答框，点开可提问，回答上屏', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['**undo log 是回滚与 MVCC 的基础**']))
  vi.stubGlobal('fetch', fetchMock)
  render(<LearnView blockName="MVCC" cards={cards} blockId="b1" />)

  // 两张卡各一个入口
  const triggers = screen.getAllByRole('button', { name: /问 AI/ })
  expect(triggers).toHaveLength(2)

  await user.click(triggers[0]!)
  const input = screen.getByRole('textbox', { name: /向 AI 提问/ })
  await user.type(input, '和 redo log 的区别？')
  await user.click(screen.getByRole('button', { name: '提问' }))

  await waitFor(() => expect(screen.getByText(/回滚与 MVCC 的基础/)).toBeInTheDocument())
  // 请求：/drill 前缀 + 本卡 id + 仅含本轮提问的历史
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('/drill/api/qa')
  const body = JSON.parse(String(init.body)) as { cardId: string; history: Array<{ role: string; content: string }> }
  expect(body.cardId).toBe('c1')
  expect(body.history).toEqual([{ role: 'user', content: '和 redo log 的区别？' }])
})

test('独立上下文：在 c1 提问并得到回答后，c2 的框是干净的', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['c1 的回答']))
  vi.stubGlobal('fetch', fetchMock)
  render(<LearnView blockName="MVCC" cards={cards} blockId="b1" />)

  const triggers = screen.getAllByRole('button', { name: /问 AI/ })
  await user.click(triggers[0]!)
  await user.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), 'c1 的问题')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(screen.getByText('c1 的回答')).toBeInTheDocument())

  // 打开 c2 的框：c2 文章内既没有 c1 的问题，也没有 c1 的回答
  await user.click(triggers[1]!)
  const c2 = within(document.getElementById('c2')!)
  expect(c2.queryByText('c1 的问题')).not.toBeInTheDocument()
  expect(c2.queryByText('c1 的回答')).not.toBeInTheDocument()

  // c2 提问时携带的历史只有它自己的这一问
  await user.type(c2.getByRole('textbox', { name: /向 AI 提问/ }), 'c2 的问题')
  await user.click(c2.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const body2 = JSON.parse(String(((fetchMock.mock.calls[1] as unknown[])[1] as RequestInit).body)) as { cardId: string; history: Array<{ role: string; content: string }> }
  expect(body2.cardId).toBe('c2')
  expect(body2.history).toEqual([{ role: 'user', content: 'c2 的问题' }])
})

test('多轮：第二次提问携带本卡的第一轮问答', async () => {
  const user = userEvent.setup()
  let n = 0
  const fetchMock = vi.fn(async () => sseResponse([`第${++n}答`]))
  vi.stubGlobal('fetch', fetchMock)
  render(<LearnView blockName="MVCC" cards={[cards[0]!]} blockId="b1" />)

  await user.click(screen.getByRole('button', { name: /问 AI/ }))
  await user.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '第一问')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(screen.getByText('第1答')).toBeInTheDocument())

  await user.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '第二问')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(screen.getByText('第2答')).toBeInTheDocument())

  const body2 = JSON.parse(String(((fetchMock.mock.calls[1] as unknown[])[1] as RequestInit).body)) as { cardId: string; history: Array<{ role: string; content: string }> }
  expect(body2.cardId).toBe('c1')
  expect(body2.history).toEqual([
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第1答' },
    { role: 'user', content: '第二问' },
  ])
})

test('服务端拒绝（400 + 中文 error）→ role=alert 展示，问题退回输入框', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ error: '这个块还没有解锁，先去解锁才能提问' }), { status: 400 })))
  render(<LearnView blockName="MVCC" cards={[cards[0]!]} blockId="b1" />)

  await user.click(screen.getByRole('button', { name: /问 AI/ }))
  await user.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), '越权问题')
  await user.click(screen.getByRole('button', { name: '提问' }))

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('这个块还没有解锁，先去解锁才能提问'))
  // 失败不吞问题：退回输入框便于重发
  await waitFor(() => expect(screen.getByRole('textbox', { name: /向 AI 提问/ })).toHaveValue('越权问题'))
})

test('learn 页不传选项（那边本来就没有选项，不该凭空塞）', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(async () => sseResponse(['回答']))
  vi.stubGlobal('fetch', fetchMock)
  render(<LearnView blockName="MVCC" cards={[cards[0]!]} blockId="b1" />)

  await user.click(screen.getByRole('button', { name: /问 AI/ }))
  await user.type(screen.getByRole('textbox', { name: /向 AI 提问/ }), 'q')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

  const body = JSON.parse(String(((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body)) as Record<string, unknown>
  expect(body.options).toBeUndefined()
})
