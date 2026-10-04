import {
  MAX_BATCH, batchPairs, buildJudgePrompt, judgeBatches, judgedEntries, parseJudgeResponse,
} from '../../../tools/content-exclusion/batch.js'
import { fingerprintOf, pairKey } from '../../../src/lib/content/exclusion.js'
import type { CandidatePair } from '../../../src/lib/content/exclusion.js'

function pair(target: string, question: string, owner: string, kp: string, text: string): CandidatePair {
  return {
    layer: 'crossBlock',
    ownerCardId: owner, ownerBlockId: `b-${owner}`,
    keyPointId: kp, keyPointText: text,
    targetCardId: target, targetBlockId: `b-${target}`, targetQuestion: question,
  }
}

/** 90 条候选分布在两道目标题上：t1 有 45 条（要切两块）、t2 有 45 条 */
function fixture(): CandidatePair[] {
  const out: CandidatePair[] = []
  for (let i = 0; i < 45; i++) out.push(pair('t1', '问题一？', `o${i}`, `k${i}`, `要点 ${i}`))
  for (let i = 0; i < 45; i++) out.push(pair('t2', '问题二？', `p${i}`, `j${i}`, `别的要点 ${i}`))
  return out
}

test('按目标题分组后切块：单批 ≤40，同题候选共享题干', () => {
  const batches = batchPairs(fixture())
  expect(batches.map(b => [b.targetCardId, b.pairs.length])).toEqual([
    ['t1', 40], ['t1', 5], ['t2', 40], ['t2', 5],
  ])
  expect(batches.every(b => b.pairs.every(p => p.targetQuestion === b.targetQuestion))).toBe(true)
  expect(MAX_BATCH).toBe(40)
})

test('prompt 带题干、编号候选与负例（判据偏「会」，负例是必须的）', () => {
  const batch = batchPairs(fixture())[0]!
  const prompt = buildJudgePrompt(batch)
  expect(prompt).toContain('《问题一？》')
  expect(prompt).toContain('[1] 要点 0')
  expect(prompt).toContain('[40] 要点 39')
  expect(prompt).not.toContain('[41]')
  expect(prompt).toContain('不算会勾的例子')
  expect(prompt).toContain('只是共享 final')
  expect(prompt).toContain('只输出一个 JSON 数组')
})

test('响应解析：代码块包裹能容忍，越界/重复/非整数/非数组一律失败', () => {
  expect(parseJudgeResponse('[3,17]', 40)).toEqual({ ok: true, yes: [3, 17] })
  expect(parseJudgeResponse('```json\n[1]\n```', 40)).toEqual({ ok: true, yes: [1] })
  expect(parseJudgeResponse('[]', 40)).toEqual({ ok: true, yes: [] })

  for (const [text, needle] of [
    ['[41]', '编号越界'],
    ['[0]', '编号越界'],
    ['[3,3]', '编号重复'],
    ['[3.5]', '不是整数'],
    ['["3"]', '不是整数'],
    ['{"yes":[3]}', '没有 JSON 数组'],
    ['完全不是 JSON', '没有 JSON 数组'],
  ] as const) {
    const r = parseJudgeResponse(text, 40)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issue).toContain(needle)
  }
})

test('判定结果落到账本条目：判「是」的记 yes，其余记 no，指纹覆盖两个输入', () => {
  const batch = batchPairs(fixture())[0]!
  const entries = judgedEntries(batch, [3, 40])
  expect(entries).toHaveLength(40)
  expect(entries[2]).toEqual({
    key: pairKey(batch.pairs[2]!),
    entry: { verdict: 'yes', fingerprint: fingerprintOf('要点 2', '问题一？') },
  })
  expect(entries[0]!.entry.verdict).toBe('no')
  expect(entries[39]!.entry.verdict).toBe('yes')
})

test('并发跑批：全部成功时逐批记录，编号映射回候选对', async () => {
  const batches = batchPairs(fixture())
  const seen: string[] = []
  const outcomes = await judgeBatches(batches, async prompt => {
    seen.push(prompt.includes('《问题一？》') ? 't1' : 't2')
    return '[1]'
  }, { concurrency: 4 })

  expect(outcomes.every(o => o.ok && o.yes.length === 1 && o.yes[0] === 1)).toBe(true)
  expect(seen).toHaveLength(4)
  expect(outcomes[0]!.batch.pairs[0]!.keyPointText).toBe('要点 0')
})

test('解析失败重试一次；仍失败 → 该批 ok=false（fail-closed，绝不写账本）', async () => {
  const batches = batchPairs(fixture()).slice(0, 1)
  let calls = 0
  const bad = await judgeBatches(batches, async () => { calls++; return '抱歉，我无法判断' }, { concurrency: 1 })
  expect(calls).toBe(2)                       // 重试了一次
  expect(bad[0]!.ok).toBe(false)
  expect(bad[0]!.attempts).toBe(2)
  expect(bad[0]!.issue).toContain('没有 JSON 数组')

  // 第一次坏、第二次好 → 成功（瞬时故障不该整批作废）
  let n = 0
  const flaky = await judgeBatches(batches, async () => (++n === 1 ? 'boom' : '[2]'), { concurrency: 1 })
  expect(flaky[0]).toMatchObject({ ok: true, yes: [2], attempts: 2 })
})

test('调用抛错同样重试后 fail-closed，错误消息带出来', async () => {
  const batches = batchPairs(fixture()).slice(0, 1)
  const outcomes = await judgeBatches(batches, async () => { throw new Error('连接超时') }, { concurrency: 1 })
  expect(outcomes[0]!.ok).toBe(false)
  expect(outcomes[0]!.issue).toContain('连接超时')
})

test('onOutcome 逐批回调（进度打印用），并发不改变结果顺序', async () => {
  const batches = batchPairs(fixture())
  const done: number[] = []
  const outcomes = await judgeBatches(batches, async p => (p.includes('《问题一？》') ? '[1]' : '[]'), {
    concurrency: 3,
    onOutcome: o => done.push(o.batch.pairs.length),
  })
  expect(done.sort((a, b) => a - b)).toEqual([5, 5, 40, 40])
  expect(outcomes.map(o => o.batch.pairs.length)).toEqual([40, 5, 40, 5])   // 输入顺序
})

test('空输入不炸（新库还没内容时）', async () => {
  expect(batchPairs([])).toEqual([])
  expect(await judgeBatches([], async () => '[]', { concurrency: 0 })).toEqual([])
})
