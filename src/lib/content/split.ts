/**
 * 题解分层（内容规范 v2）：detail 正文用 `<!--advanced-->` 分隔——
 * 前段是入门版（零基础可读，类比讲解），后段是进阶版（面试深度）。
 * 无标记的旧内容：全文视为入门版，进阶为空（渲染层自然退化为单层）。
 */
export function splitDetail(detail: string): { intro: string; advanced: string } {
  const marker = '<!--advanced-->'
  const idx = detail.indexOf(marker)
  if (idx === -1) return { intro: detail.trim(), advanced: '' }
  return {
    intro: detail.slice(0, idx).trim(),
    advanced: detail.slice(idx + marker.length).trim(),
  }
}

/**
 * `**粗体**` 标记切段（渲染层用，零依赖的极简 Markdown 子集）：
 * 按 `**` split，奇数段为粗体。未配对的 `**` 自然落进文本段，不炸。
 */
export function splitBold(text: string): Array<{ text: string; bold: boolean }> {
  return text.split('**').map((seg, i) => ({ text: seg, bold: i % 2 === 1 }))
}

/** `` `行内代码` `` 标记切段：按反引号 split，奇数段为代码。未配对自然落尾段，不炸 */
export function splitInlineCode(text: string): Array<{ text: string; code: boolean }> {
  return text.split('`').map((seg, i) => ({ text: seg, code: i % 2 === 1 }))
}

/**
 * `*斜体*` 标记切段（单星对，论文标题用法）——只对普通段调用：粗体段与
 * 代码段内部不解析（`31*h + c` 数学乘号、`s[0]*31^n` 公式都在那里，防误判）。
 * 无闭合的单星自然留在普通段，不炸。
 */
export function splitItalic(text: string): Array<{ text: string; italic: boolean }> {
  const out: Array<{ text: string; italic: boolean }> = []
  const re = /\*([^*\s][^*]*?)\*/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), italic: false })
    out.push({ text: m[1]!, italic: true })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), italic: false })
  return out
}

/** 块级元素：段落 / 无序列表 / 有序列表 / 代码块 / 表格 / 引用 / 标题（讲解正文实际用到的全部语法面） */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'heading'; level: number; text: string }

const UL = /^[-*] /
const OL = /^\d+\. /
const FENCE = /^```(\w*)\s*$/
const FENCE_END = /^```\s*$/
const TABLE_SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/
const HEADING = /^(#{1,6}) (.+)$/
const QUOTE = /^> ?/

/** 表格行切单元格：去掉行首尾竖线产生的空首尾段，中间格 trim（空表头格保留为 ''） */
function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}

/**
 * 块级解析（零依赖极简 Markdown 子集）：逐行扫描，代码块优先（内部一切
 * 标记原样保留）；`|` 行 + 次行分隔线 → 表格；连续 `> ` 行 → 引用；
 * `#` 行 → 标题；连续 ` - ` 行聚合为 ul、` 1. ` 行聚合为 ol；其余连续
 * 非空行为段落（段内换行保留，渲染层 whitespace-pre-line 呈现）。
 * 内容受控（content:audit 把关），未配对 ``` 到文尾自然截断，不炸。
 */
export function splitBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const fence = line.match(FENCE)
    if (fence) {
      const lang = fence[1] ?? ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_END.test(lines[i]!)) {
        codeLines.push(lines[i]!)
        i++
      }
      i++   // 消费结束 ```（未配对则越界自然结束）
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n') })
      continue
    }
    if (line.trim() === '') { i++; continue }
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!.trim())) {
      const header = splitTableRow(line)
      i += 2   // 跳过表头行与分隔行
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]!))
        i++
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }
    if (QUOTE.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && QUOTE.test(lines[i]!)) {
        quoteLines.push(lines[i]!.replace(QUOTE, ''))
        i++
      }
      blocks.push({ kind: 'quote', text: quoteLines.join('\n') })
      continue
    }
    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() })
      i++
      continue
    }
    if (UL.test(line)) {
      const items: string[] = []
      while (i < lines.length && UL.test(lines[i]!)) {
        items.push(lines[i]!.replace(UL, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    if (OL.test(line)) {
      const items: string[] = []
      while (i < lines.length && OL.test(lines[i]!)) {
        items.push(lines[i]!.replace(OL, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length && lines[i]!.trim() !== '' &&
      !FENCE.test(lines[i]!) && !UL.test(lines[i]!) && !OL.test(lines[i]!) &&
      !QUOTE.test(lines[i]!) && !HEADING.test(lines[i]!) &&
      !lines[i]!.trim().startsWith('|')   // 表格候选行停段，交回外层判定
    ) {
      para.push(lines[i]!)
      i++
    }
    blocks.push({ kind: 'p', text: para.join('\n').trim() })
  }
  return blocks
}
