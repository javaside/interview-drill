/**
 * 互斥判定 CLI（设计文档 §4.3）：
 *
 * ```bash
 * pnpm content:exclusion --judge [--layer same|cross|neighbor] [--limit N] [--concurrency N]
 *     # 调 LLM 判未判定的组合，写账本。烧钱。从不改卡文件。
 * pnpm content:exclusion --apply [--dry-run]
 *     # 从账本重写卡文件 excludeAsDistractorFor。零成本、幂等。
 *     # --dry-run 只打印三层池余量（含免费口径）与预计触线的卡，不写文件。
 * pnpm content:exclusion --report [--sample N]
 *     # 抽检「是」的样本供人工复核 + 每层「是」率 + 池余量总览。
 * pnpm content:exclusion --prune [--yes]
 *     # 清理悬空/指纹过期的条目。破坏性（删的是不可再生的判定结果），需 --yes。
 * ```
 *
 * 必须用 `tsx --env-file-if-exists=.env.local` 跑（AGENTS.md 坑 2：tsx 不读 .env*），
 * 已写进 package.json 的 content:exclusion 脚本。
 */
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCard } from '../../src/lib/content/parse.js'
import { parseBlock } from '../../src/lib/content/block.js'
import {
  JUDGE_VERSION, LEDGER_FILE, checkExclusion, emptyLedger, enumerateCandidatePairs,
  fingerprintOf, pairKey, parseLedger, pendingPairs, poolMarginsOf, projectExclusions,
  serializeLedger, verdictStatsOf,
} from '../../src/lib/content/exclusion.js'
import type { CandidatePair, ExclusionLedger } from '../../src/lib/content/exclusion.js'
import type { DistractorLayer } from '../../src/lib/options/layers.js'
import type { Card } from '../../src/lib/content/types.js'
import { batchPairs, judgeBatches, judgedEntries } from './batch.js'
import type { BatchOutcome } from './batch.js'
import { makeLlmScorer, resolveProvider } from './run.js'
import type { LlmUsage } from './run.js'
import { applyExclusionsToRaw } from '../review/register.js'

const CONTENT = 'content'

/** 每处理多少批落一次盘（增量写账本的粒度，见 runJudge 的 flush） */
const FLUSH_EVERY = 25

/** 账本/统计里的层名 → CLI --layer 取值（闸门打印的修复命令也用它） */
const CLI_LAYER: Record<DistractorLayer, string> = {
  sameBlock: 'same', crossBlock: 'cross', neighbor: 'neighbor',
}

function walk(dir: string, match: (n: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return walk(p, match)
    return match(n) ? [p] : []
  })
}

// ---- 参数 ----

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const option = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const MODES = ['judge', 'apply', 'report', 'prune', 'normalize'] as const
type Mode = typeof MODES[number]

const chosen = MODES.filter(flag)
if (chosen.length !== 1) {
  console.error('用法：pnpm content:exclusion <--judge | --apply | --report | --prune> [选项]')
  console.error('  --judge  [--layer same|cross|neighbor] [--limit N] [--concurrency N] [--rejudge]')
  console.error('  --apply  [--dry-run] [--allow-touch]')
  console.error('  --report [--sample N]')
  console.error('  --prune  [--yes]')
  console.error('  --normalize [--dry-run]   # 只统一卡文件 YAML 格式，不改任何语义')
  process.exit(1)
}
const mode: Mode = chosen[0]!
const dryRun = flag('dry-run')

const LAYER_OF: Record<string, DistractorLayer> = {
  same: 'sameBlock', cross: 'crossBlock', neighbor: 'neighbor',
}
const layerArg = option('layer')
if (layerArg !== undefined && LAYER_OF[layerArg] === undefined) {
  console.error(`--layer 只接受 same / cross / neighbor，收到 ${layerArg}`)
  process.exit(1)
}
const layerFilter = layerArg === undefined ? undefined : LAYER_OF[layerArg]!

