/**
 * 块学习页视图（教材在前、习题在后）：按卡列出题面 + 完整题解讲解，
 * 读完好去测试。纯展示 server component——数据由 page.tsx 装配。
 */
export type LearnCard = {
  cardId: string
  question: string
  frequency: 'high' | 'mid' | 'low'
  detail: string
}

const FREQ_LABEL = { high: '高频', mid: '中频', low: '低频' } as const

export function LearnView({
  blockName, cards, blockId,
}: { blockName: string; cards: LearnCard[]; blockId: string }): React.JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-paper-muted">学习</p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-paper-ink">{blockName}</h1>
      <p className="mt-2 text-sm text-paper-muted">
        通读下面的讲解，理解了再去做题检验——做题时也能随时回来看。
      </p>

      <div className="mt-8 space-y-8">
        {cards.map((c, i) => (
          <article key={c.cardId} className="border-l-2 border-paper-line pl-5">
            <div className="flex items-baseline gap-3">
              <span className="tnum font-mono text-xs text-paper-muted">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="font-serif text-lg font-semibold leading-snug text-paper-ink text-pretty">
                {c.question}
              </h2>
            </div>
            <div className="mt-1 pl-8 text-xs tracking-[0.2em] text-paper-muted">{FREQ_LABEL[c.frequency]}</div>
            <p className="mt-2 whitespace-pre-line pl-8 text-[15px] leading-relaxed text-paper-ink">
              {c.detail}
            </p>
          </article>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="py-16 text-center text-sm text-paper-muted">这个块还没有学习材料</p>
      )}

      <div className="mt-12 text-center">
        <a
          href={`/practice?block=${blockId}`}
          className="inline-block rounded-md bg-paper-ink px-8 py-2.5 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px"
        >
          学完了，开始测试
        </a>
      </div>
    </main>
  )
}
