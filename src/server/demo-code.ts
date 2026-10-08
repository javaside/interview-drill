/**
 * Demo 快照 loader（fs 留在 server 层，与 SQL 同级不下沉 lib；spec §4）。
 * 同步签名 + 模块级 memo：content/ 是只读快照，进程内缓存即可——顺带避免
 * settings 保存路径里 buildDailyPayload 的即弃调用白做 N 次读盘。
 * 两种失败刻意不同：content/ 整体缺失 = 部署事故，throw（防「功能整体不可见
 * 还零报错」的静默漂移）；单卡无快照 = 正常态，null。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { stripDemoHeader } from '../lib/content/demo-code.js'

const memo = new Map<string, string | null>()
let contentDirChecked = false

export function loadDemoCode(
  blockId: string, cardId: string, baseDir = 'content',
): string | null {
  const key = `${baseDir}::${blockId}::${cardId}`
  if (memo.has(key)) return memo.get(key)!
  if (baseDir === 'content' && !contentDirChecked) {
    if (!existsSync('content')) {
      throw new Error('content/ 目录缺失——示例代码快照不可用，检查部署（cwd 与 rsync 排除项）')
    }
    contentDirChecked = true
  }
  let result: string | null = null
  const file = join(baseDir, blockId, `${cardId}.java`)
  if (existsSync(file)) {
    const raw = readFileSync(file, 'utf8')
    const stripped = stripDemoHeader(raw)
    if (!stripped.ok) throw new Error(`demo 快照异常 ${file}：${stripped.reason}`)
    result = stripped.code
  }
  memo.set(key, result)
  return result
}