// ---- 载入内容 ----

const cards: Card[] = []
const rawOf = new Map<string, string>()
const pathOf = new Map<string, string>()
const issues: string[] = []

for (const f of walk(CONTENT, n => n.endsWith('.md'))) {
  const raw = readFileSync(f, 'utf8')
  const r = parseCard(raw, f)
  if (!r.ok) { issues.push(...r.issues); continue }
  cards.push(r.card)
  rawOf.set(r.card.id, raw)
  pathOf.set(r.card.id, f)
}
const categories = new Map<string, string>()
for (const f of walk(CONTENT, n => n === 'block.yml')) {
  const r = parseBlock(readFileSync(f, 'utf8'), f)
  if (!r.ok) { issues.push(...r.issues); continue }
  categories.set(r.block.id, r.block.category)
}

if (issues.length > 0) {
  console.error(`有 ${issues.length} 个内容问题，先修好再用本工具：`)
  for (const i of issues.slice(0, 20)) console.error(`  - ${i}`)
  process.exit(1)
}

// ---- 账本 ----

let ledger: ExclusionLedger | undefined
if (existsSync(LEDGER_FILE)) {
  const parsed = parseLedger(readFileSync(LEDGER_FILE, 'utf8'))
  if (!parsed.ok) {
    console.error(`${LEDGER_FILE} 格式有问题：`)
    for (const i of parsed.issues.slice(0, 20)) console.error(`  - ${i}`)
    process.exit(1)
  }
  ledger = parsed.ledger
}

const pairs = enumerateCandidatePairs(cards, categories)
const scoped = layerFilter === undefined ? pairs : pairs.filter(p => p.layer === layerFilter)
const describe = (p: CandidatePair) =>
  `要点 ${p.keyPointId}（卡 ${p.ownerCardId}）→ 《${p.targetQuestion}》 ${p.keyPointText}`

console.log(`内容：${cards.length} 张卡 / ${categories.size} 个块；三层候选对 ${pairs.length} 组`)
if (layerFilter !== undefined) console.log(`筛选 ${layerFilter} 层：${scoped.length} 组`)
console.log(`账本：${ledger === undefined ? '还没有（' + LEDGER_FILE + '）' : `${ledger.entries.size} 条判定`}`)

// ---- 模式 ----

async function main(): Promise<void> {
  if (mode === 'judge') await runJudge()
  else if (mode === 'apply') runApply()
  else if (mode === 'report') runReport()
  else if (mode === 'normalize') runNormalize()
  else runPrune()
}

// ---- normalize ----

/**
 * 统一卡文件的 YAML 风格（**不改任何语义**）。
 *
 * 为什么要有这条命令：写回走 `matter.stringify`，而真实卡文件是人手/脚本生成的风格
 * （`relatedBlocks:` 换行加 `[]`、`'2026-09-28'` 带单引号、`question` 带双引号）。
 * js-yaml 重新 dump 会按自己的风格重排 —— 实测 **403/404 张卡、约 1.3 万行与互斥登记
 * 无关的改动**。若不做这一步，`--apply` 那次提交会把这些 churn 和真正的登记混在一个
 * diff 里，谁也审不出来。
 *
 * 所以：先跑这条命令、单独提交一次（已实测**语义不变**：重新解析后每张卡只有
 * `excludeAsDistractorFor` 可能不同，且二次执行逐字节幂等），此后 `--apply` 的 diff
 * 就只剩真实登记。
 */
