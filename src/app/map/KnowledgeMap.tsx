import type { BlockMapEntry } from '../../server/map.js'

/**
 * 知识地图（§4.4 掌握度 + §10.1 唯一转化入口）。可作 server component。
 * - 每块一格 `data-testid=block-{id}`：块名 + 掌握度/题量。
 * - 解锁块 → `<a href="/?block={id}">`，掌握度 untried 显示「未刷」（不是 0%，§4.4），
 *   否则 `Math.round(num/den*100)%`。
 * - 未解锁块 → 只显真实题数「{cardCount} 题」且不可进入，`data-testid=locked-block`。
 *   这是产品内**唯一**付费转化入口——本页除此之外无任何付费文案（§10.1）。
 */
export function KnowledgeMap({ entries }: { entries: BlockMapEntry[] }): React.JSX.Element {
  return (
    <div>
      {entries.map(e => (
        <div key={e.blockId} data-testid={`block-${e.blockId}`}>
          <span>{e.blockName}</span>
          {e.unlocked ? (
            <a href={`/?block=${e.blockId}`}>
              {e.mastery.kind === 'untried'
                ? '未刷'
                : `${Math.round((e.mastery.value.num / e.mastery.value.den) * 100)}%`}
            </a>
          ) : (
            <a href="/upgrade" data-testid="locked-block">{e.cardCount} 题 · 解锁</a>
          )}
        </div>
      ))}
    </div>
  )
}
