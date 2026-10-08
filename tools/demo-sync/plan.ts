/**
 * demo:sync 的同步计划纯函数（零 IO；CLI 壳在 index.ts）。
 * 语义：sync 后 content/ 下的 .java 与源仓带题卡标记的文件严格一一对应——
 * 目标路径 = content/<块Id>/<ULID>.java，不在目标路径集合里的现存快照一律删除
 * （含源仓已删的孤儿与手挪错位的旧副本）。
 */

export type DemoSource = { ulid: string; block: string; source: string }
export type ExistingSnapshot = { file: string; source: string }
export type SyncPlan = {
  write: Array<{ file: string; source: string }>
  skip: string[]
  remove: string[]
}

export function computeSyncPlan(sources: DemoSource[], existing: ExistingSnapshot[]): SyncPlan {
  // 键显式标注 string：模板字面量推断会让下方 has(f: string) 不兼容
  const targetOf = new Map<string, string>(sources.map(s => [`${s.block}/${s.ulid}.java`, s.source]))
  const existingByFile = new Map(existing.map(e => [e.file, e.source] as const))

  const write: Array<{ file: string; source: string }> = []
  const skip: string[] = []
  for (const [file, source] of targetOf) {
    if (existingByFile.get(file) === source) skip.push(file)
    else write.push({ file, source })
  }
  const remove = existing.map(e => e.file).filter(f => !targetOf.has(f))
  return { write, skip, remove }
}