function runNormalize(): void {
  let changed = 0
  for (const c of cards) {
    if (c.retiredAt) continue
    const raw = rawOf.get(c.id)!
    // 把**文件里的现状**喂回去：只让 YAML 引擎重排格式，不让它改内容
    const current = new Map(c.keyPoints.map(kp => [kp.id, kp.excludeAsDistractorFor] as const))
    const next = applyExclusionsToRaw(raw, current)
    if (next === raw) continue
    changed++
    if (!dryRun) writeFileSync(pathOf.get(c.id)!, next, 'utf8')
  }
  console.log(
    `\n${dryRun ? '--dry-run：' : ''}格式统一的卡：${changed} / ${cards.filter(c => !c.retiredAt).length}（语义不变）。` +
    '\n建议单独提交这一次，让后续 --apply 的 diff 只剩真实登记。' +
    (changed > 0 && !dryRun ? '\n下一步：pnpm typecheck && pnpm test 确认无回归，然后单独 commit。' : ''),
  )
}
void main().catch(e => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})

// ---- judge ----

async function runJudge(): Promise<void> {
  const base = ledger ?? emptyLedger()
  const limit = option('limit') === undefined ? undefined : Number(option('limit'))
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    console.error('--limit 必须是 ≥1 的整数')
    process.exit(1)
  }
  // --rejudge：无视账本里已有的判定，把 scope 内的组合整批重判。
  // 它存在的唯一理由是**坏账本的可恢复性**：判据改了（升 JUDGE_VERSION）或抽检发现
  // 整层判错时，必须有一条 CLI 通路能把钱重花一遍；否则只剩手改 7.7MB 账本一条路。
  const rejudge = flag('rejudge')
  let todo = rejudge ? [...scoped] : pendingPairs(scoped, base)
  if (rejudge) {
    console.warn(`--rejudge：无视账本已有判定，重判 ${todo.length} 组（会重新花钱；请在批准后使用）`)
  }
  if (limit !== undefined) todo = todo.slice(0, limit)
  if (todo.length === 0) {
    console.log('没有待判定的组合（账本已覆盖）。')
    return
  }

  const concurrency = option('concurrency') === undefined ? 20 : Number(option('concurrency'))
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    console.error('--concurrency 必须是 ≥1 的整数')
    process.exit(1)
  }

  let provider
  try {
    provider = resolveProvider(process.env)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  if (base.header.provider !== '' && (base.header.provider !== provider.id || base.header.model !== provider.model)) {
    console.warn(
      `注意：账本上一次是 ${base.header.provider}/${base.header.model}，本次是 ${provider.id}/${provider.model}。` +
      '换机器不自动失效，但判据若变了需人工重跑。',
    )
  }

  const batches = batchPairs(todo)
  console.log(
    `待判定 ${todo.length} 组 → ${batches.length} 批（≤40/批）；` +
    `provider=${provider.id} model=${provider.model} 并发=${concurrency}`,
  )
  console.log('（会真实烧钱；从不改卡文件，判完请跑 --apply）')

  const started = Date.now()
  let doneBatches = 0
  let failed = 0
  let yesCount = 0
  let emptyAnswers = 0
  const usage = { promptTokens: 0, completionTokens: 0, maxPrompt: 0, maxCompletion: 0 }

  /**
   * 账本落盘的唯一入口。**必须增量写**：一次 25 分钟、上千次调用的层跑，若只在全部
   * 结束才写，中途 Ctrl-C / OOM / 断网会把整层的钱丢光（判定的产物就是账本本身）。
   * 用「临时文件 + rename」保证原子：半截文件会被 parseLedger 拒，那等于把工具锁死。
   */
  const flush = () => {
    base.header = {
      judgeVersion: JUDGE_VERSION,
      provider: provider.id,
      model: provider.model,
      generatedAt: new Date().toISOString(),
    }
    const tmp = `${LEDGER_FILE}.tmp`
    writeFileSync(tmp, serializeLedger(base), 'utf8')
    renameSync(tmp, LEDGER_FILE)
  }
  const onInterrupt = () => {
    flush()
    console.error(`\n收到中断信号：已把完成的 ${doneBatches} 批落盘（重跑本命令即从断点续判）。`)
    process.exit(130)
  }
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onInterrupt)
  const outcomes = await judgeBatches(batches, makeLlmScorer(provider, {
    // 累计真实用量（含思考 tokens）—— §11 的成本标定只认这个数；max* 用来定批次上限
    onUsage: (u: LlmUsage) => {
      usage.promptTokens += u.promptTokens
      usage.completionTokens += u.completionTokens
      usage.maxPrompt = Math.max(usage.maxPrompt, u.promptTokens)
      usage.maxCompletion = Math.max(usage.maxCompletion, u.completionTokens)
    },
  }), {
    concurrency,
    onOutcome: (o: BatchOutcome) => {
      doneBatches++
      if (!o.ok) failed++
      if (o.emptyAnswer) emptyAnswers++
      yesCount += o.yes.length
      // fail-closed：失败的批**不写账本**（这些组合保持「未判定」，闸门会因此报错）
      if (o.ok) for (const { key, entry } of judgedEntries(o.batch, o.yes)) base.entries.set(key, entry)
      if (doneBatches % FLUSH_EVERY === 0) flush()
      if (doneBatches % 10 === 0 || doneBatches === batches.length) {
        process.stdout.write(`\r  已处理 ${doneBatches}/${batches.length} 批（判「是」${yesCount} 条，失败 ${failed} 批）`)
      }
    },
  })
  {
    flush()

    const secs = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`\n完成：${batches.length - failed}/${batches.length} 批，用时 ${secs}s，新增「是」${yesCount} 条`)
    const calls = outcomes.reduce((n, o) => n + o.attempts, 0)
    const per = (n: number) => (n / Math.max(1, calls)).toFixed(0)
    console.log(
      `用量（含失败重试）：输入 ${usage.promptTokens} tokens、输出 ${usage.completionTokens} tokens（${calls} 次调用，` +
      `均 ${per(usage.promptTokens)} / ${per(usage.completionTokens)} 每批；单批峰值 ${usage.maxPrompt} / ${usage.maxCompletion}）`,
    )
    if (failed > 0) {
      console.error(`${failed} 批失败（重试后仍失败）—— 这些组合**未写账本**，仍是「未判定」，content:audit 会报错。重跑本命令即可补齐。`)
      for (const o of outcomes.filter(x => !x.ok).slice(0, 5)) {
        console.error(`  - 《${o.batch.targetQuestion}》：${o.issue}`)
      }
      process.exit(1)
    }
    const stats = verdictStatsOf(pairs, base)
    for (const s of stats) {
      const rate = s.judged === 0 ? '—' : `${((s.yes / s.judged) * 100).toFixed(1)}%`
      console.log(`  ${s.layer}：判定 ${s.judged}/${s.total}，判「是」${s.yes}（${rate}）`)
    }
    console.log('「是」率异常升高 = 判据漂移，用 --report 抽检。')
    if (emptyAnswers > 0) {
      console.warn(
        `\n注意：${emptyAnswers} 批在重试后仍回空数组（整批判「否」）。若这批集中在长候选批次，` +
        '很可能是模型没作答而不是「一条都不该勾」—— 用 --report 看每层「是」率，必要时重判。',
      )
    }
    const layerStats = verdictStatsOf(pairs, base).filter(s => layerFilter === undefined || s.layer === layerFilter)
    for (const st of layerStats) {
      if (st.judged > 0 && st.yes === 0) {
        console.warn(
          `\n注意：${st.layer} 层 ${st.judged} 条判定**全部判「否」**。这一层若本应有命中（同块/跨块层），` +
          '说明判据或通路出了问题 —— 全部判否会让闸门变绿而线上那个坑原样存在，**验收不成立**。' +
          '\n  处置：pnpm content:exclusion --report 看样本；确属判错则修 prompt 负例、升 JUDGE_VERSION，' +
          `再 pnpm content:exclusion --judge --rejudge --layer ${CLI_LAYER[st.layer]}。`,
        )
      }
    }
  }
}

