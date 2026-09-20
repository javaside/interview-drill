import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ulid } from 'ulid'
import { renderTemplate } from './template.js'
import type { CardType } from '../../src/lib/content/types.js'

const VALID: CardType[] = ['enumeration', 'comparison', 'sequence', 'judgment', 'atomic']

const blockId = process.argv[2]
const cardType = (process.argv[3] ?? 'enumeration') as CardType

if (!blockId) {
  console.error('用法: pnpm content:new <blockId> [cardType]')
  console.error(`cardType 取值: ${VALID.join(' | ')}`)
  process.exit(1)
}
if (!VALID.includes(cardType)) {
  console.error(`未知 cardType: ${cardType}，可选 ${VALID.join(' | ')}`)
  process.exit(1)
}

const id = ulid()
const today = new Date().toISOString().slice(0, 10)
const dir = join('content', blockId)
mkdirSync(dir, { recursive: true })

const file = join(dir, `${id}.md`)
if (existsSync(file)) {
  console.error(`文件已存在（ULID 撞车，几乎不可能）：${file}`)
  process.exit(1)
}

writeFileSync(file, renderTemplate({ id, blockId, cardType, today }), 'utf8')
console.log(`已创建 ${file}`)
console.log('id 由脚手架铸造，请勿手改 —— 它挂着 review_log 与互斥登记。')
