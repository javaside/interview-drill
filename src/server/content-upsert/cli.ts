import { getDb } from '../db/client.js'
import { runUpsert } from './run.js'

/**
 * 内容 upsert CLI（`pnpm content:upsert`）。生产连 PG（DATABASE_URL 决定驱动）。
 * 校验失败 → runUpsert 抛错 → 非零退出，不落库半成品。
 */
async function main(): Promise<void> {
  const r = await runUpsert(getDb())
  console.log(`已 upsert：${r.blocks} 块 / ${r.cards} 卡 / ${r.keyPoints} 要点`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
