import {
  checkExclusion, emptyLedger, enumerateCandidatePairs, pendingPairs, projectExclusions,
} from '../../../src/lib/content/exclusion.js'
import type { ExclusionLedger } from '../../../src/lib/content/exclusion.js'
import { batchPairs, judgeBatches, judgedEntries } from '../../../tools/content-exclusion/batch.js'
import { applyExclusionsToRaw } from '../../../tools/review/register.js'
import { parseCard } from '../../../src/lib/content/parse.js'
import type { Card } from '../../../src/lib/content/types.js'

/**
 * 端到端（无 LLM）：新库闸门红 → `--judge`（假 scorer，走真 prompt/解析路径）
 * → `--apply`（真写回函数）→ 闸门绿。覆盖完整闭环：枚举 → 账本 → 投影 → 卡文件 → 复核。
 *
 * 判据本身是 LLM，单测里不联网；除此之外每一步都是真代码。
 */

const rawCard = (id: string, question: string, points: Array<[string, string]>): string => `---
id: ${id}
blockId: b1
relatedBlocks: []
question: ${question}
cardType: enumeration
appliesTo: JDK 8+
frequency: mid
followUps: []
keyPoints:
${points.map(([kpId, text]) => `  - id: ${kpId}
    text: ${text}
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/a
      locator: x`).join('\n')}
---

正文
`

/** b1/b2 同大类 java → 跨块层有候选（本案踩雷的那一层）；两卡都放进 b1 会变成同块层 */
const RAW = new Map<string, string>([
  ['c1', rawCard('c1', 'final、finally、finalize 分别是什么？', [
    ['kp-c1-1', 'finally：try 块的收尾，正常或异常都会执行'],
    ['kp-c1-2', 'finalize：对象被 GC 回收前的回调钩子，已废弃'],
    ['kp-c1-3', 'final 修饰变量：只能赋值一次'],
  ])],
  ['c2', rawCard('c2', 'finally 里 return，方法返回什么？', [
    ['kp-c2-1', '返回 finally 的值：try 的返回值与异常都被丢弃'],
    ['kp-c2-2', 'ZGC 的染色指针把标记位放进地址高位'],
    ['kp-c2-3', 'try-with-resources 按声明逆序关闭'],
  ])],
])
const CATS = new Map([['b1', 'java'], ['b2', 'java'], ['c1', 'java'], ['c2', 'java']])

const parseRaw = (raw: string): Card => {
  const r = parseCard(raw, 'x.md')
  if (!r.ok) throw new Error(r.issues.join())
  return r.card
}
const parseAll = (): Card[] => [...RAW.values()].map(parseRaw)

/** 假 scorer：从**真 prompt** 里读出编号候选，判「文本含 marker 的都算会勾」 */
const yesMatching = (marker: string) => async (prompt: string): Promise<string> => {
  const hits: number[] = []
  for (const line of prompt.split('\n')) {
    const m = /^\[(\d+)\] (.*)$/.exec(line)
    if (m && m[2]!.includes(marker)) hits.push(Number(m[1]))
  }
  return JSON.stringify(hits)
}

/** 把判定结果写进账本（CLI 里 judge 模式的同一步骤） */
async function judgeInto(ledger: ExclusionLedger, cards: Card[], marker: string): Promise<void> {
  const todo = pendingPairs(enumerateCandidatePairs(cards, CATS), ledger)
  const outcomes = await judgeBatches(batchPairs(todo), yesMatching(marker), { concurrency: 3 })
  expect(outcomes.every(o => o.ok)).toBe(true)
  for (const o of outcomes) {
    for (const { key, entry } of judgedEntries(o.batch, o.yes)) ledger.entries.set(key, entry)
  }
}

const judgeState = () => emptyLedger({ provider: 'fake', model: 'fake', generatedAt: 't0' })

test('闭环：没有账本只警告 → 有账本但未判定就红 → judge → apply → 闸门绿', async () => {
  const cards = parseAll()

  // ① 首次运行：没有账本 → 只警告（否则一上线就永久红）
  const noLedger = checkExclusion(cards, CATS, undefined)
  expect(noLedger.errors).toEqual([])
  expect(noLedger.warnings.join()).toContain('尚无互斥判定账本')

  // ② 账本存在但组合未判定 → 红，且指名到要点与目标题
  const ledger = judgeState()
  const before = checkExclusion(cards, CATS, ledger)
  expect(before.errors.join()).toContain('未判定')
  expect(before.errors.join()).toContain('kp-c2-1')
  expect(before.errors.join()).toContain('《final、finally、finalize 分别是什么？》')

  // ③ judge：假 scorer 只说「返回 finally 的值」能回答那道 finally 题
  await judgeInto(ledger, cards, '返回 finally 的值')
  expect([...ledger.entries.values()].filter(e => e.verdict === 'yes')).toHaveLength(1)

  // ④ 判定阶段从不碰卡文件 —— 此刻闸门仍红（账本说是，卡文件还空着）
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('卡文件与账本不一致')

  // ⑤ apply：账本投影 → 写回卡文件（只有真变化的那张被写）
  const project = projectExclusions(cards, ledger)
  const written = new Map<string, string>()
  for (const [id, raw] of RAW) {
    const next = applyExclusionsToRaw(raw, project.get(id) ?? new Map())
    if (next !== raw) written.set(id, next)
  }
  expect([...written.keys()]).toEqual(['c2'])          // c1 逐字节未变
  expect(written.get('c2')!).toContain('- c1')         // 登记的正是目标卡 id

  // ⑥ 复核：把写回的卡文件重新解析回来，闸门绿（无错也无警告）
  const after = [...RAW].map(([id, raw]) => parseRaw(written.get(id) ?? raw))
  const gate = checkExclusion(after, CATS, ledger)
  expect(gate.errors).toEqual([])
  expect(gate.warnings).toEqual([])

  // ⑦ 幂等：再 apply 一次，逐字节不变
  for (const [id, raw] of RAW) {
    expect(applyExclusionsToRaw(written.get(id) ?? raw, project.get(id) ?? new Map()))
      .toBe(written.get(id) ?? raw)
  }
})

test('加一张新卡 → 它带来的新组合把闸门重新染红（这就是「自动更新」的强制点）', () => {
  const ledger = judgeState()
  const grown = [...parseAll(), parseRaw(rawCard('c9', '新题？', [['kp-c9-1', '新要点一'], ['kp-c9-2', '新要点二'], ['kp-c9-3', '新要点三']]))]
  const r = checkExclusion(grown, CATS, ledger)
  expect(r.errors.length).toBeGreaterThan(0)
  expect(r.errors.join()).toContain('kp-c9-1')
})

test('改题干 → 旧判定报「已过期」，须重判（改题干到答案封闭是上游的第 2 步）', async () => {
  const cards = parseAll()
  const ledger = judgeState()
  await judgeInto(ledger, cards, '返回 finally 的值')
  expect(checkExclusion(cards, CATS, ledger).errors.join()).toContain('卡文件与账本不一致')   // 还没 apply

  const edited = parseRaw(RAW.get('c1')!.replace('final、finally、finalize 分别是什么？', 'final、finally、finalize 各自的作用是什么？'))
  const r = checkExclusion([edited, parseRaw(RAW.get('c2')!)], CATS, ledger)
  expect(r.errors.join()).toContain('判定已过期')
})
