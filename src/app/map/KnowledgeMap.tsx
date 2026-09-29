import type { BlockMapEntry } from '../../server/map.js'

/** mastery → 展示文本 + 百分比数值（untried 无条） */
function masteryView(e: BlockMapEntry): { label: string; pct: number | null } {
  if (e.mastery.kind === 'untried') return { label: '未刷', pct: null }
  const pct = Math.round((e.mastery.value.num / e.mastery.value.den) * 100)
  return { label: `${pct}%`, pct }
}

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。全幅面板墙布局：
 * hero 深墨大横幅（标题+统计+岗位 tab）→ 每大类一块面板，块卡多列网格
 * （md:2 列 / xl:3 列）。未解锁块 → 「{cardCount} 题 · 解锁」/upgrade
 * （`data-testid=locked-block`，产品内唯一付费转化入口——§10.1）。
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
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-6">
      {/* ===== Hero 深墨大横幅 ===== */}
      <header className="reveal relative overflow-hidden rounded-[2.25rem] border border-white/[0.07] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-8 md:p-12">
        {/* 面板内光球 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-sky-500/[0.07] blur-3xl"
        />
        <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <span className="eyebrow-badge">Interview Drill</span>
            <h1 className="mt-6 font-sans text-5xl font-bold leading-[1.02] tracking-tighter text-paper-ink md:text-6xl">
              知识地图
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-paper-muted">
              {totals !== undefined && totals.tracks > 0
                ? '选一个岗位包，按推荐顺序从第一块刷起；掌握度随你的作答实时更新。'
                : '挑一块开始刷——先读讲解再做检验，作答实时更新掌握度。'}
            </p>
            {tracks.length > 0 && (
              <nav aria-label="岗位" className="mt-8 flex flex-wrap gap-2.5">
                <a
                  href="/map"
                  aria-current={activeTrackId === null ? 'page' : undefined}
                  className={`rounded-full border px-5 py-2 text-sm transition-all duration-500 ease-fluid hover:-translate-y-px ${
                    activeTrackId === null
                      ? 'border-accent bg-accent font-semibold text-[#05201a]'
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
                    className={`rounded-full border px-5 py-2 text-sm transition-all duration-500 ease-fluid hover:-translate-y-px ${
                      activeTrackId === t.id
                        ? 'border-accent bg-accent font-semibold text-[#05201a]'
                        : 'border-white/10 bg-white/[0.03] text-paper-ink hover:border-white/25 hover:bg-white/[0.06]'
                    }`}
                  >
                    {t.name}
                  </a>
                ))}
              </nav>
            )}
          </div>
          {totals !== undefined && (
            <dl className="grid grid-cols-3 gap-8 md:gap-10">
              <div>
                <dd className="stat-figure">{totals.cards}</dd>
                <dt className="eyebrow mt-2">题目</dt>
              </div>
              <div className="border-l border-white/[0.08] pl-6 md:pl-8">
                <dd className="stat-figure">{totals.blocks}</dd>
                <dt className="eyebrow mt-2">块</dt>
              </div>
              <div className="border-l border-white/[0.08] pl-6 md:pl-8">
                <dd className="stat-figure">{totals.tracks}</dd>
                <dt className="eyebrow mt-2">岗位</dt>
              </div>
            </dl>
          )}
        </div>
      </header>

      {groups.size === 0 && (
        <p className="py-24 text-center text-sm text-paper-muted">题库还是空的</p>
      )}

      {/* ===== 大类面板：块卡多列网格 ===== */}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="mt-14">
          <div className="reveal mb-6 flex items-baseline gap-4">
            <h2 className="font-sans text-2xl font-bold uppercase tracking-[0.14em] text-paper-ink">{category}</h2>
            <span className="tnum rounded-full border border-white/[0.08] px-2.5 py-0.5 font-mono text-[11px] text-paper-muted">
              {String(list.length).padStart(2, '0')} blocks
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <ul className="reveal grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map(e => {
              const { label, pct } = masteryView(e)
              return (
                <li key={e.blockId} data-testid={`block-${e.blockId}`} className="shell transition-transform duration-500 ease-fluid hover:-translate-y-1">
                  <div className="core flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <a
                        href={`/learn?block=${e.blockId}`}
                        className="text-[16px] font-semibold leading-snug text-paper-ink transition-colors hover:text-accent"
                      >
                        {e.blockName}
                      </a>
                      {e.unlocked ? (
                        <span className="stat-figure shrink-0 !text-3xl">{label === '未刷' ? <span className="text-base font-medium text-paper-muted">未刷</span> : label}</span>
                      ) : (
                        <a
                          href="/upgrade"
                          data-testid="locked-block"
                          className="shrink-0 rounded-full border border-accent/40 px-3 py-1 text-xs text-accent transition-all duration-500 ease-fluid hover:bg-accent-soft"
                        >
                          解锁
                        </a>
                      )}
                    </div>
                    {e.unlocked && pct !== null && (
                      <div className="mt-auto">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-accent to-accent/60 transition-[width] duration-700 ease-fluid"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="tnum mt-2 text-xs text-paper-muted">{e.cardCount} 题</div>
                      </div>
                    )}
                    {!e.unlocked && (
                      <div className="tnum mt-auto text-xs text-paper-muted">{e.cardCount} 题</div>
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
