/**
 * 互斥判定（excludeAsDistractorFor）的**唯一枚举器与账本**。
 *
 * 要解决的问题：判分只看归属（ownIds），不属于本卡的要点一律判错。兄弟题的真话
 * 一旦被抽成本题干扰项，用户按题意勾它就被判错（用户线上实测：
 * java/exceptions 的「返回 finally 的值：…」出现在《final、finally、finalize
 * 分别是什么？》里，判 3/4）。修法是在出题**前**把这类要点从池里剔掉。
 *
 * 结构（设计文档 §5.1 的两阶段）：
 *
 * ```
 * 判定（烧钱）  content:exclusion --judge   → 账本（yes 与 no 都记）
 * 投影（免费）  content:exclusion --apply   → 卡文件的 excludeAsDistractorFor
 * 闸门（免费）  content:audit               → 未判定 / 指纹过期 / 投影漂移 = 红
 * ```
 *
 * **账本是判定状态的单一来源**，卡文件是它的运行时投影（`drawDistractors` 读卡文件）。
 * 「是」写进卡文件是因为跑题时要读它；「否」不写（一条要点平均要对 60 道目标题判否，
 * 满写一张 4 要点卡涨约 10KB，九成是 ULID，卡文件必须保持人可读）。
 *
 * 为什么不用「话题词重合」这类近似判据：实测精度不够（随机抽 40 组真命中近乎为零），
 * 且纯中文要点有召回洞 —— 判定标准必须可校准（§3），故改用 LLM 直判 + 人工抽检。
 */
import type { Card, CardType } from './types.js'
import { layerOf } from '../options/layers.js'
import type { DistractorLayer } from '../options/layers.js'
import { MIN_BLOCK_POOL } from './pool.js'
import { fnv1a } from '../options/rng.js'

/** 判定标准的版本。**写在仓库代码里，不取自 env** —— 否则开发机换个 key 就触发整体重跑 */
export const JUDGE_VERSION = 'v1'

/** 账本位置（相对仓库根）。卡文件与账本都在 content/ 下，一起进 git */
export const LEDGER_FILE = 'content/.exclusion-ledger'

/** 闸门单类问题最多列几条（首次接入会是十万级，全量打印等于刷屏） */
const MAX_LISTED = 20

export type CandidatePair = {
  layer: DistractorLayer
  /** 干扰项所属的卡 */
  ownerCardId: string
  ownerBlockId: string
  keyPointId: string
  keyPointText: string
  /** 被问「这条对你也成立吗」的目标题 */
  targetCardId: string
  targetBlockId: string
  targetQuestion: string
}

/** 账本主键。卡 id 全局唯一、要点 id 只保证块内唯一 → 必须带卡 id（§8 的跨块撞车） */
export function pairKey(p: Pick<CandidatePair, 'ownerCardId' | 'keyPointId' | 'targetCardId'>): string {
  return `${p.ownerCardId}/${p.keyPointId}|${p.targetCardId}`
}

/**
 * 内容指纹 = 判定的**全部输入**（目标题题干 + 候选要点文本）的短哈希。
 *
 * 判据是「只读题干」，所以内容一变旧判定就不成立，而账本原样保留会静默失效。
 * 上游 review 的第 2 步是整批题干改写（改到答案封闭）—— 没有这条指纹，那批动作
 * 会一次性制造大量陈旧判定。
 */
export function fingerprintOf(keyPointText: string, targetQuestion: string): string {
  return (fnv1a(`${keyPointText}\u0000${targetQuestion}`) >>> 0).toString(16).padStart(8, '0')
}

/**
 * 三层候选对枚举。口径与 `drawDistractors` 逐字对齐：
 *
 * - 候选 = **其他卡的未退役要点**（退役要点永不被抽，不判）
 * - **目标侧排除 sequence**：`prepare` 的 sequence 分支直接返回、`drawDistractors`
 *   在那之后才调用，结构上不可能受害。但 sequence 卡的**要点照旧进池**（池装配
 *   不看 cardType），所以只在「目标题」一侧排除
 * - 目标卡自己退役 → 不出题，不判
 * - `ownIds`：与目标卡要点撞 id 的候选会被运行时静默剔除（§8 的跨块撞车，
 *   不在本设计范围）——这里同样剔除，免得登记一条运行时根本不会抽的组合
 *
 * **按全量要点枚举，不按 public 剪枝**：付费用户抽的是全量池，剪枝等于把付费用户
 * 的坑放回线上（全库 public 要点仅 15.9%）。
 *
 * 输出按键排序 —— 调用方（文件系统 walk）的行序不确定，而账本 diff 必须稳定。
 */
