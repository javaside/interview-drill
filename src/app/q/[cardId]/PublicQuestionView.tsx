import type { PublicCard } from '../../../server/db/adapters.js'

/**
 * 公开题目页纯展示子组件（§7 无 cloaking）：块名 + 题面 + public 要点列表 + App 入口。
 * 只吃传入的 PublicCard，没有任何隐藏的全文分支——渲染多少条完全由 publicKeyPoints 决定，
 * 非 public 要点已在查询层（loadPublicCard）切断，永不出现在此页。
 * 独立文件（非 page.tsx）以避开 Next 15 对 page 模块命名导出的校验，同时供 jsdom 单测直接 import。
 */
export function PublicQuestionView({ card }: { card: PublicCard }): React.JSX.Element {
  return (
    <main>
      <p>{card.blockName}</p>
      <h1>{card.question}</h1>
      <ul>
        {card.publicKeyPoints.map(kp => (
          <li key={kp.id} data-testid="public-kp">{kp.text}</li>
        ))}
      </ul>
      <a href="/">完整 {card.totalKeyPoints} 条要点在 App 内</a>
    </main>
  )
}
