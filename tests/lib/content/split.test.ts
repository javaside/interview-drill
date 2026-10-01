import { splitDetail, splitBold, splitItalic, splitBlocks } from '../../../src/lib/content/split.js'

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

test('splitBlocks：markdown 表格 → table 块（表头/分隔行/数据行，单元格 trim）', () => {
  const blocks = splitBlocks('对比：\n| | ReAct | Plan-and-Execute |\n|---|---|---|\n| 节奏 | 每步观察 | 先计划再执行 |\n| 强项 | 适应力强 | 可审计 |')
  expect(blocks).toEqual([
    { kind: 'p', text: '对比：' },
    {
      kind: 'table',
      header: ['', 'ReAct', 'Plan-and-Execute'],
      rows: [
        ['节奏', '每步观察', '先计划再执行'],
        ['强项', '适应力强', '可审计'],
      ],
    },
  ])
})

test('splitBlocks：表格分隔行容忍对齐冒号（:---: 变体）', () => {
  const blocks = splitBlocks('| A | B |\n|:--|--:|\n| 1 | 2 |')
  expect(blocks).toEqual([{ kind: 'table', header: ['A', 'B'], rows: [['1', '2']] }])
})

test('splitBlocks：代码块内的表格线原样保留（不被解析成 table）', () => {
  expect(splitBlocks('```\n|---|\n```')).toEqual([{ kind: 'code', lang: '', code: '|---|' }])
})

test('splitBlocks：引用块 > 连续行聚合', () => {
  expect(splitBlocks('前言：\n> 引用一句\n> 第二行\n\n后文。')).toEqual([
    { kind: 'p', text: '前言：' },
    { kind: 'quote', text: '引用一句\n第二行' },
    { kind: 'p', text: '后文。' },
  ])
})

test('splitBlocks：标题行 → heading 块（保留层级）', () => {
  expect(splitBlocks('# 大标题\n正文')).toEqual([
    { kind: 'heading', level: 1, text: '大标题' },
    { kind: 'p', text: '正文' },
  ])
})

test('splitItalic：普通段内 *斜体* 切分（论文标题用法）', () => {
  expect(splitItalic('目标是 *In Search of an Understandable Consensus Algorithm* 这篇')).toEqual([
    { text: '目标是 ', italic: false },
    { text: 'In Search of an Understandable Consensus Algorithm', italic: true },
    { text: ' 这篇', italic: false },
  ])
})

test('splitItalic：粗体段内的单星（数学乘号）不误判——调用方只对普通段调用', () => {
  // 31*h + c 中的 * 落在 splitBold 的粗体段内，不会进 splitItalic
  expect(splitBold('公式：**h = 0; 对每个字符 c：h = 31*h + c**')).toHaveLength(3)
})

// ---- 流式中间态的裸 markdown（回归：曾把浏览器主线程打死） ----
// 背景：AI 回答改流式后，RichText 会吃到「表头到了、分隔行还没到」的半截 markdown。
// 旧实现里段落分支的 `!startsWith('|')` 让 i 永不前进 → 外层 while 死循环 →
// 每轮 push 一个空段落 → 内存爆掉（实测 4GB OOM、浏览器标签卡死）。
test('splitBlocks：表格候选行但无分隔行 → 不死循环，按段落处理', () => {
  expect(splitBlocks('| 维度 | undo | redo |')).toEqual([
    { kind: 'p', text: '| 维度 | undo | redo |' },
  ])
})

test('splitBlocks：表格标题行 + 数据行但缺分隔行 → 不死循环', () => {
  const blocks = splitBlocks('| 维度 | undo |\n| 内容 | 前像 |')
  expect(blocks.length).toBeGreaterThan(0)
  expect(blocks.every(b => b.kind === 'p' || b.kind === 'table')).toBe(true)
})

test('splitBlocks：段落中夹着孤立的 | 行 → 不死循环，内容一字不丢', () => {
  const blocks = splitBlocks('前面的话\n| 孤立竖线行\n后面的话')
  // 孤立 | 行会独立成段（它在流式里可能是「表格表头」的前缀，不能贸然并入前后文）
  expect(blocks.every(b => b.kind === 'p')).toBe(true)
  const text = blocks.map(b => (b as { text: string }).text).join('\n')
  expect(text).toBe('前面的话\n| 孤立竖线行\n后面的话')
})

test('splitBlocks：合法表格之后的裸 | 行 → 视为该表数据行（表格分支本就照单全收）', () => {
  const blocks = splitBlocks('| A | B |\n|---|---|\n| 1 | 2 |\n| 裸行没分隔')
  expect(blocks).toHaveLength(1)
  expect(blocks[0]).toEqual({
    kind: 'table',
    header: ['A', 'B'],
    rows: [['1', '2'], ['裸行没分隔']],
  })
})

test('splitBlocks：终止性不变量——半截 markdown 的各种切法都必须有限时间返回', () => {
  const full = '说明\n\n| 维度 | undo | redo |\n|---|---|---|\n| 内容 | 前像 | 后像 |\n\n```java\nint x = 1;\n```\n\n- 要点一\n- 要点二\n\n> 引用\n\n## 小节\n'
  // 逐字符前缀：模拟流式任意时刻到达的内容（任何一段都不能让解析器卡住）
  for (let n = 0; n <= full.length; n++) {
    const partial = full.slice(0, n)
    const blocks = splitBlocks(partial)
    expect(Array.isArray(blocks)).toBe(true)
  }
})