export function enumerateCandidatePairs(
  cards: readonly Card[],
  categories: ReadonlyMap<string, string> = new Map(),
): CandidatePair[] {
  const live = cards.filter(c => !c.retiredAt)
  const out: CandidatePair[] = []
  for (const target of live) {
    if (target.cardType === 'sequence') continue
    const ownIds = new Set(target.keyPoints.map(kp => kp.id))
    for (const owner of live) {
      if (owner.id === target.id) continue
      const layer = layerOf(target.blockId, owner.blockId, categories)
      if (layer === null) continue
      for (const kp of owner.keyPoints) {
        if (kp.retiredAt) continue
        if (ownIds.has(kp.id)) continue
        out.push({
          layer,
          ownerCardId: owner.id,
          ownerBlockId: owner.blockId,
          keyPointId: kp.id,
          keyPointText: kp.text,
          targetCardId: target.id,
          targetBlockId: target.blockId,
          targetQuestion: target.question,
        })
      }
    }
  }
  out.sort((a, b) => (pairKey(a) < pairKey(b) ? -1 : 1))
  return out
}

// ---- 账本 ----

export type Verdict = 'yes' | 'no'

export type LedgerEntry = { verdict: Verdict; fingerprint: string }

export type LedgerHeader = {
  judgeVersion: string
  provider: string
  model: string
  generatedAt: string
}

export type ExclusionLedger = {
  header: LedgerHeader
  /** 主键 → 判定。**yes 与 no 都记**：账本是判定状态的单一来源 */
  entries: Map<string, LedgerEntry>
}

export function emptyLedger(header: Partial<LedgerHeader> = {}): ExclusionLedger {
  return {
    header: {
      judgeVersion: JUDGE_VERSION, provider: '', model: '', generatedAt: '',
      ...header,
    },
    entries: new Map(),
  }
}

export type LedgerParseResult =
  | { ok: true; ledger: ExclusionLedger }
  | { ok: false; issues: string[] }

/**
 * 账本格式（§6.1）：
 *
 * ```
 * # judge=v1 provider=deepseek model=deepseek-flash generated=2026-10-04T12:00:00Z
 * <ownerCardId>/<keyPointId>|<targetCardId>|yes|<指纹>
 * ```
 *
 * 无法识别的行**直接报错**，不静默跳过（照 `.ids.lock` 的先例：格式错误要么当场
 * 发现，要么变成查不出来的悬空引用）。
 */
export function parseLedger(text: string): LedgerParseResult {
  const issues: string[] = []
  const entries = new Map<string, LedgerEntry>()
  let header: LedgerHeader | null = null
  let lineNo = 0

  for (const raw of text.split('\n')) {
    lineNo++
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('#')) {
      if (header === null) {
        const fields = new Map(
          line.slice(1).trim().split(/\s+/).filter(Boolean).map(t => {
            const i = t.indexOf('=')
            return i < 0 ? [t, ''] as const : [t.slice(0, i), t.slice(i + 1)] as const
          }),
        )
        header = {
          judgeVersion: fields.get('judge') ?? '',
          provider: fields.get('provider') ?? '',
          model: fields.get('model') ?? '',
          generatedAt: fields.get('generated') ?? '',
        }
        if (header.judgeVersion === '') issues.push(`${LEDGER_FILE}:${lineNo} 头部缺少 judge=<判据版本>`)
      }
      continue
    }
    const parts = line.split('|')
    if (parts.length !== 4) {
      issues.push(`${LEDGER_FILE}:${lineNo} 字段数不是 4（应为 <卡>/<要点>|<目标卡>|<yes|no>|<指纹>）：${line}`)
      continue
    }
    const [owner, target, verdict, fingerprint] = parts as [string, string, string, string]
    const slash = owner.indexOf('/')
    if (slash <= 0 || slash === owner.length - 1 || target === '') {
      issues.push(`${LEDGER_FILE}:${lineNo} 主键格式无法识别：${owner}|${target}`)
      continue
    }
    if (verdict !== 'yes' && verdict !== 'no') {
      issues.push(`${LEDGER_FILE}:${lineNo} 判定只能是 yes 或 no：${verdict}`)
      continue
    }
    if (fingerprint === '') {
      issues.push(`${LEDGER_FILE}:${lineNo} 缺少内容指纹`)
      continue
    }
    const key = `${owner}|${target}`
    if (entries.has(key)) {
      issues.push(`${LEDGER_FILE}:${lineNo} 组合重复出现：${key}`)
      continue
    }
    entries.set(key, { verdict, fingerprint })
  }

  if (header === null) {
    issues.push(`${LEDGER_FILE} 缺少头部（# judge=… provider=… model=… generated=…）`)
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, ledger: { header: header!, entries } }
}

