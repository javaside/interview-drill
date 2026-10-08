import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDemoCode } from '../../src/server/demo-code.js'

const ULID = '01M3M39N0Z840CFBC8RWQ0R8FV'
const JAVA = `package x;

/**
 * 题目：t
 * 题卡：${ULID}
 * 块：java/generics
 */
public class D { void m() {} }
`

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'demo-code-'))
  mkdirSync(join(dir, 'java/generics'), { recursive: true })
  writeFileSync(join(dir, `java/generics/${ULID}.java`), JAVA)
  return dir
}

test('读到快照 → 剥头后返回；同参二次调用走 memo（返回一致）', () => {
  const base = makeRepo()
  try {
    const code = loadDemoCode('java/generics', ULID, base)
    expect(code).not.toBeNull()
    expect(code).toContain('public class D')
    expect(code).not.toContain('题卡：')
    expect(loadDemoCode('java/generics', ULID, base)).toBe(code)
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('单卡无 demo → null（正常态，不是错误）', () => {
  const base = makeRepo()
  try {
    expect(loadDemoCode('java/generics', '01M3M39N0ZZZZZZZZZZZZZZZZZZ', base)).toBeNull()
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('剥头失败（快照无标记）→ throw（loud）', () => {
  const base = mkdtempSync(join(tmpdir(), 'demo-code-'))
  try {
    mkdirSync(join(base, 'java/generics'), { recursive: true })
    writeFileSync(join(base, 'java/generics/01M3M39N0Z840CFBC8RWQ0R9.java'), 'class NoHeader {}\n')
    expect(() => loadDemoCode('java/generics', '01M3M39N0Z840CFBC8RWQ0R9', base)).toThrow('题卡')
  } finally { rmSync(base, { recursive: true, force: true }) }
})

// ---- GitHub 外链 loader（spec §8 增量）----

import { loadDemoSourceUrl } from '../../src/server/demo-code.js'
import { writeFileSync as wfs } from 'node:fs'

test('loadDemoSourceUrl：manifest 命中 → GitHub URL；无 manifest 文件 / 无键 → null', () => {
  const base = makeRepo()
  try {
    wfs(join(base, 'demo-manifest.json'), JSON.stringify({ [ULID]: 'java/src/main/java/com/interview/java/generics/D.java' }))
    expect(loadDemoSourceUrl(ULID, base))
      .toBe('https://github.com/javaside/interview-code/blob/main/java/src/main/java/com/interview/java/generics/D.java')
    expect(loadDemoSourceUrl('01M3M39N0ZZZZZZZZZZZZZZZZZZ', base)).toBeNull()
    // memo：同 base 二次调用返回一致
    expect(loadDemoSourceUrl(ULID, base)).toContain('github.com')
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('loadDemoSourceUrl：manifest 文件缺失 → null（外链是增强功能，降级不抛错）', () => {
  const base = makeRepo()
  try {
    expect(loadDemoSourceUrl(ULID, base)).toBeNull()
  } finally { rmSync(base, { recursive: true, force: true }) }
})
