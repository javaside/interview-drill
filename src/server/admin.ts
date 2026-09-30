/**
 * 后台（/backstage）管理员判定：github_id 白名单制。
 * 名单来自环境变量 ADMIN_GITHUB_IDS（逗号分隔的 GitHub 数字 id）——
 * 不建 role 列、无迁移，增删管理员 = 改 env 重启。
 * 安全部署提示：名单空 = 无人可管（fail closed）。
 */
import { sql } from 'drizzle-orm'
import type { SqlRunner } from './db/adapters.js'

/** 环境变量原文 → 干净的 id 集合（容忍空格；空串给空集） */
export function parseAdminGithubIds(raw: string): Set<string> {
  return new Set(raw.split(',').map(s => s.trim()).filter(s => s !== ''))
}

/**
 * userId 是否管理员：session 只有 userId，比对 users.github_id ∈ 名单。
 * userId 无 users 行（理论不可达）→ false 不炸。
 */
export async function isAdminUser(
  deps: { db: SqlRunner; adminGithubIds: string }, userId: string,
): Promise<boolean> {
  const allow = parseAdminGithubIds(deps.adminGithubIds)
  if (allow.size === 0) return false
  const row = await deps.db.execute<{ github_id: string }>(sql`
    select github_id from users where id = ${userId}`)
  const githubId = row.rows[0]?.github_id
  return githubId !== undefined && allow.has(githubId)
}