// ---- apply ----

function runApply(): void {
  if (ledger === undefined) {
    console.error(`还没有账本（${LEDGER_FILE}），先跑 pnpm content:exclusion --judge`)
    process.exit(1)
  }
  const project = projectExclusions(cards, ledger)
  const margins = poolMarginsOf(cards, categories, project)

  let touching = 0
  let starvedFree = 0
  console.log('\n池余量（互斥登记落盘后的口径；! = 同块池低于下界）')
  for (const m of margins) {
    const short = m.need > 0 && m.sameBlock < m.need
    if (short) touching++
    if (m.crossPublic + m.neighborPublic === 0) starvedFree++
    console.log(
      `${short ? '!' : ' '} ${m.cardId} [${m.cardType}] ` +
      `同块 ${m.sameBlock}/${m.need}｜跨块 ${m.crossFull}(公开 ${m.crossPublic})｜相邻 ${m.neighborFull}(公开 ${m.neighborPublic})`,
    )
  }
  console.log(
    `\n触线（同块池 < 下界）：${touching} 张；免费口径跨块+相邻池为 0：${starvedFree} 张。` +
    '\n真触线的正确修法是**改内容**（给块补卡、或把题干改到答案封闭），绝不允许为了过闸门而漏登记。',
  )

  if (dryRun) {
    console.log('\n--dry-run：没有写任何文件。')
    if (touching > 0) process.exit(1)
    return
  }
  if (touching > 0 && !flag('allow-touch')) {
    console.error(
      '\n有卡触线，拒绝落盘。先按上面的办法改内容，再跑 --apply。' +
      '\n（跨块/相邻层的登记不影响 MIN_BLOCK_POOL，被卡住的往往只是同块层余量；' +
      '\n  确认要先把判定落盘、内容后补时用 --apply --allow-touch，代价是闸门会红到内容补完。）',
    )
    process.exit(1)
  }
  if (touching > 0) {
    console.warn(
      `\n--allow-touch：明知 ${touching} 张卡的同块池已低于下界，仍落盘。` +
      '\n这些卡的互斥登记是**正确的**（漏登记才是把 bug 放回线上），但必须尽快补内容，' +
      '\n否则运行时更容易走 neighbor 兜底、极端情况下抛「干扰项池枯竭」。content:audit 会一直红到补完。',
    )
  }

  let changed = 0
  for (const c of cards) {
    // 退役卡不出题、它的登记运行时也不读：不改它的文件（只制造 churn）
    if (c.retiredAt) continue
    const raw = rawOf.get(c.id)!
    const byKp = project.get(c.id) ?? new Map<string, readonly string[]>()
    const next = applyExclusionsToRaw(raw, byKp)
    if (next === raw) continue
    writeFileSync(pathOf.get(c.id)!, next, 'utf8')
    changed++
  }
  const yesEntries = [...ledger.entries.values()].filter(e => e.verdict === 'yes').length
  console.log(`\n已重写 ${changed} 张卡（账本里 ${yesEntries} 条「是」判定），其余卡文件逐字节未变。`)
  console.log('下一步：pnpm content:audit 复核（闸门应转绿）。')
}

