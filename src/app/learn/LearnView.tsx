/**
 * 块学习页视图（教材在前、习题在后）：按卡列出题面 + 分层题解——
 * 入门版（零基础可读）默认展开，进阶版（面试深度）折叠。
 * 纯展示 server component——数据由 page.tsx 装配。
 */
import { splitDetail } from '../../lib/content/split.js'
import { RichText } from '../RichText.js'

export type LearnCard = {
  cardId: string
  question: string
  frequency: 'high' | 'mid' | 'low'
  detail: string
}

const FREQ_LABEL = { high: '高频', mid: '中频', low: '低频' } as const

function DetailLayers({ detail, indent = true }: { detail: string; indent?: boolean }): React.JSX.Element {
  const { intro, advanced } = splitDetail(detail)
  return (
    <div className={`mt-2 text-[15px] leading-relaxed text-paper-ink ${indent ? 'pl-8' : ''}`}>
      <p className="whitespace-pre-line"><RichText text={intro} /></p>
      {advanced !== '' && (
        <details className="mt-3 rounded-md border border-paper-line bg-paper-wash px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-paper-muted">
            进阶（面试深度）
          </summary>
          <p className="mt-2 whitespace-pre-line"><RichText text={advanced} /></p>
        </details>
      )}
    </div>
  )
}

export function LearnView({
  blockName, cards, blockId, locked = false, cardCount,
}: {
  blockName: string
  cards: LearnCard[]
  blockId: string
  /** 未解锁块：不渲染题面/题解（page 侧本就过滤），给解锁引导而非「没有材料」的误导 */
  locked?: boolean
  /** locked 时展示的真实卡数（知识地图公开的同一数字） */
  cardCount?: number
}): React.JSX.Element {
  return (
    <main className="rise mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-paper-muted">学习</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-paper-ink">{blockName}</h1>
      {locked ? (
        <>
          <p className="mt-2 text-sm text-paper-muted">
            这个块有 {cardCount ?? '这些'} 题，你还没有解锁它——解锁后这里就是完整的教材。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/upgrade"
              className="rounded-md bg-accent px-6 py-2 font-medium text-paper shadow-stamp transition-all duration-200 hover:-translate-y-px hover:opacity-95 active:translate-y-0"
            >
              解锁全部大类
            </a>
            <a
              href="/settings"
              className="btn-ghost px-6 py-2"
            >
              在设置里把它选为免费块
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-paper-muted">
            通读下面的讲解，理解了再去做题检验——做题时也能随时回来看。
          </p>

          <div className="mt-10 space-y-12">
            {cards.map((c, i) => (
              <article key={c.cardId} className="group relative pl-16">
                {/* 大序号：serif 淡墨，行内导航兼装饰 */}
                <span
                  aria-hidden="true"
                  className="tnum pointer-events-none absolute left-0 top-0 select-none font-serif text-4xl font-bold leading-none text-paper-ink/15 transition-colors duration-300 group-hover:text-accent/25"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="font-serif text-xl font-semibold leading-snug tracking-tight text-paper-ink text-balance">
                  {c.question}
                </h2>
                <div className="mt-1.5 eyebrow">{FREQ_LABEL[c.frequency]}</div>
                <DetailLayers detail={c.detail} indent={false} />
              </article>
            ))}
          </div>

          {cards.length === 0 && (
            <p className="py-16 text-center text-sm text-paper-muted">这个块还没有学习材料</p>
          )}

          <div className="mt-12 text-center">
            <a
              href={`/practice?block=${blockId}`}
              className="btn-primary inline-block px-8"
            >
              学完了，开始测试
            </a>
          </div>
        </>
      )}
    </main>
  )
}
