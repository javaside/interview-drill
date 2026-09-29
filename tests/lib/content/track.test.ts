import { parseTrack } from '../../../src/lib/content/track.js'
import { auditLibrary } from '../../../src/lib/content/audit.js'

const valid = `
id: java-backend
name: Java 后端
tagline: 服务端主力岗
blocks:
  - java/hashmap
  - jvm/gc-basics
`

describe('parseTrack', () => {
  test('合法 track：id/name/tagline/有序块引用', () => {
    const r = parseTrack(valid, 'content/tracks/java-backend.yml')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.track.id).toBe('java-backend')
      expect(r.track.blocks).toEqual(['java/hashmap', 'jvm/gc-basics'])
    }
  })

  test('空块列表被拒（岗位包至少引用一个块）', () => {
    const r = parseTrack('id: x\nname: X\ntagline: t\nblocks: []', 'a.yml')
    expect(r.ok).toBe(false)
  })

  test('大写 id / 非法块引用格式被拒', () => {
    expect(parseTrack('id: JavaBackend\nname: X\ntagline: t\nblocks:\n  - java/hashmap', 'a.yml').ok).toBe(false)
    expect(parseTrack('id: x\nname: X\ntagline: t\nblocks:\n  - 不合法', 'a.yml').ok).toBe(false)
  })
})

describe('auditLibrary 的 track 校验', () => {
  const blocks = [
    { id: 'java/hashmap', status: 'ready' as const },
    { id: 'jvm/gc-basics', status: 'ready' as const },
  ]

  test('引用不存在的块 → 报错', () => {
    const r = auditLibrary([], blocks, [{ id: 't1', blocks: ['java/hashmap', 'nope/nopes'] }])
    expect(r.errors.some(e => e.includes('t1 引用了不存在的块'))).toBe(true)
  })

  test('同包内重复引用 → 报错', () => {
    const r = auditLibrary([], blocks, [{ id: 't1', blocks: ['java/hashmap', 'java/hashmap'] }])
    expect(r.errors.some(e => e.includes('t1 内块重复引用'))).toBe(true)
  })

  test('track id 重复 → 报错', () => {
    const r = auditLibrary([], blocks, [
      { id: 't1', blocks: ['java/hashmap'] },
      { id: 't1', blocks: ['jvm/gc-basics'] },
    ])
    expect(r.errors.some(e => e.includes('track id 重复'))).toBe(true)
  })

  test('合法引用 → 零错误', () => {
    const r = auditLibrary([], blocks, [{ id: 't1', blocks: ['java/hashmap', 'jvm/gc-basics'] }])
    expect(r.errors).toEqual([])
  })
})
