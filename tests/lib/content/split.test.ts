import { splitDetail, splitBold, splitBlocks } from '../../../src/lib/content/split.js'

test('splitDetail：带分层标记 → 入门版/进阶版', () => {
  const { intro, advanced } = splitDetail('零基础能懂。\n\n<!--advanced-->\n面试深度细节。')
  expect(intro).toBe('零基础能懂。')
  expect(advanced).toBe('面试深度细节。')
})

test('splitDetail：无标记 → 全文为入门版，进阶为空（旧内容兼容）', () => {
  const { intro, advanced } = splitDetail('只有一层的老讲解。')
  expect(intro).toBe('只有一层的老讲解。')
  expect(advanced).toBe('')
})

test('splitBold：**术语** → 粗体段（奇数段 bold）', () => {
  expect(splitBold('草稿本就是 **undo log**，很关键')).toEqual([
    { text: '草稿本就是 ', bold: false },
    { text: 'undo log', bold: true },
    { text: '，很关键', bold: false },
  ])
})

test('splitBold：无标记 → 单段非粗体', () => {
  expect(splitBold('普通文本')).toEqual([{ text: '普通文本', bold: false }])
})

test('splitBlocks：纯段落 → 单个 p 块', () => {
  expect(splitBlocks('第一段')).toEqual([{ kind: 'p', text: '第一段' }])
})

test('splitBlocks：空行分隔多段落', () => {
  expect(splitBlocks('段落一。\n\n段落二。')).toEqual([
    { kind: 'p', text: '段落一。' },
    { kind: 'p', text: '段落二。' },
  ])
})

test('splitBlocks：连续 - 行聚合为无序列表', () => {
  expect(splitBlocks('前置说明：\n- 甲\n- 乙\n\n后文。')).toEqual([
    { kind: 'p', text: '前置说明：' },
    { kind: 'ul', items: ['甲', '乙'] },
    { kind: 'p', text: '后文。' },
  ])
})

test('splitBlocks：连续 1. 行聚合为有序列表', () => {
  expect(splitBlocks('步骤：\n1. 先建连\n2. 再发请求')).toEqual([
    { kind: 'p', text: '步骤：' },
    { kind: 'ol', items: ['先建连', '再发请求'] },
  ])
})

test('splitBlocks：代码块整体成 code 块，语言标记与内部换行保留', () => {
  expect(splitBlocks('用法：\n```sql\nBEGIN;\nUPDATE t SET x=1;\n```\n完事。')).toEqual([
    { kind: 'p', text: '用法：' },
    { kind: 'code', lang: 'sql', code: 'BEGIN;\nUPDATE t SET x=1;' },
    { kind: 'p', text: '完事。' },
  ])
})

test('splitBlocks：无语言标记的代码块 lang 为空串', () => {
  expect(splitBlocks('```\nplain\n```')).toEqual([{ kind: 'code', lang: '', code: 'plain' }])
})

test('splitBlocks：代码块内部的 ** 与 - 不被解析（原样保留）', () => {
  const blocks = splitBlocks('```\n**not bold**\n- not list\n```')
  expect(blocks).toEqual([{ kind: 'code', lang: '', code: '**not bold**\n- not list' }])
})

test('splitBlocks：段落与列表混排顺序保持（真实卡面形状）', () => {
  const blocks = splitBlocks('两者都去首尾空白：\n\n- **trim()**：只认 ASCII\n- **strip()**：按 Unicode\n\n现代代码用 strip。')
  expect(blocks).toEqual([
    { kind: 'p', text: '两者都去首尾空白：' },
    { kind: 'ul', items: ['**trim()**：只认 ASCII', '**strip()**：按 Unicode'] },
    { kind: 'p', text: '现代代码用 strip。' },
  ])
})
