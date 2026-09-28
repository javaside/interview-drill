import type { PublicCard } from '../../../server/db/adapters.js'

/**
 * 公开题目页纯展示子组件（§7 无 cloaking）：块名 + 题面 + public 要点列表 + App 入口。
 * 只吃传入的 PublicCard，没有任何隐藏的全文分支——渲染多少条完全由 publicKeyPoints 决定，
 * 非 public 要点已在查询层（loadPublicCard）切断，永不出现在此页。
 * 独立文件（非 page.tsx）以避开 Next 15 对 page 模块命名导出的校验，同时供 jsdom 单测直接 import。
 */
export function PublicQuestionView({ card }: { card: PublicCard }): React.JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs tracking-[0.2em] text-paper-muted">{card.blockName}</p>
      <h1 className="mt-3 font-serif text-2xl font-semibold leading-snug text-paper-ink text-pretty">
        {card.question}
      </h1>
      <ul className="mt-8 space-y-3 border-l-2 border-paper-line pl-5">
        {card.publicKeyPoints.map(kp => (
          <li key={kp.id} data-testid="public-kp" className="text-[15px] leading-relaxed text-paper-ink">
            {kp.text}
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm">
        <a href="/" className="tnum font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80">
          完整 {card.totalKeyPoints} 条要点在 App 内
        </a>
      </p>
    </main>
  )
}
