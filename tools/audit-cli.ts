import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseCard } from '../src/lib/content/parse.js'
import { parseBlock } from '../src/lib/content/block.js'
import { parseTrack } from '../src/lib/content/track.js'
import { auditLibrary, checkIdLock } from '../src/lib/content/audit.js'
import { parseDemoHeader, auditDemoSnapshots } from '../src/lib/content/demo-code.js'
import { LEDGER_FILE, parseLedger } from '../src/lib/content/exclusion.js'
import type { ExclusionLedger } from '../src/lib/content/exclusion.js'
import type { Card } from '../src/lib/content/types.js'
import type { Block } from '../src/lib/content/block.js'
import type { Track } from '../src/lib/content/track.js'

const CONTENT_DIR = 'content'
const LOCK_FILE = join(CONTENT_DIR, '.ids.lock')

function walk(dir: string, matches: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p, matches)
    return matches(name) ? [p] : []
  })
}

const files = walk(CONTENT_DIR, n => n.endsWith('.md'))
const cards: Card[] = []
const issues: string[] = []

for (const f of files) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) cards.push(r.card)
  else issues.push(...r.issues)
}

const blocks: Block[] = []
for (const f of walk(CONTENT_DIR, n => n === 'block.yml')) {
  const r = parseBlock(readFileSync(f, 'utf8'), f)
  if (r.ok) blocks.push(r.block)
  else issues.push(...r.issues)
}

// 岗位包：content/tracks/*.yml（目录允许不存在——P0 之前的老库没有它）
const tracks: Track[] = []
for (const f of walk(join(CONTENT_DIR, 'tracks'), n => n.endsWith('.yml'))) {
  const r = parseTrack(readFileSync(f, 'utf8'), f)
  if (r.ok) tracks.push(r.track)
  else issues.push(...r.issues)
}

// 账本：缺失 = 首次运行 → 闸门只警告不报错（否则一上线就永久红）
let ledger: ExclusionLedger | undefined
if (existsSync(LEDGER_FILE)) {
  const parsed = parseLedger(readFileSync(LEDGER_FILE, 'utf8'))
  if (parsed.ok) ledger = parsed.ledger
  else issues.push(...parsed.issues)
}

// 互斥判定闸门（设计文档 §7.1）：三层候选对必须都在账本里且指纹未过期，
// 卡文件的 excludeAsDistractorFor 必须等于账本 yes 的投影。纯计算，不调 LLM。
const categories = new Map(blocks.map(b => [b.id, b.category] as const))
const { errors, warnings } = auditLibrary(cards, blocks, tracks, { categories, ledger })
issues.push(...errors)

if (existsSync(LOCK_FILE)) {
  const locked = readFileSync(LOCK_FILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  issues.push(...checkIdLock(cards, locked))
}

// demo 快照闸门（spec §6）：content/**/*.java 头标记 ↔ 文件名/题卡/目录 一致
const demoFacts = walk(CONTENT_DIR, n => n.endsWith('.java')).map(f => {
  const h = parseDemoHeader(readFileSync(f, 'utf8'))
  return {
    file: relative(CONTENT_DIR, f).split('\\').join('/'),
    headerUlid: h?.ulid ?? '',
    headerBlock: h?.block ?? '',
  }
})
// 孤儿判定按「块/卡」同目录路径（spec §6），不是全库 ULID 存在性——块错位漂移靠它抓
const knownCardPaths = new Set(cards.map(c => `${c.blockId}/${c.id}`))
// manifest 对账（规则 4，spec §8）：GitHub 外链清单与快照一一对应；文件缺失传 undefined
const manifestFile = join(CONTENT_DIR, 'demo-manifest.json')
const manifestKeys = existsSync(manifestFile)
  ? new Set(Object.keys(JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, string>))
  : undefined
issues.push(...auditDemoSnapshots(demoFacts, knownCardPaths, manifestKeys))

if (process.argv.includes('--write-lock')) {
  // 卡 id 和要点 id 都要锁。spec §8.1 的 review_log.distractorIds 存的是
  // **要点 id**，§4.2 也写"互斥登记、漏点统计、干扰项引用都指向它" ——
  // 只锁卡 id 的话，要点改名/删除一样让历史日志悬空，而守卫看不见。
  const ids = [
    ...cards.map(c => `card:${c.id}`),
    ...cards.flatMap(c => c.keyPoints.map(kp => `kp:${c.blockId}/${kp.id}`)),
  ].sort()
  writeFileSync(LOCK_FILE, ids.join('\n') + '\n', 'utf8')
  console.log(`已写入 ${LOCK_FILE}（${ids.length} 个 id）`)
}

console.log(`解析 ${files.length} 张卡文件、${blocks.length} 个块、${tracks.length} 个岗位包`)
// 警告不拦构建，但必须打印 —— 「整层还没判」「账本有悬空条目」这类事实只能在这里看见
for (const w of warnings) console.log(`  ! ${w}`)
if (issues.length > 0) {
  console.error(`\n发现 ${issues.length} 个问题：`)
  for (const i of issues) console.error(`  - ${i}`)
  process.exit(1)
}
console.log('内容审计通过')
