/**
 * 邀请码（在线支付上线前的解锁通道，§10.1 的 /upgrade 页内兑现）：
 * 一次性码、库存只存 sha256 哈希（库被拖走泄不了未用码）。
 *
 * 兑换语义（redeemInvite，事务内）：
 * 1. 已 paid → already，**不消耗码**（码留给别人，重复兑不吓已解锁用户）；
 * 2. 条件更新原子占码（used_at is null 才中）——并发同码只有一人赢；
 * 3. 占码成功 → plan 置 paid（与 upgradeToPaid 同语义，同事务提交）；
 * 4. 占不着（不存在/已用/格式不对）→ 统一抛「邀请码无效或已被使用」——
 *    不区分原因，防枚举探测。
 */
import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import type { SqlRunner } from './db/adapters.js'

export type RedeemOutcome = 'fulfilled' | 'already'

export const INVITE_INVALID = '邀请码无效或已被使用'

/** Crockford base32（去 I/L/O/U，与项目 ULID 字符集同源） */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_BODY_LEN = 16   // 4 组 × 4 字符，80 bit 熵

/** 规整用户输入：大写、去空格与横线——手敲格式差异不惩罚 */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '')
}

/** 明文码（规整后）→ sha256 hex。生成落库与兑换查询共用同一把尺 */
export function inviteCodeHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex')
}

/** 生成一张码：XXXX-XXXX-XXXX-XXXX（明文仅生成时展示一次，库里只有哈希） */
export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_BODY_LEN)
  let body = ''
  for (let i = 0; i < CODE_BODY_LEN; i++) {
    body += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return body.match(/.{4}/g)!.join('-')
}

/**
 * 兑换：核心安全边界在「条件更新占码」——不存在 TOCTOU（占码与读结果原子）。
 * 已 paid 早退在事务外语义等价（占码写入只发生在 free 路径）。
 */
export async function redeemInvite(
  deps: { db: SqlRunner }, userId: string, rawCode: string,
): Promise<RedeemOutcome> {
  const normalized = normalizeInviteCode(rawCode)
  if (normalized.length !== CODE_BODY_LEN) throw new Error(INVITE_INVALID)
  const hash = inviteCodeHash(normalized)

  return deps.db.transaction(async tx => {
    const planRow = await tx.execute<{ plan: string }>(sql`
      select plan from user_settings where user_id = ${userId}`)
    if (planRow.rows[0]?.plan === 'paid') return 'already' as const

    const claimed = await tx.execute<{ id: string }>(sql`
      update invite_codes set used_by = ${userId}, used_at = now()
      where code_hash = ${hash} and used_at is null
      returning id`)
    if (claimed.rows.length === 0) throw new Error(INVITE_INVALID)

    await tx.execute(sql`
      update user_settings set plan = 'paid', free_block_ids = '[]'::jsonb, updated_at = now()
      where user_id = ${userId}`)
    return 'fulfilled' as const
  })
}

/**
 * 铸码（CLI invite:new 的可测内核）：n 张一次性码，明文只出现在返回值里
 * （库里只有哈希）——调用方（CLI）负责打印，打印完这批明文就再也没法找回。
 */
export async function mintInviteCodes(
  deps: { db: SqlRunner }, n: number, note: string | null,
): Promise<string[]> {
  if (!Number.isInteger(n) || n < 1) throw new Error(`铸码数量必须是 ≥1 的整数，收到 ${n}`)
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    const code = generateInviteCode()
    await deps.db.execute(sql`
      insert into invite_codes (id, code_hash, note) values (${ulid()}, ${inviteCodeHash(normalizeInviteCode(code))}, ${note})`)
    codes.push(code)
  }
  return codes
}
