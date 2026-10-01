import { Fragment } from 'react'
import { splitBlocks, splitBold, splitInlineCode, splitItalic } from '../lib/content/split.js'
import { isKnownLanguage, tokenize, type TokenKind } from '../lib/content/highlight.js'

/**
 * 代码着色：单色阶荧光笔——关键字=荧光黄（代码骨架就是重点）、字面量=同色降透明、
 * 注释=蓝灰斜体、其余=粉笔白。刻意不引第二色相：全站荧光黄是唯一强调色，
 * 彩虹代码配色既是 AI 视觉指纹，也会与判分语义色（mark.good/miss/bad）撞车。
 */
const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: '',
  comment: 'text-paper-muted italic',
  keyword: 'text-accent',
  string: 'text-accent/70',
  number: 'text-accent/70',
}

/**
 * 行内渲染三层：先 `行内代码` 切分（代码段原样呈现）；普通段按 **粗体** 切分；
 * 粗体段原样呈现、普通段再按 *斜体* 切分——数学乘号（31*h + c）都在粗体/代码
 * 段内，不会被斜体误判。零依赖极简 Markdown 子集，不追求跨层嵌套。
 */
function Inline({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitInlineCode(text).map((seg, i) =>
        seg.code
          ? <code key={i} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-paper-ink">{seg.text}</code>
          : splitBold(seg.text).map((b, j) => {
              if (b.bold) return <strong key={`${i}-${j}`} className="font-semibold text-paper-ink">{b.text}</strong>
              return (
                <Fragment key={`${i}-${j}`}>
                  {splitItalic(b.text).map((it, k) =>
                    it.italic
                      ? <em key={`${i}-${j}-${k}`}>{it.text}</em>
                      : <span key={`${i}-${j}-${k}`}>{it.text}</span>,
                  )}
                </Fragment>
              )
            }),
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
          const tokens = tokenize(block.code, block.lang)
          // 语言标签只认得出的显示（写错了语言名就不装懂）
          const labeled = block.lang !== '' && isKnownLanguage(block.lang)
          return (
            <div key={i} className="relative z-[1] overflow-hidden rounded-xl border border-paper-line bg-paper-deep">
              {labeled && (
                <div className="flex justify-end border-b border-paper-line/60 px-3 py-1">
                  <span className="font-mono text-[11px] text-paper-muted">{block.lang}</span>
                </div>
              )}
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-paper-ink">
                <code>
                  {tokens.map((t, j) => (
                    <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>
                  ))}
                </code>
              </pre>
            </div>
          )
        }
        if (block.kind === 'table') {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px] leading-relaxed">
                <thead>
                  <tr>
                    {block.header.map((cell, j) => (
                      <th key={j} className="border-b border-white/15 px-2.5 py-1.5 text-left font-medium text-paper-muted">
                        {cell === '' ? '\u00A0' : <Inline text={cell} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="border-b border-white/[0.06] px-2.5 py-1.5 align-top">
                          <Inline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (block.kind === 'quote') {
          return (
            <blockquote key={i} className="border-l-2 border-l-accent/50 pl-3 text-paper-muted">
              <p className="whitespace-pre-line"><Inline text={block.text} /></p>
            </blockquote>
          )
        }
        if (block.kind === 'heading') {
          return (
            <h3 key={i} className="mt-1 font-semibold tracking-tight text-paper-ink">
              <Inline text={block.text} />
            </h3>
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
