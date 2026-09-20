import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseCard } from '../../src/lib/content/parse.js'
import { buildPairs, countPairs } from './pairs.js'
import { screenPairs, type Scorer } from './recall.js'
import { registerDecision } from './register.js'
import type { Card } from '../../src/lib/content/types.js'

const blockId = process.argv[2]
if (!blockId) {
  console.error('用法: pnpm review:pairs <blockId> [--confirm]')
  process.exit(1)
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return walk(p)
    return p.endsWith('.md') ? [p] : []
  })
}

const fileOf = new Map<string, string>()
const cards: Card[] = []
const broken: string[] = []
for (const f of walk('content')) {
  const r = parseCard(readFileSync(f, 'utf8'), f)
  if (r.ok) { cards.push(r.card); fileOf.set(r.card.id, f) }
  else broken.push(...r.issues)
}

// 解析失败必须中止，不能跳过。跳过的后果是：那张卡的要点不进组合、
// 也不进干扰项池，审核者以为这个块已经确认完了 —— 而漏掉的互斥
// 会在出题时变成"这条其实也对"的废题，且没有任何地方会报出来。
if (broken.length > 0) {
  console.error(`有 ${broken.length} 个内容问题，先修好再做互斥确认：`)
  for (const b of broken) console.error(`  - ${b}`)
  process.exit(1)
}

const total = countPairs(cards, blockId)
const pending = buildPairs(cards, blockId)
console.log(`块 ${blockId}：组合总数 ${total}，其中未登记 ${pending.length} 组`)

// 占位打分器：按要点文本与目标题面的字符重合度粗筛。
// 接入真实 LLM 时替换此函数即可，screenPairs 的契约不变。
const scorer: Scorer = async (p) => {
  const a = new Set(p.keyPointText)
  const b = new Set(p.targetQuestion)
  const inter = [...a].filter(c => b.has(c)).length
  return inter / Math.max(a.size, 1)
}

const flagged = await screenPairs(pending, scorer, 0.35)
console.log(`预筛标出 ${flagged.length} 组待人工确认（${((flagged.length / Math.max(pending.length, 1)) * 100).toFixed(1)}%）`)

if (!process.argv.includes('--confirm')) {
  console.log('加 --confirm 进入逐条确认。')
  process.exit(0)
}

// 不用 readline/promises 的 rl.question：stdin 到 EOF（管道输入耗尽或 Ctrl-D）时
// 它永远不 resolve，顶层 await 卡死、进程崩退出码 13，而本轮已答的判定已写回一半。
// 改成自己维护一个「行队列 + 等待者」：'line' 事件入队，'close' 事件置 EOF 标志。
// ask() 优先取队列里已到的行 —— 这保证管道里 EOF 前的最后一行答案不会被 close 抢掉
// （早先用 Promise.race 竞速会丢掉紧挨 EOF 的那一行）；队列空且已 EOF 则当作 q 收尾。
const rl = createInterface({ input: process.stdin, output: process.stdout })
const lineQueue: string[] = []
let inputEnded = false
let waiter: ((line: string | null) => void) | null = null

rl.on('line', line => {
  if (waiter) { const w = waiter; waiter = null; w(line) }
  else lineQueue.push(line)
})
rl.on('close', () => {
  inputEnded = true
  if (waiter) { const w = waiter; waiter = null; w(null) }
})

/** 取下一行答案。返回 null 表示输入已结束（EOF），调用方按退出处理。 */
function nextLine(): Promise<string | null> {
  if (lineQueue.length > 0) return Promise.resolve(lineQueue.shift()!)
  if (inputEnded) return Promise.resolve(null)
  return new Promise(resolve => { waiter = resolve })
}

async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt)
  const line = await nextLine()
  return line === null ? 'q' : line.trim().toLowerCase()
}

let registered = 0
let independent = 0
for (const [i, f] of flagged.entries()) {
  console.log(`\n[${i + 1}/${flagged.length}] ${f.reason}`)
  console.log(`  要点（来自 ${f.pair.ownerCardId}）：${f.pair.keyPointText}`)
  console.log(`  目标题：${f.pair.targetQuestion}`)
  const ans = await ask('  这条要点对目标题也成立吗？[y/n/s 跳过/q 退出] ')
  if (ans === 'q') break
  if (ans === 's') continue

  const file = fileOf.get(f.pair.ownerCardId)
  if (!file) { console.error(`  找不到源文件：${f.pair.ownerCardId}`); continue }

  // 两种答案都要落盘。只记"是"的话，答过"否"的组合下次重跑会原样再问一遍，
  // 而重跑是常态 —— 工具会反复消耗它本该保护的那 25-60 小时人工成果。
  const decision = ans === 'y' ? 'exclude' : 'independent'
  writeFileSync(file, registerDecision(readFileSync(file, 'utf8'), f.pair.keyPointId, f.pair.targetCardId, decision), 'utf8')
  if (decision === 'exclude') { registered++; console.log('  已登记互斥') }
  else { independent++; console.log('  已记录"不成立"，下次不再问') }
}
await rl.close()
console.log(`\n本轮：互斥 ${registered} 条，判定不成立 ${independent} 条。记得跑 pnpm content:audit。`)
