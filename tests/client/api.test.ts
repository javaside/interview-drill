import { browserApi } from '../../src/client/api.js'

test('postReview：POST /api/review，2xx 解析 JSON', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ score: { num: 1, den: 1 } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const r = await browserApi().postReview({ submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0] })
  expect(fetchMock).toHaveBeenCalledWith('/drill/api/review', expect.objectContaining({ method: 'POST' }))
  expect((r as never as { score: unknown }).score).toEqual({ num: 1, den: 1 })
  vi.unstubAllGlobals()
})

test('postReview：非 2xx → 抛错（供 submitOne 转离线）', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
  await expect(browserApi().postReview({ submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0] })).rejects.toThrow()
  vi.unstubAllGlobals()
})

test('4xx 带 { error } body → 抛出的 Error 携带服务端消息（设置页错误展示）', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ error: '免费层最多 2 个块' }), { status: 400 })))
  await expect(browserApi().postBlocks({ blockIds: [] })).rejects.toThrow('免费层最多 2 个块')
  vi.unstubAllGlobals()
})

test('非 2xx 无 JSON body → 仍抛 HTTP 状态错误', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway timeout', { status: 504 })))
  await expect(browserApi().postSettings({ dailyCapacity: 10 })).rejects.toThrow('HTTP 504')
  vi.unstubAllGlobals()
})

test('postRedeem：POST /api/billing/redeem body={code}，2xx 解析 outcome', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ outcome: 'fulfilled' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const r = await browserApi().postRedeem('ABCD-EFGH-JKMN-PQRS')
  expect(fetchMock).toHaveBeenCalledWith('/drill/api/billing/redeem',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'ABCD-EFGH-JKMN-PQRS' }) }))
  expect(r.outcome).toBe('fulfilled')
  vi.unstubAllGlobals()
})

test('后台两接口：GET 台账 / POST 铸码走 /api/backstage/invites', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  await browserApi().fetchInviteCodes()
  expect(fetchMock).toHaveBeenLastCalledWith('/drill/api/backstage/invites', expect.objectContaining({ method: 'GET' }))
  await browserApi().postMintInvites(3, '备注')
  expect(fetchMock).toHaveBeenLastCalledWith('/drill/api/backstage/invites',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ n: 3, note: '备注' }) }))
  vi.unstubAllGlobals()
})

/** 造流式响应体（SSE 帧） */
function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(c) { for (const f of frames) c.enqueue(enc.encode(f)); c.close() },
  })
}

test('postQaStream：逐段回调 delta，请求带 /drill 前缀与 cardId', async () => {
  const fetchMock = vi.fn(async () => new Response(sseBody([
    'data: {"type":"delta","text":"第一"}\n\n',
    'data: {"type":"delta","text":"第二"}\n\n',
    'data: {"type":"done"}\n\n',
  ]), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const got: string[] = []
  await browserApi().postQaStream('c1', [{ role: 'user', content: 'q' }], t => got.push(t))

  expect(got).toEqual(['第一', '第二'])
  expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe('/drill/api/qa')
  vi.unstubAllGlobals()
})

test('postQaStream：帧被任意切分也能拼回（增量边界）', async () => {
  const raw = 'data: {"type":"delta","text":"完整内容"}\n\ndata: {"type":"done"}\n\n'
  const fetchMock = vi.fn(async () => new Response(sseBody(raw.split('').map(ch => ch)), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const got: string[] = []
  await browserApi().postQaStream('c1', [], t => got.push(t))
  expect(got).toEqual(['完整内容'])
  vi.unstubAllGlobals()
})

test('postQaStream：流开始前的失败仍是 400 中文协议（readJson 同款）', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ error: '这个块还没有解锁，先去解锁才能提问' }), { status: 400 })))
  await expect(browserApi().postQaStream('c1', [], () => {})).rejects.toThrow('这个块还没有解锁')
  vi.unstubAllGlobals()
})

test('postQaStream：带内 error 事件 → 抛中文错误（可直达 role=alert）', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(sseBody([
    'data: {"type":"delta","text":"半截"}\n\n',
    'data: {"type":"error","message":"智谱 连接中断，请重试"}\n\n',
  ]), { status: 200 })))
  await expect(browserApi().postQaStream('c1', [], () => {})).rejects.toThrow('智谱 连接中断，请重试')
  vi.unstubAllGlobals()
})

test('postQaStream：一条增量都没有 → 抛「没有返回内容」；脏帧被跳过不打断', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(sseBody([
    'data: {"type":"done"}\n\n',
  ]), { status: 200 })))
  await expect(browserApi().postQaStream('c1', [], () => {})).rejects.toThrow('AI 没有返回内容')
  vi.unstubAllGlobals()

  vi.stubGlobal('fetch', vi.fn(async () => new Response(sseBody([
    'data: 这不是 JSON\n\n',
    'data: {"type":"delta","text":"仍然可用"}\n\n',
    'data: {"type":"done"}\n\n',
  ]), { status: 200 })))
  const got: string[] = []
  await browserApi().postQaStream('c1', [], t => got.push(t))
  expect(got).toEqual(['仍然可用'])
  vi.unstubAllGlobals()
})
