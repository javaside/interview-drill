/**
 * 判定批处理（**纯核，零 IO**）：按目标题分组 → 切块 → 构 prompt → 解析响应 → 并发/重试。
 *
 * 为什么不是逐对调用：108,891 组逐对调用是 40 倍调用量（成本与耗时都不可接受）。
 * 按目标题分组后每批 ≤40 条候选，一条目标题一次调用 —— 同一道题的候选共享题干，
 * 模型一次就能横向比较（比逐对更稳），token 也省。
 *
 * **响应格式必须定死**（否则无法写解析、无法估 token、无法界定重试）：
 *
 * ```
 * 输出：只允许一个 JSON 数组，元素是判「是」的编号，如 [3,17]
 * 解析：JSON.parse → 校验每个编号在 1..N 内且无重复 → 越界/重复/非数组 = 解析失败
 * ```
 *
 * **失败即拦住（fail-closed）**：某批调用失败或响应解析不了 → 重试一次 → 仍失败则
 * 该批不写账本。这些组合保持「未判定」，闸门因此报错。绝不把「没判」当成「判否」——
 * 静默丢弃会让漏网项无人发现（正是 §9.1 否决双模型交叉预审的那个失败模式）。
 */
import { fingerprintOf, pairKey } from '../../src/lib/content/exclusion.js'
import type { CandidatePair, LedgerEntry } from '../../src/lib/content/exclusion.js'

/** 单批候选条数上限。取 40：一条目标题平均 294 条候选 → 约 8 批/题 */
export const MAX_BATCH = 40

export type JudgeBatch = {
  targetCardId: string
  targetQuestion: string
  /** 批内候选；下标 i 对应输出编号 i+1 */
  pairs: CandidatePair[]
}

/**
 * 按目标题分组、切块。分组与批内顺序都沿用传入顺序（调用方已按键排序 →
 * 结果确定，账本 diff 稳定）。
 */
export function batchPairs(pairs: readonly CandidatePair[], size = MAX_BATCH): JudgeBatch[] {
  const byTarget = new Map<string, CandidatePair[]>()
  for (const p of pairs) {
    const list = byTarget.get(p.targetCardId)
    if (list) list.push(p)
    else byTarget.set(p.targetCardId, [p])
  }
  const out: JudgeBatch[] = []
  for (const group of byTarget.values()) {
    const first = group[0]!
    for (let i = 0; i < group.length; i += size) {
      out.push({
        targetCardId: first.targetCardId,
        targetQuestion: first.targetQuestion,
        pairs: group.slice(i, i + size),
      })
    }
  }
  return out
}

/**
 * 判定标准（§3）写死成一句话 + 校准用例作 few-shot。
 *
 * 判据天然偏向「是」：模型容易把「听起来相关」判成「会勾」，所以**必须给负例**
 * （§3.1 的三条「否」直接进 prompt）。这三条不能进单测（判据是 LLM，单测会变成
 * 联网测试），它们的效果由人工抽检验证。
 */
export const JUDGE_GUIDE = [
  '【判据】只读目标题的题干，问自己：一个称职的面试者，看到这道题，会不会把这条要点勾进去作为答案？会 → 判「会勾」。',
  '「会勾」= 这条要点在语义上能回答那个问题。**不是**「话题相关」，**不是**「共享术语」。',
  '',
  '【不算会勾的例子】',
  '- 要点「类 final + 私有 char 数组 + 不提供修改方法，共同保证不可变」／目标题《final、finally、finalize 分别是什么？》→ 不算（说的是不可变性，不是 final 是什么，只是共享 final）',
  '- 要点「数组用 Array.newInstance(cls, n)」／目标题《ArrayList 是线程安全的吗？》→ 不算（说的是反射建数组，只是共享 array）',
  '- 要点「finally 不执行的三种情况」／目标题《finally 里 return，方法返回什么？》→ 不算（说的是何时不执行，不是返回什么）',
  '',
  '【算会勾的例子】',
  '- 要点「返回 finally 的值：try 的返回值与异常都被丢弃」／目标题《final、finally、finalize 分别是什么？》→ 算（讲的正是 finally，按题意会勾）',
].join('\n')

