import type { BlockMapEntry } from '../../server/map.js'

/** mastery → 展示文本 + 百分比数值（untried 无条） */
function masteryView(e: BlockMapEntry): { label: string; pct: number | null } {
  if (e.mastery.kind === 'untried') return { label: '未刷', pct: null }
  const pct = Math.round((e.mastery.value.num / e.mastery.value.den) * 100)
  return { label: `${pct}%`, pct }
}

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。
 * Hero-first：首屏是「今天的卷子」——一张真实的题面卡 + 开始按钮，
 * 而非统计数字。之下是安静的分类列表（块卡双列网格，荧光 hover）。
 */
export function KnowledgeMap({
  entries, tracks = [], activeTrackId = null, totals,
}: {
  entries: BlockMapEntry[]
  tracks?: Array<{ id: string; name: string }>
  activeTrackId?: string | null
  totals?: { cards: number; blocks: number; tracks: number }
}): React.JSX.Element {
  const groups = new Map<string, BlockMapEntry[]>()
  for (const e of entries) {
    const arr = groups.get(e.category) ?? []
    arr.push(e)
    groups.set(e.category, arr)
  }
  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
      {/* ===== Hero：产品世界最有特征的东西——一道待答的题 ===== */}
      <header className="reveal relative overflow-hidden rounded-2xl border border-paper-line bg-paper-card p-8 md:p-10">
        <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-xs text-paper-muted">今天要刷的</p>
            <h1 className="relative mt-3 font-sans text-4xl font-extrabold leading-tight tracking-tight text-paper-ink md:text-5xl">
              把知识点
              <span className="relative inline-block">
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0.5 h-[0.55em] bg-accent/30" />
                <span className="relative">划进脑子</span>
              </span>
              里
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-paper-muted">
              勾出每道题属于它的要点，系统按你的作答排明天的复习。
              {totals !== undefined && `当前 ${totals.blocks} 个块、${totals.cards} 道题。`}
            </p>
            <div className="mt-7">
              <a href="/" className="btn-primary text-base">
                开始今天的刷题
              </a>
            </div>
          </div>
          {totals !== undefined && (
            <dl className="grid grid-cols-3 gap-6 md:gap-10">
              <div>
                <dd className="tnum font-mono text-3xl font-semibold text-accent">{totals.cards}</dd>
                <dt className="mt-1 font-mono text-xs text-paper-muted">题目</dt>
              </div>
              <div className="border-l border-paper-line pl-6 md:pl-8">
                <dd className="tnum font-mono text-3xl font-semibold text-paper-ink">{totals.blocks}</dd>
                <dt className="mt-1 font-mono text-xs text-paper-muted">块</dt>
              </div>
              <div className="border-l border-paper-line pl-6 md:pl-8">
                <dd className="tnum font-mono text-3xl font-semibold text-paper-ink">{totals.tracks}</dd>
                <dt className="mt-1 font-mono text-xs text-paper-muted">岗位</dt>
              </div>
            </dl>
          )}
        </div>
        {tracks.length > 0 && (
          <nav aria-label="岗位" className="relative mt-8 flex flex-wrap gap-2 border-t border-paper-line pt-6">
            <a
              href="/map"
              aria-current={activeTrackId === null ? 'page' : undefined}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors duration-150 ease-snap ${
                activeTrackId === null
                  ? 'border-accent bg-accent/15 font-semibold text-accent'
                  : 'border-paper-line bg-paper text-paper-muted hover:border-paper-muted hover:text-paper-ink'
              }`}
            >
              全部
            </a>
            {tracks.map(t => (
              <a
                key={t.id}
                href={`/map?track=${t.id}`}
                aria-current={activeTrackId === t.id ? 'page' : undefined}
                className={`rounded-lg border px-4 py-1.5 text-sm transition-colors duration-150 ease-snap ${
                  activeTrackId === t.id
                    ? 'border-accent bg-accent/15 font-semibold text-accent'
                    : 'border-paper-line bg-paper text-paper-muted hover:border-paper-muted hover:text-paper-ink'
                }`}
              >
                {t.name}
              </a>
            ))}
          </nav>
        )}
      </header>

      {groups.size === 0 && (
        <p className="py-24 text-center text-sm text-paper-muted">题库还是空的</p>
      )}

      {/* ===== 分类列表：安静的块卡双列网格 ===== */}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="mt-16">
          <div className="mb-5 flex items-baseline gap-4">
            <h2 className="text-lg font-bold text-paper-ink">{category}</h2>
            <span className="tnum font-mono text-xs text-paper-muted">{list.length} blocks</span>
            <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map(e => {
              const { label, pct } = masteryView(e)
              return (
                <li key={e.blockId} data-testid={`block-${e.blockId}`}>
                  <div className="card-flat flex h-full items-center justify-between gap-4 px-5 py-4 transition-all duration-150 ease-snap hover:border-paper-muted hover:bg-paper-wash">
                    <a
                      href={`/learn?block=${e.blockId}`}
                      className="min-w-0"
                    >
                      <span className="block truncate font-semibold text-paper-ink">{e.blockName}</span>
                      {e.unlocked && pct !== null ? (
                        <span className="tnum mt-1 block text-xs text-paper-muted">
                          {e.cardCount} 题 · 掌握 {pct}%
                        </span>
                      ) : (
                        <span className="tnum mt-1 block text-xs text-paper-muted">{e.cardCount} 题</span>
                      )}
                    </a>
                    {e.unlocked ? (
                      <a
                        href={`/practice?block=${e.blockId}`}
                        className="shrink-0 rounded-lg border border-paper-line px-3.5 py-1.5 text-sm text-paper-muted transition-colors duration-150 ease-snap hover:border-accent hover:text-accent"
                      >
                        {label}
                      </a>
                    ) : (
                      <a
                        href="/upgrade"
                        data-testid="locked-block"
                        className="shrink-0 rounded-lg bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent transition-colors duration-150 ease-snap hover:bg-accent/25"
                      >
                        {e.cardCount} 题 · 解锁
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