export function serializeLedger(ledger: ExclusionLedger): string {
  const h = ledger.header
  const lines = [
    `# judge=${h.judgeVersion} provider=${h.provider} model=${h.model} generated=${h.generatedAt}`,
    ...[...ledger.entries]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, e]) => `${key}|${e.verdict}|${e.fingerprint}`),
  ]
  return lines.join('\n') + '\n'
}

/** 尚未判定（或指纹过期）的组合 —— judge 的输入，幂等重跑的由来 */
export function pendingPairs(
  pairs: readonly CandidatePair[],
  ledger: ExclusionLedger,
): CandidatePair[] {
  return pairs.filter(p => {
    const e = ledger.entries.get(pairKey(p))
    if (e === undefined) return true
    return e.fingerprint !== fingerprintOf(p.keyPointText, p.targetQuestion)
  })
}

// ---- 投影 ----

/** ownerCardId → keyPointId → 该要点对哪些目标题登记互斥（排序去重，只含 yes） */
export type ExclusionProjection = ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>

/**
 * 账本 → `excludeAsDistractorFor` 的投影。只有 yes 落到卡文件；
 * 指向已不存在的卡/要点的悬空条目在此跳过（由闸门单独报）。
 */
export function projectExclusions(
  cards: readonly Card[],
  ledger: ExclusionLedger,
): ExclusionProjection {
  const known = new Map(cards.map(c => [c.id, new Set(c.keyPoints.map(kp => kp.id))] as const))
  const out = new Map<string, Map<string, Set<string>>>()
  for (const [key, entry] of ledger.entries) {
    if (entry.verdict !== 'yes') continue
    const sep = key.indexOf('|')
    const owner = key.slice(0, sep)
    const target = key.slice(sep + 1)
    const slash = owner.indexOf('/')
    const ownerCardId = owner.slice(0, slash)
    const kpId = owner.slice(slash + 1)
    if (!known.get(ownerCardId)?.has(kpId)) continue
    let byKp = out.get(ownerCardId)
    if (!byKp) { byKp = new Map(); out.set(ownerCardId, byKp) }
    let targets = byKp.get(kpId)
    if (!targets) { targets = new Set(); byKp.set(kpId, targets) }
    targets.add(target)
  }
  const frozen = new Map<string, ReadonlyMap<string, readonly string[]>>()
  for (const [cardId, byKp] of out) {
    frozen.set(cardId, new Map([...byKp].map(([kpId, s]) => [kpId, [...s].sort()] as const)))
  }
  return frozen
}

// ---- 池余量 ----

export type PoolMargin = {
  cardId: string
  blockId: string
  cardType: CardType
  /** 该卡型的同块池下界（`MIN_BLOCK_POOL`）；0 = 不抽同块干扰项 */
  need: number
  /** 同块层可用条数（免费层也不过 public —— 块已解锁） */
  sameBlock: number
  /** 同大类跨块层：付费口径（全量）与免费口径（仅 public） */
  crossFull: number
  crossPublic: number
  /** 相邻大类层：付费口径与免费口径 */
  neighborFull: number
  neighborPublic: number
}

