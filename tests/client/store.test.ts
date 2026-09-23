import { memoryStore } from '../../src/client/store.js'
import type { Submission } from '../../src/server/types.js'

const mk = (id: string): Submission => ({ submissionId: id, cardId: 'c', reviewedAtMs: 0, kind: 'selection', selected: [0] })

test('SubmissionStore：入队、全取、按 id 移除', async () => {
  const { submissions } = memoryStore()
  await submissions.enqueue(mk('a'))
  await submissions.enqueue(mk('b'))
  expect((await submissions.all()).map(s => s.submissionId)).toEqual(['a', 'b'])
  await submissions.remove(['a'])
  expect((await submissions.all()).map(s => s.submissionId)).toEqual(['b'])
})

test('SubmissionStore：同 submissionId 入队幂等去重（不塞两条）', async () => {
  const { submissions } = memoryStore()
  await submissions.enqueue(mk('a'))
  await submissions.enqueue(mk('a'))
  expect(await submissions.all()).toHaveLength(1)
})

test('PayloadCache：save/load 往返', async () => {
  const { cache } = memoryStore()
  expect(await cache.load()).toBeNull()
  const p = { today: '2026-09-23', mode: 'sprint', queue: [], prepared: [], cards: [], progress: { done: 0, total: 0 } } as never
  await cache.save(p)
  expect(await cache.load()).toEqual(p)
})
