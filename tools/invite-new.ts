/**
 * 铸邀请码 CLI：`pnpm invite:new <数量> [备注]`
 * 例：pnpm invite:new 5 内测第一批
 * 明文码只在此刻打印一次（库里只有 sha256）——关掉终端就再也找不回，
 * 请当场复制保存并发给要解锁的人。
 */
import { getDb } from '../src/server/db/client.js'
import { mintInviteCodes } from '../src/server/invite.js'

const [countRaw, ...noteParts] = process.argv.slice(2)
const count = Number(countRaw)
if (!Number.isInteger(count) || count < 1) {
  console.error('用法：pnpm invite:new <数量≥1> [备注]')
  console.error('例：pnpm invite:new 5 内测第一批')
  process.exit(1)
}
const note = noteParts.join(' ') || null

const codes = await mintInviteCodes({ db: getDb() }, count, note)
console.log(`已铸 ${codes.length} 张邀请码${note !== null ? `（${note}）` : ''}：`)
for (const c of codes) console.log(`  ${c}`)
console.log('明文仅此一次——库里只有哈希，请立即复制保存。')
