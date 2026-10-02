import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { ensureUser } from '../../src/server/auth.js'
import { redeemInvite, generateInviteCode, inviteCodeHash, normalizeInviteCode, mintInviteCodes } from '../../src/server/invite.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

/** 播种码与核心共用同一把哈希尺（规整后 sha256） */
const hashOf = (formatted: string) => inviteCodeHash(normalizeInviteCode(formatted))

async function seedCode(db: SqlRunner, code: string, note = '测试'): Promise<string> {
  const id = `ic-${code.slice(0, 6)}`
  await db.execute(sql`
    insert into invite_codes (id, code_hash, note) values (${id}, ${hashOf(code)}, ${note})`)
  return id
}

const planOf = async (db: SqlRunner, uid: string) => {
  const r = await db.execute<{ plan: string }>(sql`select plan from user_settings where user_id = ${uid}`)
  return r.rows[0]!.plan
}

/** 通行证到期时刻（权限的唯一依据，见 lib/entitlement/expiry.ts） */
const paidUntilOf = async (db: SqlRunner, uid: string): Promise<Date | null> => {
  const r = await db.execute<{ paid_until: string | null }>(sql`
    select paid_until from user_settings where user_id = ${uid}`)
  const v = r.rows[0]!.paid_until
  return v === null ? null : new Date(v)
}

/** 距今天数（四舍五入到整天，供叠加断言） */
const daysLeftOf = async (db: SqlRunner, uid: string) => {
  const d = await paidUntilOf(db, uid)
  return d === null ? null : Math.round((d.getTime() - Date.now()) / 86400_000)
}

test('free 用户兑有效码：fulfilled，通行证 +30 天，码记 used_by/used_at', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    const codeId = await seedCode(db, 'ABCD-EFGH-JKMN-PQRS')
    const out = await redeemInvite({ db }, uid, 'ABCD-EFGH-JKMN-PQRS')
    expect(out).toBe('fulfilled')
    expect(await planOf(db, uid)).toBe('paid')
    expect(await daysLeftOf(db, uid)).toBe(30)
    const row = await db.execute<{ used_by: string; used_at: string }>(sql`
      select used_by, used_at from invite_codes where id = ${codeId}`)
    expect(row.rows[0]!.used_by).toBe(uid)
    expect(row.rows[0]!.used_at).not.toBeNull()
  } finally { await t.pg.close() }
})

test('输入规整：小写/空格/无横线都能兑同一张码', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    await seedCode(db, 'ABCD-EFGH-JKMN-PQRS')
    const out = await redeemInvite({ db }, uid, '  abcd efgh-jkmnpqrs ')
    expect(out).toBe('fulfilled')
    expect(await daysLeftOf(db, uid)).toBe(30)
  } finally { await t.pg.close() }
})

test('无效码 / 已用码：抛同一句中文（不区分，防枚举），plan 不动', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const u1 = await ensureUser(db, 'gh-1')
    const u2 = await ensureUser(db, 'gh-2')
    await seedCode(db, 'ABCD-EFGH-JKMN-PQRS')
    // u1 兑走
    await redeemInvite({ db }, u1, 'ABCD-EFGH-JKMN-PQRS')
    // u2 拿同一张码 → 已用
    await expect(redeemInvite({ db }, u2, 'ABCD-EFGH-JKMN-PQRS'))
      .rejects.toThrow('邀请码无效或已被使用')
    // 根本不存在的码
    await expect(redeemInvite({ db }, u2, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'))
      .rejects.toThrow('邀请码无效或已被使用')
    // 格式乱写（长度不对）也走同一句，不泄探测信息
    await expect(redeemInvite({ db }, u2, 'abc'))
      .rejects.toThrow('邀请码无效或已被使用')
    expect(await planOf(db, u2)).toBe('free')
  } finally { await t.pg.close() }
})

test('有效期内再兑一张：叠加 30 天（不再有 already 早退），码被消耗', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    const codeId = await seedCode(db, 'ABCD-EFGH-JKMN-PQRS')
    // 已有 10 天剩余
    await db.execute(sql`
      update user_settings set plan = 'paid',
             paid_until = now() + interval '10 days' where user_id = ${uid}`)

    const out = await redeemInvite({ db }, uid, 'ABCD-EFGH-JKMN-PQRS')
    expect(out).toBe('fulfilled')
    expect(await daysLeftOf(db, uid)).toBe(40)   // 10 + 30：剩余时间被保留，不被覆盖
    const row = await db.execute<{ used_at: string | null }>(sql`
      select used_at from invite_codes where id = ${codeId}`)
    expect(row.rows[0]!.used_at).not.toBeNull()   // 叠加场景下码正常消耗
  } finally { await t.pg.close() }
})

test('过期后再兑：从当下起算 30 天（不「倒扣」），并清掉宽限结算态', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    await db.execute(sql`
      update user_settings set plan = 'paid', paid_until = now() - interval '100 days',
             grace_until = current_date, grace_block_ids = '["b1"]'::jsonb
      where user_id = ${uid}`)
    await seedCode(db, 'ABCD-EFGH-JKMN-PQRS')

    expect(await redeemInvite({ db }, uid, 'ABCD-EFGH-JKMN-PQRS')).toBe('fulfilled')
    expect(await daysLeftOf(db, uid)).toBe(30)
    const g = await db.execute<{ grace_until: string | null; grace_block_ids: string[] }>(sql`
      select grace_until, grace_block_ids from user_settings where user_id = ${uid}`)
    expect(g.rows[0]!.grace_until).toBeNull()          // 重新付费 → 宽限作废
    expect(g.rows[0]!.grace_block_ids).toEqual([])
  } finally { await t.pg.close() }
})

test('码生成：Crockford base32（无 I/L/O/U）、4 组 16 字符、哈希一致性', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateInviteCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    expect(code).not.toMatch(/[ILOU]/)
  }
  // inviteCodeHash 与规整后的 sha256 一致（CLI 落库与兑换查询共用一把尺）
  expect(inviteCodeHash('ABCDEFGHJKMNPQRS'))
    .toBe(createHash('sha256').update('ABCDEFGHJKMNPQRS').digest('hex'))
})

test('mintInviteCodes：铸 n 张未用码，明文可兑换且互不重复，note 落库', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const codes = await mintInviteCodes({ db }, 3, '内测第一批')
    expect(codes).toHaveLength(3)
    expect(new Set(codes).size).toBe(3)
    // 库里 3 行、全部未用、note 正确、哈希与明文对得上
    const rows = await db.execute<{ code_hash: string; note: string; used_at: string | null }>(sql`
      select code_hash, note, used_at from invite_codes`)
    expect(rows.rows).toHaveLength(3)
    expect(rows.rows.every(r => r.note === '内测第一批' && r.used_at === null)).toBe(true)
    expect(new Set(rows.rows.map(r => r.code_hash)))
      .toEqual(new Set(codes.map(hashOf)))
    // 铸出的明文真能兑（铸造与兑换同一把尺的最硬证明）
    const uid = await ensureUser(db, 'gh-1')
    expect(await redeemInvite({ db }, uid, codes[0]!)).toBe('fulfilled')
  } finally { await t.pg.close() }
})
