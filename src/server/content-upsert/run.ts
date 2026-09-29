import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { parseCard } from '../../lib/content/parse.js'
import { parseBlock } from '../../lib/content/block.js'
import { parseTrack } from '../../lib/content/track.js'
import type { Card } from '../../lib/content/types.js'
import type { Block } from '../../lib/content/block.js'
import type { Track } from '../../lib/content/track.js'
import type { SqlRunner } from '../db/adapters.js'

const CONTENT_DIR = 'content'

function walk(dir: string, matches: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p, matches)
    return matches(name) ? [p] : []
  })
}

/** content/ 全量解析（校验失败即抛，绝不落库半成品）。 */
function loadContent(dir: string): { cards: Card[]; blocks: Block[]; tracks: Track[] } {
  const issues: string[] = []
  const cards: Card[] = []
  for (const f of walk(dir, n => n.endsWith('.md'))) {
    const r = parseCard(readFileSync(f, 'utf8'), f)
    if (r.ok) cards.push(r.card)
    else issues.push(...r.issues)
  }
  const blocks: Block[] = []
  for (const f of walk(dir, n => n === 'block.yml')) {
    const r = parseBlock(readFileSync(f, 'utf8'), f)
    if (r.ok) blocks.push(r.block)
    else issues.push(...r.issues)
  }
  const tracks: Track[] = []
  for (const f of walk(join(dir, 'tracks'), n => n.endsWith('.yml'))) {
    const r = parseTrack(readFileSync(f, 'utf8'), f)
    if (r.ok) tracks.push(r.track)
    else issues.push(...r.issues)
  }
  if (issues.length > 0) {
    throw new Error(`内容校验失败，未落库（${issues.length} 项）：\n  - ${issues.join('\n  - ')}`)
  }
  return { cards, blocks, tracks }
}

export type UpsertResult = { blocks: number; cards: number; keyPoints: number; tracks: number }

/**
 * content/ → DB 的幂等 upsert（§7）。事务内：
 * 1. upsert blocks / cards / key_points / tracks（源为准，重跑逐字节等价）；
 * 2. tombstone：库里多出（源已删）的卡与要点置 retiredAt = CURRENT_DATE，**不物理删**
 *    ——review_log.distractorIds 引用着要点 id，删除会让历史日志悬空（§8.1）；
 * 3. 源里重现的卡/要点 retiredAt 回写为源值（通常 null）→ 自动解除 tombstone。
 * tracks 是配置数据不做 tombstone：track 下线后 user_settings.track_id 悬空，
 * UI 侧对未知 trackId 回退「全部」视图。
 * 返回处理的源计数（源确定 → 重跑结果恒等）。
 */
export async function runUpsert(db: SqlRunner, contentDir = CONTENT_DIR): Promise<UpsertResult> {
  const { cards, blocks, tracks } = loadContent(contentDir)
  const keyPointCount = cards.reduce((n, c) => n + c.keyPoints.length, 0)

  await db.transaction(async tx => {
    for (const b of blocks) {
      await tx.execute(sql`
        insert into blocks (id, name, category) values (${b.id}, ${b.name}, ${b.category})
        on conflict (id) do update set name = excluded.name, category = excluded.category`)
    }
    for (const t of tracks) {
      await tx.execute(sql`
        insert into tracks (id, name, tagline, block_ids)
        values (${t.id}, ${t.name}, ${t.tagline}, ${JSON.stringify(t.blocks)}::jsonb)
        on conflict (id) do update set
          name = excluded.name, tagline = excluded.tagline, block_ids = excluded.block_ids`)
    }
    for (const c of cards) {
      await tx.execute(sql`
        insert into cards (
          id, block_id, question, card_type, detail, follow_ups,
          applies_to, frequency, conclusion, retired_at)
        values (
          ${c.id}, ${c.blockId}, ${c.question}, ${c.cardType}, ${c.detail},
          ${JSON.stringify(c.followUps)}::jsonb, ${c.appliesTo}, ${c.frequency},
          ${c.conclusion ?? null}, ${c.retiredAt ?? null})
        on conflict (id) do update set
          block_id = excluded.block_id, question = excluded.question,
          card_type = excluded.card_type, detail = excluded.detail,
          follow_ups = excluded.follow_ups, applies_to = excluded.applies_to,
          frequency = excluded.frequency, conclusion = excluded.conclusion,
          retired_at = excluded.retired_at`)
      for (const kp of c.keyPoints) {
        await tx.execute(sql`
          insert into key_points (
            id, card_id, text, source, public, "order", exclude_as_distractor_for, retired_at)
          values (
            ${kp.id}, ${c.id}, ${kp.text}, ${JSON.stringify(kp.source)}::jsonb,
            ${kp.public}, ${kp.order ?? null}, ${JSON.stringify(kp.excludeAsDistractorFor)}::jsonb,
            ${kp.retiredAt ?? null})
          on conflict (card_id, id) do update set
            text = excluded.text, source = excluded.source, public = excluded.public,
            "order" = excluded."order",
            exclude_as_distractor_for = excluded.exclude_as_distractor_for,
            retired_at = excluded.retired_at`)
      }
    }

    // tombstone：源已删的卡与要点（仅对当前 live 的置退役，避免每跑刷新日期）
    const cardIds = cards.map(c => c.id)
    const cardList = cardIds.length > 0
      ? sql`(${sql.join(cardIds.map(id => sql`${id}`), sql`, `)})`
      : sql`(null)`
    await tx.execute(sql`
      update cards set retired_at = current_date
      where retired_at is null and id not in ${cardList}`)

    // 要点 tombstone：按 (card_id, id) 复合键判断源里是否还在
    const pairs = cards.flatMap(c => c.keyPoints.map(kp => ({ cardId: c.id, id: kp.id })))
    const pairList = pairs.length > 0
      ? sql`(${sql.join(pairs.map(p => sql`(${p.cardId}, ${p.id})`), sql`, `)})`
      : sql`((null, null))`
    await tx.execute(sql`
      update key_points set retired_at = current_date
      where retired_at is null and (card_id, id) not in ${pairList}`)
  })

  return { blocks: blocks.length, cards: cards.length, keyPoints: keyPointCount, tracks: tracks.length }
}
