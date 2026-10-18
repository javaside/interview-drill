import { sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import type { SqlRunner } from './db/adapters.js'
import type { CardReportSnapshot, ReportTurn } from '../lib/ai/admin-qa.js'

/**
 * 题卡问题报告的 SQL 层（审题闭环的持久化半场）：创建 / 列表 / 销单 / 计数。
 * 业务清洗与渲染在 lib/ai/admin-qa（纯核），本层只做 IO 与行映射。
 * 管理员鉴权在路由层（requireAdminUserId），本层不重复判——被调到即视为已过闸。
 */

export type CardReportRow = {
  id: string
  cardId: string
  status: 'open' | 'resolved'
  conclusion: string
  transcript: ReportTurn[]
  snapshot: CardReportSnapshot
  createdAt: string   // ISO
  resolvedAt: string | null
}

type DbRow = {
  id: string; card_id: string; status: string; conclusion: string
  transcript: ReportTurn[]; snapshot: CardReportSnapshot
  /** PGlite 回字符串、node-postgres 回 Date——两侧归一成 ISO（同 adapters 的 new Date 口径） */
  created_at: string | Date; resolved_at: string | Date | null
}

function toRow(r: DbRow): CardReportRow {
  return {
    id: r.id,
    cardId: r.card_id,
    status: r.status === 'resolved' ? 'resolved' : 'open',
    conclusion: r.conclusion,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    snapshot: r.snapshot,
    createdAt: new Date(r.created_at).toISOString(),
    resolvedAt: r.resolved_at === null ? null : new Date(r.resolved_at).toISOString(),
  }
}

/** 提交报告：ULID 铸 id，status 起步 open。transcript/snapshot 已由调用方纯核清洗。 */
export async function createCardReport(
  deps: { db: SqlRunner },
  input: { cardId: string; conclusion: string; turns: ReportTurn[]; snapshot: CardReportSnapshot },
): Promise<string> {
  const id = ulid()
  await deps.db.execute(sql`
    insert into card_reports (id, card_id, status, conclusion, transcript, snapshot)
    values (${id}, ${input.cardId}, 'open', ${input.conclusion},
            ${JSON.stringify(input.turns)}::jsonb, ${JSON.stringify(input.snapshot)}::jsonb)`)
  return id
}

/** 列表（默认全量，台账用；pull 只取 open）。新的在前，同刻按 id 序稳定。 */
export async function listCardReports(
  deps: { db: SqlRunner; },
  opts: { status?: 'open' | 'resolved' } = {},
): Promise<CardReportRow[]> {
  const rows = opts.status === undefined
    ? await deps.db.execute<DbRow>(sql`
        select id, card_id, status, conclusion, transcript, snapshot, created_at, resolved_at
        from card_reports order by created_at desc, id desc`)
    : await deps.db.execute<DbRow>(sql`
        select id, card_id, status, conclusion, transcript, snapshot, created_at, resolved_at
        from card_reports where status = ${opts.status} order by created_at desc, id desc`)
  return rows.rows.map(toRow)
}

/**
 * 销单：open → resolved（幂等安全——已 resolved 再销返回 false，不报错不重写时间）。
 * 不存在也 false；路由/CLI 据此回「报告不存在或已处理」。
 */
export async function resolveCardReport(
  deps: { db: SqlRunner }, id: string, nowMs: number = Date.now(),
): Promise<boolean> {
  const hit = await deps.db.execute<{ id: string }>(sql`
    update card_reports set status = 'resolved', resolved_at = ${new Date(nowMs)}
    where id = ${id} and status = 'open'
    returning id`)
  return hit.rows.length > 0
}

/** 每张卡的 open 报告数（learn 页管理员视角的「已有 N 条未处理」chip，防重复提交） */
export async function openReportCountsByCard(deps: { db: SqlRunner }): Promise<Map<string, number>> {
  const rows = await deps.db.execute<{ card_id: string; n: string }>(sql`
    select card_id, count(*)::text as n from card_reports
    where status = 'open' group by card_id`)
  const out = new Map<string, number>()
  for (const r of rows.rows) out.set(r.card_id, Number(r.n))
  return out
}
