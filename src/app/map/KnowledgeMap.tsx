import type { BlockMapEntry } from '../../server/map.js'

/** mastery → 展示文本 + 百分比数值（untried 无条） */
function masteryView(e: BlockMapEntry): { label: string; pct: number | null } {
  if (e.mastery.kind === 'untried') return { label: '未刷', pct: null }
  const pct = Math.round((e.mastery.value.num / e.mastery.value.den) * 100)
  return { label: `${pct}%`, pct }
}

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。
 * Bento 刊头：主卡（col-span-8：标题+说明+岗位 tab）与统计竖卡（col-span-4）拼接；
 * md 以下回落单列。块卡为双壳嵌套（shell+core），掌握度大数展示。
 * - 解锁块 → learn 链接 + practice 入口；未解锁块 → 「{cardCount} 题 · 解锁」/upgrade
 *   （`data-testid=locked-block`，产品内唯一付费转化入口——§10.1）。
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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-4">
      {/* Bento 刊头：md 起 8/4 拼接 */}
      <header className="reveal mb-6 grid gap-4 md:grid-cols-12">
        <div className="shell md:col-span-8">
          <div className="core flex h-full flex-col justify-between gap-8 p-7">
            <div>
              <span className="eyebrow-badge">Interview Drill</span>
              <h1 className="mt-5 font-serif text-[2.75rem] font-bold leading-[1.02] tracking-tighter text-paper-ink">
                知识地图
              </h1>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-paper-muted">
                {totals !== undefined && totals.tracks > 0
                  ? '选一个岗位包，按推荐顺序从第一块刷起；掌握度随你的作答实时更新。'
                  : '挑一块开始刷——先读讲解再做检验，作答实时更新掌握度。'}
              </p>
            </div>
            {tracks.length > 0 && (
              <nav aria-label="岗位" className="flex flex-wrap gap-2">
                <a
                  href="/map"
                  aria-current={activeTrackId === null ? 'page' : undefined}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-500 ease-fluid hover:-translate-y-px ${
                    activeTrackId === null
                      ? 'border-paper-ink bg-paper-ink text-paper'
                      : 'border-white/10 bg-white/[0.03] text-paper-ink hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                >
                  全部
                </a>
                {tracks.map(t => (
                  <a
                    key={t.id}
                    href={`/map?track=${t.id}`}
                    aria-current={activeTrackId === t.id ? 'page' : undefined}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-500 ease-fluid hover:-translate-y-px ${
                      activeTrackId === t.id
                        ? 'border-paper-ink bg-paper-ink text-paper'
                        : 'border-white/10 bg-white/[0.03] text-paper-ink hover:border-white/25 hover:bg-white/[0.06]'
                    }`}
                  >
                    {t.name}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>
        {totals !== undefined && (
          <div className="shell md:col-span-4">
            <div className="core grid h-full grid-cols-3 gap-2 p-7 md:grid-cols-1 md:gap-6">
              <div className="border-paper-line md:border-b md:pb-5">
                <dt className="eyebrow">题目</dt>
                <dd className="stat-figure mt-2">{totals.cards}</dd>
              </div>
              <div className="border-paper-line md:border-b md:pb-5">
                <dt className="eyebrow">块</dt>
                <dd className="stat-figure mt-2">{totals.blocks}</dd>
              </div>
              <div>
                <dt className="eyebrow">岗位</dt>
                <dd className="stat-figure mt-2">{totals.tracks}</dd>
              </div>
            </div>
          </div>
        )}
      </header>

      {groups.size === 0 && (
        <p className="py-20 text-center text-sm text-paper-muted">题库还是空的</p>
      )}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="mb-14 last:mb-0">
          <div className="reveal mb-5 flex items-baseline gap-3">
            <h2 className="font-sans text-lg font-semibold uppercase tracking-[0.18em] text-paper-ink">{category}</h2>
            <span className="tnum font-mono text-xs text-paper-muted">{String(list.length).padStart(2, '0')} blocks</span>
            <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <ul className="grid gap-3.5 md:grid-cols-2">
            {list.map(e => {
              const { label, pct } = masteryView(e)
              return (
                <li key={e.blockId} data-testid={`block-${e.blockId}`} className="shell reveal transition-transform duration-500 ease-fluid hover:-translate-y-1">
                  <div className="core p-5">
                    <div className="flex items-center justify-between gap-4">
                      <a
                        href={`/learn?block=${e.blockId}`}
                        className="font-medium text-paper-ink underline decoration-white/10 underline-offset-4 transition-colors hover:decoration-paper-ink"
                      >
                        {e.blockName}
                      </a>
                      {e.unlocked ? (
                        <a
                          href={`/practice?block=${e.blockId}`}
                          className="tnum shrink-0 font-serif text-2xl font-bold tracking-tight text-paper-ink underline decoration-white/10 underline-offset-4 transition-colors hover:decoration-accent hover:text-accent"
                        >
                          {label}
                        </a>
                      ) : (
                        <a
                          href="/upgrade"
                          data-testid="locked-block"
                          className="tnum shrink-0 rounded-full border border-accent/40 px-3 py-1 text-sm text-accent transition-all duration-500 ease-fluid hover:bg-accent-soft"
                        >
                          {e.cardCount} 题 · 解锁
                        </a>
                      )}
                    </div>
                    {e.unlocked && pct !== null && (
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                        <div
                          className="h-1 rounded-full bg-accent transition-[width] duration-700 ease-fluid"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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