// ---- report ----

function runReport(): void {
  if (ledger === undefined) {
    console.error(`还没有账本（${LEDGER_FILE}）`)
    process.exit(1)
  }
  const sample = option('sample') === undefined ? 100 : Number(option('sample'))
  if (!Number.isInteger(sample) || sample < 0) {
    console.error('--sample 必须是非负整数')
    process.exit(1)
  }

  console.log('\n每层判定进度与「是」率（漂移指标）：')
  for (const s of verdictStatsOf(pairs, ledger)) {
    const rate = s.judged === 0 ? '—' : `${((s.yes / s.judged) * 100).toFixed(1)}%`
    console.log(`  ${s.layer.padEnd(10)} 判定 ${String(s.judged).padStart(6)}/${String(s.total).padEnd(6)} 判「是」${String(s.yes).padStart(4)}（${rate}）`)
  }

  const yes = pairs.filter(p => {
    const e = ledger!.entries.get(pairKey(p))
    return e?.verdict === 'yes' && e.fingerprint === fingerprintOf(p.keyPointText, p.targetQuestion)
  })
  if (yes.length === 0) {
    console.error(
      '\n判「是」0 条 —— **验收不成立**：抽检没有样本可看，而这个工具的全部价值就是把' +
      '「兄弟题的真话能回答本题」找出来。请先确认判据/通路是否正常（空答案重试是否密集、' +
      'prompt 是否被截断），再决定是否重判。',
    )
  }
  console.log(`\n人工抽检样本（判「是」共 ${yes.length} 条，抽 ${Math.min(sample, yes.length)} 条；一致率 ≥90% 才算验收）：`)
  // 等步长取样：确定、可复现（不引随机源；人工复核要能按同一份清单核对两遍）
  const step = Math.max(1, Math.floor(yes.length / Math.max(1, sample)))
  for (let i = 0; i < yes.length && i / step < sample; i += step) {
    const p = yes[i]!
    console.log(`  · [${p.layer}] ${p.keyPointId}（卡 ${p.ownerCardId}）→ 《${p.targetQuestion}》\n      ${p.keyPointText}`)
  }

  console.log('\n池余量总览（当前卡文件口径）：')
  const margins = poolMarginsOf(cards, categories)
  const touching = margins.filter(m => m.need > 0 && m.sameBlock < m.need).length
  const starved = margins.filter(m => m.crossPublic + m.neighborPublic === 0).length
  console.log(`  触线 ${touching} 张；免费口径跨块+相邻池为 0 的 ${starved} 张。`)

  const gate = checkExclusion(cards, categories, ledger)
  if (gate.errors.length > 0) {
    console.log(`\n闸门现状：${gate.errors.length} 个错误（前几条）`)
    for (const e of gate.errors.slice(0, 5)) console.log(`  - ${e}`)
  } else {
    console.log('\n闸门现状：通过。')
  }
  for (const w of gate.warnings.slice(0, 5)) console.log(`  ! ${w}`)
}

