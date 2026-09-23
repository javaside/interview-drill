import { newSubmission, submitOne, flushQueue } from '../../src/client/sync-engine.js'
import { memoryStore } from '../../src/client/store.js'

test('newSubmission：submissionId 是 26 位 ULID，两次不同', () => {
  const a = newSubmission('c1', 0, { kind: 'selection', selected: [0] })
  const b = newSubmission('c1', 0, { kind: 'selection', selected: [0] })
  expect(a.submissionId).toHaveLength(26)
  expect(a.submissionId).not.toBe(b.submissionId)
})

test('submitOne 在线：调 postReview，不入队', async () => {
  const store = memoryStore()
  const postReview = vi.fn(async () => ({ score: { num: 1, den: 1 } } as never))
  const sub = newSubmission('c1', 0, { kind: 'selection', selected: [0] })
  const r = await submitOne({ store, api: { postReview, postSync: vi.fn() } as never, online: () => true }, sub)
  expect(r.online).toBe(true)
  expect(await store.submissions.all()).toHaveLength(0)
  expect(postReview).toHaveBeenCalledOnce()
})

test('submitOne 离线：入队、不调 postReview', async () => {
  const store = memoryStore()
  const sub = newSubmission('c1', 0, { kind: 'selection', selected: [0] })
  const r = await submitOne({ store, api: { postReview: vi.fn(), postSync: vi.fn() } as never, online: () => false }, sub)
  expect(r.online).toBe(false)
  expect(await store.submissions.all()).toHaveLength(1)
})

test('flushQueue：postSync 回放后清空已消化项（含 duplicated）', async () => {
  const store = memoryStore()
  await store.submissions.enqueue(newSubmission('c1', 0, { kind: 'selection', selected: [0] }))
  const queued = await store.submissions.all()
  const postSync = vi.fn(async () => ({ results: [{ submissionId: queued[0]!.submissionId, outcome: {} }], duplicated: [] } as never))
  await flushQueue({ store, api: { postReview: vi.fn(), postSync } as never, online: () => true })
  expect(await store.submissions.all()).toHaveLength(0)
})
