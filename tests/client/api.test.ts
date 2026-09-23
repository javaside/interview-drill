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
