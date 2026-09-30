import { browserApi } from '../../src/client/api.js'

test('postReview：POST /api/review，2xx 解析 JSON', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ score: { num: 1, den: 1 } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const r = await browserApi().postReview({ submissionId: 's', cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0] })
  expect(fetchMock).toHaveBeenCalledWith('/api/review', expect.objectContaining({ method: 'POST' }))
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
  expect(fetchMock).toHaveBeenCalledWith('/api/billing/redeem',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'ABCD-EFGH-JKMN-PQRS' }) }))
  expect(r.outcome).toBe('fulfilled')
  vi.unstubAllGlobals()
})

test('后台两接口：GET 台账 / POST 铸码走 /api/backstage/invites', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  await browserApi().fetchInviteCodes()
  expect(fetchMock).toHaveBeenLastCalledWith('/api/backstage/invites', expect.objectContaining({ method: 'GET' }))
  await browserApi().postMintInvites(3, '备注')
  expect(fetchMock).toHaveBeenLastCalledWith('/api/backstage/invites',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ n: 3, note: '备注' }) }))
  vi.unstubAllGlobals()
})