/**
 * 每张卡的**三层池扣除后剩余量**。互斥登记会吃掉池，而触线的表现是运行时抛
 * 「干扰项池枯竭」→ 线上 500，所以 `--apply` 必须先把它打出来再落盘。
 *
 * - `exclusions` 缺省用卡文件现状；`--apply --dry-run` 传账本投影（= 将要落盘的状态）
 * - 与运行时逐字对齐：退役要点不算、与目标卡撞 id 的候选不算、已登记的排除不算
 * - `sameBlock` 对齐 `auditLibrary` 的口径（免费层同块不过 public）
 * - cross/neighbor 同时给两个口径：付费全量、免费仅 public（实测免费层 p10 为 0 条）
 */
export function poolMarginsOf(
  cards: readonly Card[],
  categories: ReadonlyMap<string, string>,
  exclusions?: ExclusionProjection,
): PoolMargin[] {
  const live = cards.filter(c => !c.retiredAt)
  const excludeOf = (ownerCardId: string, kpId: string, targetId: string, fallback: readonly string[]) =>
    (exclusions?.get(ownerCardId)?.get(kpId) ?? fallback).includes(targetId)

  const out: PoolMargin[] = []
  for (const target of live) {
    const need = MIN_BLOCK_POOL[target.cardType]
    const ownIds = new Set(target.keyPoints.map(kp => kp.id))
    const margin: PoolMargin = {
      cardId: target.id, blockId: target.blockId, cardType: target.cardType, need,
      sameBlock: 0, crossFull: 0, crossPublic: 0, neighborFull: 0, neighborPublic: 0,
    }
    for (const owner of live) {
      if (owner.id === target.id) continue
      const layer = layerOf(target.blockId, owner.blockId, categories)
      if (layer === null) continue
      for (const kp of owner.keyPoints) {
        if (kp.retiredAt) continue
        if (ownIds.has(kp.id)) continue
        if (excludeOf(owner.id, kp.id, target.id, kp.excludeAsDistractorFor)) continue
        if (layer === 'sameBlock') margin.sameBlock++
        else if (layer === 'crossBlock') {
          margin.crossFull++
          if (kp.public) margin.crossPublic++
        } else {
          margin.neighborFull++
          if (kp.public) margin.neighborPublic++
        }
      }
    }
    out.push(margin)
  }
  out.sort((a, b) => (a.cardId < b.cardId ? -1 : 1))
  return out
}

// ---- 闸门 ----

export type GateResult = { errors: string[]; warnings: string[] }

function pushCapped(bucket: string[], lead: string, items: string[]): void {
  for (const i of items.slice(0, MAX_LISTED)) bucket.push(`${lead}${i}`)
  if (items.length > MAX_LISTED) bucket.push(`${lead}…还有 ${items.length - MAX_LISTED} 条同类问题`)
}

/**
 * 完整性闸门（§7.1）：枚举三层候选对，逐组要求账本里有**未过期**的判定；
 * 卡文件的 `excludeAsDistractorFor` 必须等于账本 yes 的投影（防手改卡文件后漂移）。
 *
 * 严重度：
 * - 账本**整体缺失**（首次运行）→ 只警告，不报错（否则一上线就永久红）
 * - 其余一律报错：任一组未判定 / 指纹过期 / 卡文件与账本不一致
 *
 * 为什么不做「某一层没扫过就先放行」的分级：那会给「整层漏判」开一个静默口子 ——
 * 账本里某层一条都没有时，那一层全部组合都不报错。分层推进（§5.2 的
 * `--layer same` → 验池 → `--layer cross` → `--layer neighbor`）期间闸门确实是红的，
 * 但那只是**本地推进过程**：账本要三层判完才提交，CI 看到的账本一定是完整的。
 * 未扫过的层另有一条警告，让人知道红的是「还没判」而不是「判错了」。
 */
