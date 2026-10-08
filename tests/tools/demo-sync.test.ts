import { computeSyncPlan } from '../../tools/demo-sync/plan.js'

const S = (ulid: string, block: string, source = `// ${ulid}`, origin = `src/${ulid}.java`) =>
  ({ ulid, block, source, origin })
const E = (file: string, source = '') => ({ file, source })

test('全新快照：全部写入', () => {
  const plan = computeSyncPlan([S('A', 'java/string')], [])
  expect(plan.write).toEqual([{ file: 'java/string/A.java', source: '// A' }])
  expect(plan.remove).toEqual([])
})

test('内容一致：跳过；内容变化：重写', () => {
  const existing = [E('java/string/A.java', '// A'), E('java/string/B.java', '旧内容')]
  const plan = computeSyncPlan(
    [S('A', 'java/string'), S('B', 'java/string', '新内容')], existing)
  expect(plan.skip).toEqual(['java/string/A.java'])
  expect(plan.write).toEqual([{ file: 'java/string/B.java', source: '新内容' }])
})

test('源仓删除 → 孤儿清理；手挪错位 → 归位（旧路径删 + 新路径写）', () => {
  const existing = [
    E('java/string/GONE.java'),                       // 源仓已删 → remove
    E('java/wrongplace/A.java', '// A'),              // 手挪错位 → 旧路径 remove + 目标路径 write
  ]
  const plan = computeSyncPlan([S('A', 'java/string')], existing)
  expect(plan.remove.sort()).toEqual(['java/string/GONE.java', 'java/wrongplace/A.java'])
  expect(plan.write).toEqual([{ file: 'java/string/A.java', source: '// A' }])
})

test('空源 + 已有快照：remove 全部（由 CLI 闸门在真实环境拦截，纯函数如实反映）', () => {
  const plan = computeSyncPlan([], [E('java/string/A.java')])
  expect(plan.remove).toEqual(['java/string/A.java'])
})

// ---- manifest 产出（GitHub 外链，2026-10-08 增量）----

import { manifestOf } from '../../tools/demo-sync/plan.js'

test('manifestOf：ULID → 源相对路径，键排序稳定（幂等 diff 友好）', () => {
  const a = manifestOf([S('B', 'java/string'), S('A', 'java/generics')])
  const b = manifestOf([S('A', 'java/generics'), S('B', 'java/string')])
  expect(a).toBe(b)
  const parsed = JSON.parse(a) as Record<string, string>
  expect(Object.keys(parsed)).toEqual(['A', 'B'])
  expect(parsed.A).toBe('src/A.java')
})
