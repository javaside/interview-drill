import { splitBold } from '../lib/content/split.js'

/**
 * `**术语**` 粗体渲染（极简 Markdown 子集，零依赖）——
 * 题解正文/讲解的共享富文本组件（learn 页与屏①「先看讲解」复用）。
 */
export function RichText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitBold(text).map((seg, i) =>
        seg.bold
          ? <strong key={i} className="font-semibold text-paper-ink">{seg.text}</strong>
          : <span key={i}>{seg.text}</span>,
      )}
    </>
  )
}