export function checkExclusion(
  cards: readonly Card[],
  categories: ReadonlyMap<string, string>,
  ledger: ExclusionLedger | undefined,
): GateResult {
  const errors: string[] = []
  const warnings: string[] = []
  const pairs = enumerateCandidatePairs(cards, categories)

  if (ledger === undefined) {
    warnings.push(
      `尚无互斥判定账本（${LEDGER_FILE}）：${pairs.length} 组「要点 × 目标题」候选未判定，` +
      '本次只警告不报错。生成：pnpm content:exclusion --judge',
    )
    return { errors, warnings }
  }

  if (ledger.header.judgeVersion !== JUDGE_VERSION) {
    errors.push(
      `账本判据版本是 ${ledger.header.judgeVersion || '(缺失)'}，当前代码是 ${JUDGE_VERSION} —— ` +
      '整体失效，需重跑 content:exclusion --judge',
    )
  }

  // 某一层有没有判过（只影响是否多打一条「该层尚未扫过」的警告，不影响严格度）
  const layerSeen = new Map<DistractorLayer, boolean>()
  for (const p of pairs) {
    if (ledger.entries.has(pairKey(p))) layerSeen.set(p.layer, true)
  }

  const missing = new Map<DistractorLayer, string[]>()
  const stale = new Map<DistractorLayer, string[]>()
  const addTo = (m: Map<DistractorLayer, string[]>, layer: DistractorLayer, msg: string) => {
    const list = m.get(layer)
    if (list) list.push(msg)
    else m.set(layer, [msg])
  }
  for (const p of pairs) {
    const describe = `要点 ${p.keyPointId}（卡 ${p.ownerCardId}，${p.layer}）× 《${p.targetQuestion}》`
    const entry = ledger.entries.get(pairKey(p))
    if (entry === undefined) {
      addTo(missing, p.layer, describe)
      continue
    }
    if (entry.fingerprint !== fingerprintOf(p.keyPointText, p.targetQuestion)) {
      addTo(stale, p.layer, describe)
    }
  }

  for (const layer of ['sameBlock', 'crossBlock', 'neighbor'] as const) {
    const notJudged = missing.get(layer) ?? []
    const expired = stale.get(layer) ?? []
    if (notJudged.length > 0) {
      pushCapped(errors, `未判定（${layer}）：`, notJudged)
    }
    if (expired.length > 0) {
      pushCapped(errors, `判定已过期（内容改过，${layer}）：`, expired)
    }
    if (!layerSeen.get(layer)) {
      const total = pairs.filter(p => p.layer === layer).length
      if (total > 0) {
        warnings.push(`互斥判定的 ${layer} 层尚未扫过：${total} 组候选未判定（content:exclusion --judge --layer ${layer}）`)
      }
    }
  }

  // 悬空条目：内容删改后账本里的组合已不复存在（不改变出题结果，只提示可清理）
  const liveKeys = new Set(pairs.map(pairKey))
  let dangling = 0
  for (const key of ledger.entries.keys()) if (!liveKeys.has(key)) dangling++
  if (dangling > 0) {
    warnings.push(`账本有 ${dangling} 条已不再对应任何候选组合（内容删改）—— 可用 content:exclusion --prune 清理`)
  }

  // 投影一致性：卡文件必须等于账本的 yes 投影
  const project = projectExclusions(cards, ledger)
  const drift: string[] = []
  for (const c of cards) {
    for (const kp of c.keyPoints) {
      const want = [...(project.get(c.id)?.get(kp.id) ?? [])].sort().join(',')
      const have = [...kp.excludeAsDistractorFor].sort().join(',')
      if (want !== have) {
        drift.push(`卡 ${c.id} 要点 ${kp.id}：卡文件 [${have}] ≠ 账本投影 [${want}]`)
      }
    }
  }
  pushCapped(errors, '卡文件与账本不一致：', drift)

  return { errors, warnings }
}

/** 供 CLI 打印：账本里各层的「是」率（判据漂移指标 —— 跨块/相邻层「是」率异常升高即判据崩了） */
export function verdictStatsOf(
  pairs: readonly CandidatePair[],
  ledger: ExclusionLedger,
): Array<{ layer: DistractorLayer; total: number; judged: number; yes: number }> {
  const rows = new Map<DistractorLayer, { total: number; judged: number; yes: number }>()
  for (const p of pairs) {
    const row = rows.get(p.layer) ?? { total: 0, judged: 0, yes: 0 }
    row.total++
    const e = ledger.entries.get(pairKey(p))
    if (e && e.fingerprint === fingerprintOf(p.keyPointText, p.targetQuestion)) {
      row.judged++
      if (e.verdict === 'yes') row.yes++
    }
    rows.set(p.layer, row)
  }
  return (['sameBlock', 'crossBlock', 'neighbor'] as const)
    .filter(l => rows.has(l))
    .map(l => ({ layer: l, ...rows.get(l)! }))
}
