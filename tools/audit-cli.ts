import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCard } from '../src/lib/content/parse.js'
import { parseBlock } from '../src/lib/content/block.js'
import { auditLibrary, checkIdLock } from '../src/lib/content/audit.js'
import type { Card } from '../src/lib/content/types.js'
import type { Block } from '../src/lib/content/block.js'

const CONTENT_DIR = 'content'
const LOCK_FILE = join(CONTENT_DIR, '.ids.lock')

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p, ext)
    return p.endsWith(ext) ? [p] : []
  })
}

const files = walk(CONTENT_DIR, '.md')
const cards: Card[] = []
const issues: string[] = []

for (const f of files) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) cards.push(r.card)
  else issues.push(...r.issues)
}

const blocks: Block[] = []
for (const f of walk(CONTENT_DIR, 'block.yml')) {
  const r = parseBlock(readFileSync(f, 'utf8'), f)
  if (r.ok) blocks.push(r.block)
  else issues.push(...r.issues)
}

const { errors } = auditLibrary(cards, blocks)
issues.push(...errors)

if (existsSync(LOCK_FILE)) {
  const locked = readFileSync(LOCK_FILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  issues.push(...checkIdLock(cards, locked))
}

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

console.log(`解析 ${files.length} 张卡文件、${blocks.length} 个块`)
if (issues.length > 0) {
  console.error(`\n发现 ${issues.length} 个问题：`)
  for (const i of issues) console.error(`  - ${i}`)
  process.exit(1)
}
console.log('内容审计通过')
