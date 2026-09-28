import type { BlockMapEntry } from '../../server/map.js'

/** mastery → 展示文本 + 百分比数值（untried 无条） */
function masteryView(e: BlockMapEntry): { label: string; pct: number | null } {
  if (e.mastery.kind === 'untried') return { label: '未刷', pct: null }
  const pct = Math.round((e.mastery.value.num / e.mastery.value.den) * 100)
  return { label: `${pct}%`, pct }
}

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。可作 server component。
 * 按大类分组的纸卡列表：
 * - 每块一格 `data-testid=block-{id}`：块名 + 掌握度（untried 显示「未刷」，§4.4）+ 细进度条。
 * - 解锁块 → `<a href="/practice?block={id}">` 自由刷题（v2：想刷就刷，不看排期）。
 * - 未解锁块 → 「{cardCount} 题 · 解锁」链到 /upgrade，`data-testid=locked-block`。
 *   这是产品内**唯一**付费转化入口——本页除此之外无任何付费文案（§10.1）。
 */
export function KnowledgeMap({ entries }: { entries: BlockMapEntry[] }): React.JSX.Element {
  const groups = new Map<string, BlockMapEntry[]>()
  for (const e of entries) {
    const arr = groups.get(e.category) ?? []
    arr.push(e)
    groups.set(e.category, arr)
  }
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      {groups.size === 0 && (
        <p className="py-16 text-center text-sm text-paper-muted">题库还是空的</p>
      )}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="mb-8 last:mb-0">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-paper-muted">{category}</h2>
          <ul className="mt-3 space-y-2">
            {list.map(e => {
              const { label, pct } = masteryView(e)
              return (
                <li
                  key={e.blockId}
                  data-testid={`block-${e.blockId}`}
                  className="rounded-md border border-paper-line bg-paper-card px-4 py-3 transition-colors hover:border-paper-muted"
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
                    <div className="mt-2.5 h-1 w-full rounded-full bg-paper-wash" aria-hidden="true">
                      <div className="h-1 rounded-full bg-paper-ink/70" style={{ width: `${pct}%` }} />
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
