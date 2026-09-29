import { splitBlocks, splitBold, splitInlineCode } from '../lib/content/split.js'

/**
 * 行内渲染：先按 `行内代码` 切分（代码段原样呈现，不再解析粗体），
 * 普通段再按 **粗体** 切分——零依赖极简 Markdown 子集的行内层。
 */
function Inline({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitInlineCode(text).map((seg, i) =>
        seg.code
          ? <code key={i} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-paper-ink">{seg.text}</code>
          : splitBold(seg.text).map((b, j) =>
              b.bold
                ? <strong key={`${i}-${j}`} className="font-semibold text-paper-ink">{b.text}</strong>
                : <span key={`${i}-${j}`}>{b.text}</span>,
            ),
      )}
    </>
  )
}

/**
 * 讲解正文的共享富文本组件（learn 页与屏①/屏②「看讲解」复用）。
 * 块级解析（splitBlocks）：段落/无序列表/有序列表/代码块；块内走行内层。
 * 返回一组块级元素——调用方不要用 <p> 包裹（p 内嵌 ul/pre 是非法 HTML）。
 */
export function RichText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitBlocks(text).map((block, i) => {
        if (block.kind === 'code') {
          return (
            <pre key={i} className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 font-mono text-[13px] leading-relaxed text-paper-ink">
              <code>{block.code}</code>
            </pre>
          )
        }
        if (block.kind === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ul>
          )
        }
        if (block.kind === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ol>
          )
        }
        return <p key={i} className="whitespace-pre-line"><Inline text={block.text} /></p>
      })}
    </>
  )
}
