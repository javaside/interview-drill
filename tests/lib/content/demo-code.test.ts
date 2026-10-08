import {
  parseDemoHeader, stripDemoHeader, auditDemoSnapshots,
} from '../../../src/lib/content/demo-code.js'

const DEMO = `package com.interview.java.generics;

/**
 * 题目：什么是桥方法？
 * 题卡：01M3M39N0Z840CFBC8RWQ0R8FV
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - 擦除让父/子方法签名对不上
 */
public class BridgeMethodDemo {
    /** 方法注释：不是头，不能被剥 */
    void run() { }
}
`

test('parseDemoHeader：提取 ULID 与块', () => {
  expect(parseDemoHeader(DEMO)).toEqual({
    ulid: '01M3M39N0Z840CFBC8RWQ0R8FV', block: 'java/generics',
  })
})

test('parseDemoHeader：无题卡标记返回 null（非题卡辅助类）', () => {
  expect(parseDemoHeader('/** 普通注释 */\nclass A {}')).toBeNull()
})

test('parseDemoHeader：license 头在前，仍取含题卡标记的块', () => {
  const src = `/*\n * MIT License\n */\n${DEMO}`
  expect(parseDemoHeader(src)?.ulid).toBe('01M3M39N0Z840CFBC8RWQ0R8FV')
})

test('stripDemoHeader：剥含题卡标记的块，保留方法注释，拼接处空行归一', () => {
  const r = stripDemoHeader(DEMO)
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.code).not.toContain('题卡：')
    expect(r.code).not.toContain('要点口径')
    expect(r.code).toContain('package com.interview.java.generics;')
    expect(r.code).toContain('public class BridgeMethodDemo {')
    expect(r.code).toContain('方法注释：不是头，不能被剥')
    expect(r.code.startsWith('package com.interview.java.generics;\n\npublic class')).toBe(true)
  }
})

test('stripDemoHeader：无题卡标记 → loud 失败', () => {
  const r = stripDemoHeader('/** 普通注释 */\nclass A {}')
  expect(r.ok).toBe(false)
})

test('auditDemoSnapshots：三条规则（ULID≠文件名 / 孤儿 / 块标记≠目录）', () => {
  // 入参语义：全库卡的 <blockId>/<cardId> 路径集合（同块的卡存在；java/string 的卡不存在）
  const knownCardPaths = new Set([
    'java/generics/01M3M39N0Z840CFBC8RWQ0R8FV',
    'java/hashmap/01M3M39N0Z840CFBC8RWQ0R8FV', // 让块错位用例只触发规则 3，隔离单规则
  ])
  const facts = [
    // 正常：全过
    { file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FV.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
    // 头 ULID 与文件名不一致
    { file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FX.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
    // 孤儿：同目录没有同名 .md（java/string 下无此卡）
    { file: 'java/string/01M3M39N0X12RYG621PWMWKSR4.java', headerUlid: '01M3M39N0X12RYG621PWMWKSR4', headerBlock: 'java/string' },
    // 块标记与目录不一致（该目录下有 .md，隔离规则 3）
    { file: 'java/hashmap/01M3M39N0Z840CFBC8RWQ0R8FV.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
  ]
  // manifest 与快照一致（规则 4 零贡献，保持单规则隔离）
  const manifestKeys = new Set([
    '01M3M39N0Z840CFBC8RWQ0R8FV', '01M3M39N0X12RYG621PWMWKSR4',
  ])
  const issues = auditDemoSnapshots(facts, knownCardPaths, manifestKeys)
  expect(issues).toHaveLength(3)
  expect(issues.some(s => s.includes('ULID 与文件名不一致'))).toBe(true)
  expect(issues.some(s => s.includes('孤儿'))).toBe(true)
  expect(issues.some(s => s.includes('块标记') && s.includes('不一致'))).toBe(true)
})

test('auditDemoSnapshots：孤儿按同目录判定——同 ULID 在别的目录有 .md 也报孤儿', () => {
  // 块错位/挪块漂移：已知卡在 java/string/<ULID>，快照却在 java/generics/<ULID>.java——
  // 旧实现（全库查 ULID 存在性）放行，必须按同目录路径判孤儿
  const knownCardPaths = new Set(['java/string/01M3M39N0Z840CFBC8RWQ0R8FV'])
  const facts = [
    { file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FV.java', headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics' },
  ]
  const issues = auditDemoSnapshots(facts, knownCardPaths, new Set(['01M3M39N0Z840CFBC8RWQ0R8FV']))
  expect(issues).toHaveLength(1)
  expect(issues[0]!.includes('孤儿') && issues[0]!.includes('java/generics/01M3M39N0Z840CFBC8RWQ0R8FV.md')).toBe(true)
})

test('auditDemoSnapshots：空入参零问题', () => {
  expect(auditDemoSnapshots([], new Set(), new Set())).toEqual([])
})

// ---- GitHub 外链（spec §8 后续项，2026-10-08 增量）----

import { demoSourceUrl } from '../../../src/lib/content/demo-code.js'

test('demoSourceUrl：仓库常量 + blob/main 拼接', () => {
  expect(demoSourceUrl('java/src/main/java/com/interview/java/generics/BridgeMethodDemo.java'))
    .toBe('https://github.com/javaside/interview-code/blob/main/java/src/main/java/com/interview/java/generics/BridgeMethodDemo.java')
})

const FACT_OK = {
  file: 'java/generics/01M3M39N0Z840CFBC8RWQ0R8FV.java',
  headerUlid: '01M3M39N0Z840CFBC8RWQ0R8FV', headerBlock: 'java/generics',
}
const PATHS_OK = new Set(['java/generics/01M3M39N0Z840CFBC8RWQ0R8FV'])

test('audit 规则4：有快照但 manifest 缺失 → 报错', () => {
  const issues = auditDemoSnapshots([FACT_OK], PATHS_OK, undefined)
  expect(issues.some(s => s.includes('demo-manifest') && s.includes('缺失'))).toBe(true)
})

test('audit 规则4：manifest 键与快照一致 → 零新增；有差异 → 报差异', () => {
  expect(auditDemoSnapshots([FACT_OK], PATHS_OK, new Set(['01M3M39N0Z840CFBC8RWQ0R8FV']))).toEqual([])
  const diff = auditDemoSnapshots([FACT_OK], PATHS_OK, new Set(['01M3M39N0X12RYG621PWMWKSR4']))
  expect(diff.some(s => s.includes('manifest') && (s.includes('01M3M39N0X12RYG621PWMWKSR4') || s.includes('01M3M39N0Z840CFBC8RWQ0R8FV')))).toBe(true)
})

test('audit 规则4：无快照但 manifest 有键 → 报错；两者皆空 → 零问题', () => {
  expect(auditDemoSnapshots([], new Set(), new Set(['01M3M39N0X12RYG621PWMWKSR4'])).some(s => s.includes('manifest'))).toBe(true)
  expect(auditDemoSnapshots([], new Set(), new Set())).toEqual([])
})
