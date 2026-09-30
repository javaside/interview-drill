import { errorResponse } from '../../src/server/api-error.js'

test('errorResponse：Error → 400 JSON { error: message }', async () => {
  const res = errorResponse(new Error('免费层最多 2 个块，收到 3 个（§10.1）'))
  expect(res.status).toBe(400)
  await expect(res.json()).resolves.toEqual({ error: '免费层最多 2 个块，收到 3 个（§10.1）' })
})

test('errorResponse：非 Error 抛出值 → 400 通用消息（不泄内部细节）', async () => {
  const res = errorResponse('boom')
  expect(res.status).toBe(400)
  await expect(res.json()).resolves.toEqual({ error: '请求无法处理' })
})
