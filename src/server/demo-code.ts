/**
 * Demo 快照 loader（fs 留在 server 层，与 SQL 同级不下沉 lib；spec §4）。
 * 同步签名 + 模块级 memo：content/ 是只读快照，进程内缓存即可——顺带避免
 * settings 保存路径里 buildDailyPayload 的即弃调用白做 N 次读盘。
 * 两种失败刻意不同：content/ 整体缺失 = 部署事故，throw（防「功能整体不可见
 * 还零报错」的静默漂移）；单卡无快照 = 正常态，null。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { stripDemoHeader, demoSourceUrl } from '../lib/content/demo-code.js'

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

/**
 * GitHub 外链（spec §8）：读 demo-manifest.json（ULID → 源仓相对路径）拼 URL。
 * 与 loadDemoCode 的失败语义不同——**外链是增强功能，全部降级为 null 不抛错**：
 * manifest 缺失（旧部署）/ 卡无键，只是少一个链接，代码展示主体不受影响。
 * manifest 按 baseDir 整体 memo（一次读盘、进程内复用）。
 */
const manifestMemo = new Map<string, Record<string, string> | null>()

function demoManifest(baseDir: string): Record<string, string> | null {
  if (manifestMemo.has(baseDir)) return manifestMemo.get(baseDir)!
  const file = join(baseDir, 'demo-manifest.json')
  let parsed: Record<string, string> | null = null
  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
      // 值全字符串才算可用（畸形生成物/半合并状态一律降级 null，不拼坏 URL）
      if (raw !== null && typeof raw === 'object'
        && Object.values(raw).every(v => typeof v === 'string')) {
        parsed = raw as Record<string, string>
      } else {
        console.warn('demo-manifest.json 结构异常（值须全字符串），GitHub 外链降级')
      }
    } catch {
      console.warn('demo-manifest.json 解析失败（合并冲突/损坏？），GitHub 外链降级')
    }
  }
  manifestMemo.set(baseDir, parsed)
  return parsed
}

export function loadDemoSourceUrl(cardId: string, baseDir = 'content'): string | null {
  const manifest = demoManifest(baseDir)
  const relPath = manifest?.[cardId]
  return relPath === undefined ? null : demoSourceUrl(relPath)
}
