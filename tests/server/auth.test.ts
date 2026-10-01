import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { requireUserIdWith, ensureUser, buildAuthOptions } from '../../src/server/auth.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

test('自定义登录页注册：/api/auth/signin 302 到 /signin（callbackUrl 自动透传）', () => {
  const options = buildAuthOptions({
    db: () => ({}) as unknown as SqlRunner,
    githubId: 'id', githubSecret: 'secret', secret: 's',
  })
  expect(options.pages?.signIn).toBe('/drill/signin')
})

test('requireUserId：无会话返回 401，有会话返回 userId（不依赖真实 OAuth）', async () => {
  const res = await requireUserIdWith(new Request('http://x'), async () => null)
  expect(res).toBeInstanceOf(Response)
  expect((res as Response).status).toBe(401)
  const ok = await requireUserIdWith(new Request('http://x'), async () => ({ userId: 'u1' }))
  expect(ok).toBe('u1')
})

test('401 带中文消息（会话过期时用户看到的是「重新登录」而不是 unauthenticated）', async () => {
  const res = (await requireUserIdWith(new Request('http://x'), async () => null)) as Response
  const body = (await res.json()) as { error: string }
  expect(body.error).toBe('登录状态已失效，请重新登录后再试')
  expect(body.error).not.toMatch(/[a-zA-Z]/)   // 正文不得出现英文，免得又漏回裸码
})

test('首次登录铸造用户与默认设置（Asia/Shanghai / free / 45），且幂等', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1')
    const rows = await t.db.execute<{ timezone: string; plan: string; daily_capacity: number }>(sql`
      select timezone, plan, daily_capacity from user_settings where user_id = ${uid}`)
    expect(rows.rows[0]).toMatchObject({ timezone: 'Asia/Shanghai', plan: 'free', daily_capacity: 45 })

    const again = await ensureUser(db, 'gh-1')   // 幂等：同 githubId 复用同一 userId
    expect(again).toBe(uid)
    const n = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from users`)
    expect(n.rows[0]!.n).toBe(1)
    const ns = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from user_settings`)
    expect(ns.rows[0]!.n).toBe(1)
  } finally {
    await t.pg.close()
  }
})

test('login（GitHub 用户名）：首登写入，之后登录跟随改名更新；幂等路径不丢', async () => {
  const t = await createTestDb()
  try {
    const db = t.db as unknown as SqlRunner
    const uid = await ensureUser(db, 'gh-1', 'octocat')
    const first = await t.db.execute<{ login: string | null }>(sql`select login from users where id = ${uid}`)
    expect(first.rows[0]!.login).toBe('octocat')

    // 老调用方不传 login（可选参数）→ 不清掉已有值
    await ensureUser(db, 'gh-1')
    const kept = await t.db.execute<{ login: string | null }>(sql`select login from users where id = ${uid}`)
    expect(kept.rows[0]!.login).toBe('octocat')

    // GitHub 改名后再登录 → 跟随更新
    await ensureUser(db, 'gh-1', 'octocat-new')
    const updated = await t.db.execute<{ login: string | null }>(sql`select login from users where id = ${uid}`)
    expect(updated.rows[0]!.login).toBe('octocat-new')
  } finally {
    await t.pg.close()
  }
})
