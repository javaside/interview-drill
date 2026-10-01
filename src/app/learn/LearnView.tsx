import Link from 'next/link'
/**
 * 块学习页视图（教材在前、习题在后）：按卡列出题面 + 分层题解——
 * 入门版（零基础可读）默认展开，进阶版（面试深度）折叠。
 * 纯展示 server component——数据由 page.tsx 装配。
 */
import { splitDetail } from '../../lib/content/split.js'
import { RichText } from '../RichText.js'
import { CardQA } from './CardQA.js'

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
      <div className="space-y-2"><RichText text={intro} /></div>
      {advanced !== '' && (
        <details className="mt-3 rounded-md border border-paper-line bg-paper-wash px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-paper-muted">
            进阶（面试深度）
          </summary>
          <div className="mt-2 space-y-2"><RichText text={advanced} /></div>
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
    <main className="rise mx-auto max-w-6xl px-6 pb-24 pt-2">
      <p className="eyebrow">学习 · Learn</p>
      <h1 className="mt-3 font-sans text-4xl font-bold tracking-tighter text-paper-ink md:text-5xl">{blockName}</h1>
      {locked ? (
        <div className="card-flat mt-8 max-w-2xl p-8">
          <p className="text-[15px] leading-relaxed text-paper-muted">
            这个块有 <span className="tnum font-semibold text-paper-ink">{cardCount ?? '这些'}</span> 题，
            还没有解锁——解锁后这里就是完整的教材。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/upgrade"
              className="btn-primary"
            >
              解锁全部大类
            </Link>
            <Link href="/settings" className="btn-ghost py-2">
              在设置里把它选为免费块
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-paper-muted">
            通读下面的讲解，理解了再去做题检验——做题时也能随时回来看。
          </p>

          <div className="mt-10 grid gap-12 lg:grid-cols-[220px_1fr]">
            {cards.length > 3 && (
              <aside className="hidden lg:block">
                <div className="sticky top-6 card-flat p-5">
                  <div className="p-5">
                    <p className="eyebrow mb-4">本块目录</p>
                    <ol className="space-y-1.5">
                      {cards.map((c, i) => (
                        <li key={c.cardId}>
                          <a
                            href={`#${c.cardId}`}
                            className="tnum flex items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-paper-muted transition-colors hover:bg-white/[0.04] hover:text-paper-ink"
                          >
                            <span className="font-mono text-[11px] opacity-60">{String(i + 1).padStart(2, '0')}</span>
                            <span className="line-clamp-1">{c.question}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </aside>
            )}
            <div className="min-w-0">
          <div className="space-y-14">
            {cards.map((c, i) => (
              <article id={c.cardId} key={c.cardId} className="group relative scroll-mt-28 pl-16">
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
                <CardQA cardId={c.cardId} />
              </article>
            ))}
          </div>

          {cards.length === 0 && (
            <p className="py-16 text-center text-sm text-paper-muted">这个块还没有学习材料</p>
          )}

          <div className="mt-16 text-center">
            <Link
              href={`/practice?block=${blockId}`}
              className="btn-primary text-base"
            >
              学完了，开始测试
            </Link>
          </div>
          </div>
          </div>
        </>
      )}
    </main>
  )
}
