import { sql } from 'drizzle-orm'
import { beforeEach, afterEach, describe, expect, test } from 'vitest'
import { createTestDb, type TestDb } from './helpers.js'
import {
  createCardReport, listCardReports, resolveCardReport, openReportCountsByCard,
} from '../../src/server/card-report.js'
import { reportSnapshotOf } from '../../src/lib/ai/admin-qa.js'
import type { CardReportSnapshot, ReportTurn } from '../../src/lib/ai/admin-qa.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

/**
 * 问题报告 SQL 层集成测试（PGlite）：创建/列表/销单/计数的全生命周期。
 * 管理员鉴权在路由层（requireAdminUserId），这里只测持久化行为。
 */

const SNAPSHOT: CardReportSnapshot = {
  blockId: 'java/generics', blockName: '泛型', cardType: 'enumeration',
  question: '什么是类型擦除？',
  keyPoints: [{ id: 'kp-1', text: '编译期擦除类型参数' }],
  detail: '入门<!--advanced-->进阶',
  contentPath: 'content/java/generics/01ABC.md',
}

const TURNS: ReportTurn[] = [
  { role: 'user', content: '这条要点对吗' },
  { role: 'assistant', content: '表述有歧义，建议改为……' },
]

let t: TestDb
beforeEach(async () => { t = await createTestDb() })
afterEach(async () => { await t.pg.close() })

function runner(): SqlRunner { return t.db as unknown as SqlRunner }

describe('card_reports 生命周期', () => {
  test('创建 → open 列表可见，快照与讨论记录原样往返（jsonb）', async () => {
    const id = await createCardReport(
      { db: runner() }, { cardId: '01ABC', conclusion: '要点表述歧义', turns: TURNS, snapshot: SNAPSHOT })
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)   // ULID

    const rows = await listCardReports({ db: runner() }, { status: 'open' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id, cardId: '01ABC', status: 'open', conclusion: '要点表述歧义',
      transcript: TURNS, snapshot: SNAPSHOT, resolvedAt: null,
    })
    expect(rows[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('销单：open→resolved 幂等安全，resolved_at 落时间；重复销/不存在 → false', async () => {
    const id = await createCardReport(
      { db: runner() }, { cardId: '01ABC', conclusion: 'c', turns: TURNS, snapshot: SNAPSHOT })
    expect(await resolveCardReport({ db: runner() }, id, 1_000)).toBe(true)
    expect(await resolveCardReport({ db: runner() }, id, 2_000)).toBe(false)   // 已销不再重写时间
    expect(await resolveCardReport({ db: runner() }, 'nope')).toBe(false)

    const [row] = await listCardReports({ db: runner() })
    expect(row!.status).toBe('resolved')
    expect(row!.resolvedAt).toBe(new Date(1_000).toISOString())
  })

  test('open 计数按卡分组（learn 页防重复提交的 chip 数据源）；销单后计数减一', async () => {
    for (const card of ['01A', '01A', '01B']) {
      await createCardReport(
        { db: runner() }, { cardId: card, conclusion: 'c', turns: TURNS, snapshot: SNAPSHOT })
    }
    const counts = await openReportCountsByCard({ db: runner() })
    expect(Object.fromEntries(counts)).toEqual({ '01A': 2, '01B': 1 })

    const rowB = (await listCardReports({ db: runner() }, { status: 'open' })).find(r => r.cardId === '01B')!
    await resolveCardReport({ db: runner() }, rowB.id)
    const after = await openReportCountsByCard({ db: runner() })
    expect(Object.fromEntries(after)).toEqual({ '01A': 2 })   // 01B 归零后从分组里消失
  })

  test('列表全量不过滤状态；transcript 畸形（非数组）行容错为空', async () => {
    // 直接塞一条畸形行，模拟未来格式漂移时的读侧防御
    await runner().execute(sql`insert into card_reports (id, card_id, status, conclusion, transcript, snapshot)
      values ('r0', '01A', 'open', '老行', '"not-an-array"'::jsonb,
              ${JSON.stringify(reportSnapshotOf({ cardId: 'x', blockId: 'b', question: 'q', detail: '' }))}::jsonb)`)
    const rows = await listCardReports({ db: runner() })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.transcript).toEqual([])
  })
})