export function buildJudgePrompt(batch: JudgeBatch): string {
  const list = batch.pairs.map((p, i) => `[${i + 1}] ${p.keyPointText}`).join('\n')
  return [
    '你在给一套面试题库做干扰项互斥审核。',
    '',
    JUDGE_GUIDE,
    '',
    `【目标题】《${batch.targetQuestion}》`,
    '',
    '【候选要点】',
    list,
    '',
    `【输出】只输出一个 JSON 数组，元素是你判「会勾」的编号（1 起），例如 [3,17]。一条都不判就输出 []。`,
    '不要输出任何解释、不要用代码块包裹、不要输出别的文字。',
  ].join('\n')
}

export type ParsedJudgeResponse =
  | { ok: true; yes: number[] }
  | { ok: false; issue: string }

/** 响应解析：越界 / 重复 / 非数组 / 非整数 一律失败（失败由调用方重试，不猜） */
export function parseJudgeResponse(text: string, size: number): ParsedJudgeResponse {
  // 容忍代码块包裹，但**不接受**「正文里恰巧有数组」—— 必须是整个响应就是一个数组，
  // 否则模型换个花样的输出（{"yes":[…]}/解释里带 []）会被静默当成判定结果。
  const cleaned = text.replace(/```[a-zA-Z]*\n?/g, '').trim()
  if (!cleaned.startsWith('[') || !cleaned.endsWith(']')) {
    return { ok: false, issue: '响应里没有 JSON 数组' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return { ok: false, issue: '响应不是合法 JSON' }
  }
  if (!Array.isArray(parsed)) return { ok: false, issue: '响应不是数组' }
  const yes: number[] = []
  for (const item of parsed) {
    if (typeof item !== 'number' || !Number.isInteger(item)) {
      return { ok: false, issue: `数组元素不是整数：${JSON.stringify(item)}` }
    }
    if (item < 1 || item > size) return { ok: false, issue: `编号越界：${item}（本批 ${size} 条）` }
    if (yes.includes(item)) return { ok: false, issue: `编号重复：${item}` }
    yes.push(item)
  }
  return { ok: true, yes }
}

/** 判定结果 → 账本条目（纯函数，不碰账本）。未判「会」的一律记 no */
export function judgedEntries(
  batch: JudgeBatch,
  yes: readonly number[],
): Array<{ key: string; entry: LedgerEntry }> {
  const yesSet = new Set(yes)
  return batch.pairs.map((p, i) => ({
    key: pairKey(p),
    entry: {
      verdict: yesSet.has(i + 1) ? 'yes' as const : 'no' as const,
      fingerprint: fingerprintOf(p.keyPointText, p.targetQuestion),
    },
  }))
}

/** 调 LLM 拿**原始响应文本**（解析与重试在外面，便于用假 scorer 测） */
export type RawScorer = (prompt: string) => Promise<string>

export type BatchOutcome = {
  batch: JudgeBatch
  /** ok=true 时的判定（1 起编号）；ok=false 表示该批**不写账本**（fail-closed） */
  ok: boolean
  yes: number[]
  /** 失败原因（打印给用户） */
  issue?: string
  /** 实际调用次数（含重试） */
  attempts: number
}

/**
 * 并发跑批：每批一次调用，解析失败或抛错 → 重试一次 → 仍失败则该批 ok=false。
 *
 * 并发用简单工作池（不引依赖）：N 个 worker 轮流取下一批。顺序无关 ——
 * 结果按传入顺序返回，写账本时按键排序，重跑幂等。
 */
export async function judgeBatches(
  batches: readonly JudgeBatch[],
  score: RawScorer,
  opts: { concurrency?: number; onOutcome?: (o: BatchOutcome) => void } = {},
): Promise<BatchOutcome[]> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 20, batches.length || 1))
  const out: BatchOutcome[] = new Array(batches.length)
  let next = 0

  const runOne = async (batch: JudgeBatch): Promise<BatchOutcome> => {
    let issue = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await score(buildJudgePrompt(batch))
        const parsed = parseJudgeResponse(text, batch.pairs.length)
        if (parsed.ok) return { batch, ok: true, yes: parsed.yes, attempts: attempt + 1 }
        issue = parsed.issue
      } catch (e) {
        issue = e instanceof Error ? e.message : String(e)
      }
    }
    return { batch, ok: false, yes: [], issue, attempts: 2 }
  }

  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= batches.length) return
      const outcome = await runOne(batches[i]!)
      out[i] = outcome
      opts.onOutcome?.(outcome)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}
