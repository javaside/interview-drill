import type { BlockMapEntry } from '../../server/map.js'

/** mastery → 展示文本 + 百分比数值（untried 无条） */
function masteryView(e: BlockMapEntry): { label: string; pct: number | null } {
  if (e.mastery.kind === 'untried') return { label: '未刷', pct: null }
  const pct = Math.round((e.mastery.value.num / e.mastery.value.den) * 100)
  return { label: `${pct}%`, pct }
}

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。可作 server component。
 * 编辑刊头：左栏 serif 大标题 + 右栏真实库量统计（不对称双栏，md 以下回落单列）。
 * 岗位 tab（全部 | 各岗位包）是纯导航链接（?track=）；选中岗位时 entries 已由
 * page 侧按 track 顺序过滤，本组件仍按大类分组渲染。
 * - 每块一格 `data-testid=block-{id}`：块名 + 掌握度（untried 显示「未刷」，§4.4）+ 细进度条。
 * - 解锁块 → `<a href="/practice?block={id}">` 自由刷题（v2：想刷就刷，不看排期）。
 * - 未解锁块 → 「{cardCount} 题 · 解锁」链到 /upgrade，`data-testid=locked-block`。
 *   这是产品内**唯一**付费转化入口——本页除此之外无任何付费文案（§10.1）。
 */
export function KnowledgeMap({
  entries, tracks = [], activeTrackId = null, totals,
}: {
  entries: BlockMapEntry[]
  /** 岗位包列表（id/name），空 = 不渲染 tab（老库无 tracks） */
  tracks?: Array<{ id: string; name: string }>
  activeTrackId?: string | null
  /** 真实库量统计（page 侧汇总；缺省不渲染刊头统计栏） */
  totals?: { cards: number; blocks: number; tracks: number }
}): React.JSX.Element {
  const groups = new Map<string, BlockMapEntry[]>()
  for (const e of entries) {
    const arr = groups.get(e.category) ?? []
    arr.push(e)
    groups.set(e.category, arr)
  }
  let visible = 0   // 级联入场的序号源（跨组连续递增）
  return (
    <div className="relative mx-auto max-w-2xl px-5 py-10">
      {/* 背景淡墨大字：纯氛围装饰 */}
      <span aria-hidden="true" className="ghost-display absolute right-0 top-24 hidden text-[11rem] lg:block">
        图
      </span>

      {/* 编辑刊头：不对称双栏——左标题右统计 */}
      <header className="rise relative mb-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="eyebrow">Interview Drill</p>
          <h1 className="mt-3 font-serif text-5xl font-bold leading-[1.05] tracking-tighter text-paper-ink">
            知识地图
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-paper-muted">
            {totals !== undefined && totals.tracks > 0
              ? '选一个岗位包，按推荐顺序从第一块刷起；掌握度随你的作答实时更新。'
              : '挑一块开始刷——先读讲解再做检验，作答实时更新掌握度。'}
          </p>
        </div>
        {totals !== undefined && (
          <dl className="grid grid-cols-3 gap-6 border-t border-paper-line pt-5 md:grid-cols-1 md:gap-5 md:border-t-0 md:border-l md:pt-0 md:pl-10 md:text-right">
            <div>
              <dt className="eyebrow">题目</dt>
              <dd className="stat-figure mt-1.5">{totals.cards}</dd>
            </div>
            <div>
              <dt className="eyebrow">块</dt>
              <dd className="stat-figure mt-1.5">{totals.blocks}</dd>
            </div>
            <div>
              <dt className="eyebrow">岗位</dt>
              <dd className="stat-figure mt-1.5">{totals.tracks}</dd>
            </div>
          </dl>
        )}
      </header>

      {tracks.length > 0 && (
        <nav aria-label="岗位" className="rise mb-8 flex flex-wrap gap-2" style={{ animationDelay: '80ms' }}>
          <a
            href="/map"
            aria-current={activeTrackId === null ? 'page' : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-200 hover:-translate-y-px ${
              activeTrackId === null
                ? 'border-paper-ink bg-paper-ink text-paper shadow-paper'
                : 'border-paper-line bg-paper-card text-paper-ink hover:border-paper-muted hover:shadow-paper'
            }`}
          >
            全部
          </a>
          {tracks.map(t => (
            <a
              key={t.id}
              href={`/map?track=${t.id}`}
              aria-current={activeTrackId === t.id ? 'page' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-200 hover:-translate-y-px ${
                activeTrackId === t.id
                  ? 'border-paper-ink bg-paper-ink text-paper shadow-paper'
                  : 'border-paper-line bg-paper-card text-paper-ink hover:border-paper-muted hover:shadow-paper'
              }`}
            >
              {t.name}
            </a>
          ))}
        </nav>
      )}
      {groups.size === 0 && (
        <p className="py-16 text-center text-sm text-paper-muted">题库还是空的</p>
      )}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="rise relative mb-11 last:mb-0" style={{ animationDelay: `${Math.min(visible * 40, 320)}ms` }}>
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-xl font-semibold uppercase tracking-wide text-paper-ink">{category}</h2>
            <span className="tnum font-mono text-xs text-paper-muted">{String(list.length).padStart(2, '0')} blocks</span>
            <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
          </div>
          <ul className="mt-4 space-y-2.5">
            {list.map(e => {
              const { label, pct } = masteryView(e)
              // 级联入场：块卡按序轻浮（上限 8 张，之后的直接呈现）
              visible += 1
              const delay = visible <= 8 ? `${visible * 45}ms` : undefined
              return (
                <li
                  key={e.blockId}
                  data-testid={`block-${e.blockId}`}
                  className="paper-card lift rise px-4 py-3.5"
                  style={delay !== undefined ? { animationDelay: delay } : { animation: 'none' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <a
                      href={`/learn?block=${e.blockId}`}
                      className="font-medium text-paper-ink underline decoration-paper-line underline-offset-4 transition-colors hover:decoration-paper-ink"
                    >
                      {e.blockName}
                    </a>
                    {e.unlocked ? (
                      <a
                        href={`/practice?block=${e.blockId}`}
                        className="tnum shrink-0 text-sm font-medium text-paper-ink underline decoration-paper-line underline-offset-4 transition-colors hover:decoration-paper-ink"
                      >
                        {label}
                      </a>
                    ) : (
                      <a
                        href="/upgrade"
                        data-testid="locked-block"
                        className="tnum shrink-0 text-sm text-accent transition-opacity hover:opacity-80"
                      >
                        {e.cardCount} 题 · 解锁
                      </a>
                    )}
                  </div>
                  {e.unlocked && pct !== null && (
                    <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-paper-wash" aria-hidden="true">
                      <div
                        className="h-1 rounded-full bg-paper-ink/70 transition-[width] duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
