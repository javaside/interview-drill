/**
 * pnpm demo:sync —— 把 interview-code 的 Demo 类快照进 content/（spec §3）。
 * 三道闸门防静默事故：源仓不存在 / 0 个带标记文件（除非 --allow-empty）/ 只删带题卡标记的 .java。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { parseDemoHeader } from '../../src/lib/content/demo-code.js'
import { computeSyncPlan, manifestOf, type DemoSource, type ExistingSnapshot } from './plan.js'

const CONTENT_DIR = 'content'
const MANIFEST_FILE = 'demo-manifest.json'
const DEMO_REPO = process.env.DEMO_REPO ?? '../interview-code'
const allowEmpty = process.argv.includes('--allow-empty')

function walk(dir: string, matches: (name: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const rel = relative('.', p)
    if (statSync(p).isDirectory()) {
      if (rel.split(/[\\/]/).includes('target')) continue   // Maven 编译产物
      walk(p, matches, out)
    } else if (matches(name)) out.push(p)
  }
  return out
}

// 闸门 1：源仓不存在 → loud 退出（CI/服务器上没有兄弟仓，绝不能当「全空」处理）
if (!existsSync(DEMO_REPO)) {
  console.error(`源仓不存在：${DEMO_REPO}（可用 env DEMO_REPO 覆盖）`)
  process.exit(1)
}

const sources: DemoSource[] = []
const unrecognized: string[] = []
const seen = new Map<string, string>()
for (const f of walk(DEMO_REPO, n => n.endsWith('.java'))) {
  const text = readFileSync(f, 'utf8')
  const h = parseDemoHeader(text)
  if (h === null) { unrecognized.push(f); continue }
  const dup = seen.get(h.ulid)
  if (dup !== undefined) {
    console.error(`同一 ULID 出现两次：${h.ulid}\n  ${dup}\n  ${f}`)
    process.exit(1)
  }
  seen.set(h.ulid, f)
  sources.push({ ulid: h.ulid, block: h.block, source: text, origin: relative(DEMO_REPO, f).split('\\').join('/') })
}

// 闸门 2：0 个带标记文件 → 默认拒绝（防把全部现存快照判成孤儿删光）
if (sources.length === 0 && !allowEmpty) {
  console.error('源仓没有解析到任何带「题卡：」标记的 .java——拒绝清空快照（确需清空用 --allow-empty）')
  process.exit(1)
}

// 现存快照（闸门 3 的体现：孤儿判定只针对这里 walk 到的 .java）
const existing: ExistingSnapshot[] = walk(CONTENT_DIR, n => n.endsWith('.java'))
  .map(f => ({ file: relative(CONTENT_DIR, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }))

const plan = computeSyncPlan(sources, existing)

for (const w of plan.write) {
  const abs = join(CONTENT_DIR, w.file)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, w.source)
}
for (const r of plan.remove) unlinkSync(join(CONTENT_DIR, r))

// GitHub 外链清单（spec §8）：ULID → 源仓相对路径；内容有变化才重写（幂等；首次运行文件不存在直接写）
const manifestPath = join(CONTENT_DIR, MANIFEST_FILE)
const manifest = manifestOf(sources)
const manifestChanged = !existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifest
if (manifestChanged) writeFileSync(manifestPath, manifest)

console.log(`demo:sync 完成——写入 ${plan.write.length}，跳过 ${plan.skip.length}，删除 ${plan.remove.length}，未识别 ${unrecognized.length}，manifest ${manifestChanged ? '已更新' : '无变化'}（${sources.length} 键）`)
for (const u of unrecognized) console.log(`  未识别（无题卡标记，跳过）：${u}`)
for (const r of plan.remove) console.log(`  删除：${r}`)
