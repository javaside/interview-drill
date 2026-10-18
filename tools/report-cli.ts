/**
 * 审题报告 CLI（管理员审题闭环的线下半场）：
 * - `pnpm report:pull [--all]`   把 open 报告导出为 docs/card-reports/<id>.md（--all 含已销单）
 * - `pnpm report:resolve <id>`   销单：DB 置 resolved，并删除对应导出文件
 *
 * 环境变量同 invite:new（tsx --env-file-if-exists=.env.local）：DATABASE_URL 从
 * .env.local 或内联 `DATABASE_URL=... pnpm report:pull` 提供。
 * 导出目录 docs/card-reports/ 在 .gitignore——文件是工单不是档案（历史档案在 DB，
 * --all 可随时重导），改完题、resolve 时即删。
 */
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../src/server/db/client.js'
import { listCardReports, resolveCardReport } from '../src/server/card-report.js'
import { renderReportMarkdown } from '../src/lib/ai/admin-qa.js'

const EXPORT_DIR = 'docs/card-reports'

function fileOf(id: string): string {
  return join(EXPORT_DIR, `${id}.md`)
}

async function pull(includeResolved: boolean): Promise<void> {
  const rows = await listCardReports({ db: getDb() })
  const targets = rows.filter(r => includeResolved || r.status === 'open')
  if (targets.length === 0) {
    console.log(includeResolved ? '库里有 0 条报告。' : '没有未处理的报告——干净。')
    return
  }
  await mkdir(EXPORT_DIR, { recursive: true })
  let written = 0
  let skipped = 0
  for (const r of targets) {
    const file = fileOf(r.id)
    // 幂等：已存在的文件不覆盖（开发者可能正在其中做笔记）
    try {
      await writeFile(file, renderReportMarkdown({
        id: r.id, cardId: r.cardId, createdAt: r.createdAt,
        conclusion: r.conclusion, turns: r.transcript, snapshot: r.snapshot,
      }), { flag: 'wx' })
      written++
      console.log(`✎ ${file}  [${r.status}] ${r.conclusion}`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        skipped++
      } else {
        throw e
      }
    }
  }
  console.log(`\n导出 ${written} 份${skipped > 0 ? `，${skipped} 份已存在跳过` : ''}。`)
  console.log('处理完（或判定不用改）后：pnpm report:resolve <id>  ——销单并删除对应文件。')
}

async function resolve(id: string): Promise<void> {
  if (id === '') {
    console.error('用法：pnpm report:resolve <报告id>')
    process.exit(1)
  }
  const ok = await resolveCardReport({ db: getDb() }, id)
  if (!ok) {
    console.error(`报告 ${id} 不存在，或已经不是 open 状态。`)
    process.exit(1)
  }
  await rm(fileOf(id), { force: true })   // 导出文件不存在（没 pull 过）也照样销单
  console.log(`已销单 ${id}（DB 置 resolved，导出文件已清理）。`)
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'pull') {
  await pull(args.includes('--all'))
} else if (cmd === 'resolve') {
  await resolve(args[0] ?? '')
} else {
  console.error('用法：pnpm report:pull [--all] | pnpm report:resolve <id>')
  process.exit(1)
}