// ---- prune ----

function runPrune(): void {
  if (ledger === undefined) {
    console.error(`还没有账本（${LEDGER_FILE}），没有可清理的东西`)
    return
  }
  const live = new Set(pairs.map(pairKey))
  const dangling: string[] = []
  const stale: string[] = []
  const fpByKey = new Map<string, string>()
  for (const p of pairs) fpByKey.set(pairKey(p), fingerprintOf(p.keyPointText, p.targetQuestion))
  for (const [key, entry] of ledger.entries) {
    const fp = fpByKey.get(key)
    if (fp === undefined) dangling.push(key)
    else if (fp !== entry.fingerprint) stale.push(key)
  }
  console.log(`悬空条目 ${dangling.length} 条（内容删改后已不再是候选组合）`)
  console.log(`指纹过期条目 ${stale.length} 条（内容改过，判定不再成立）`)
  for (const k of [...dangling, ...stale].slice(0, 10)) console.log(`  - ${k}`)
  if (dangling.length + stale.length === 0) return

  if (!flag('yes')) {
    console.error('\n这是破坏性操作：删掉的是**不可再生的判定结果**（恢复 = 重跑 --judge，真金白银）。')
    console.error('确认无误后加 --yes 再跑一次。')
    process.exit(1)
  }
  for (const k of [...dangling, ...stale]) ledger.entries.delete(k)
  writeFileSync(LEDGER_FILE, serializeLedger(ledger), 'utf8')
  console.log(`\n已删除 ${dangling.length + stale.length} 条，剩 ${ledger.entries.size} 条。`)
  console.log(`被删的组合若仍是候选（指纹过期的那批），闸门会报「未判定」—— 重跑 --judge 补判。`)
}
