import Link from 'next/link'
import type { PublicCard } from '../../../server/db/adapters.js'

/**
 * 公开题目页纯展示子组件（§7 无 cloaking）：块名 + 题面 + public 要点列表 + App 入口。
 * 只吃传入的 PublicCard，没有任何隐藏的全文分支——渲染多少条完全由 publicKeyPoints 决定，
 * 非 public 要点已在查询层（loadPublicCard）切断，永不出现在此页。
 * hasDemo 只放一行「App 内查看」提示：demo 代码体逐字复述要点文本，本组件没有任何代码渲染路径
 * （无 DemoCodeBlock、无 pre/code），泄露面到提示行为止。
 * 独立文件（非 page.tsx）以避开 Next 15 对 page 模块命名导出的校验，同时供 jsdom 单测直接 import。
 */
export function PublicQuestionView(
  { card, hasDemo = false }: { card: PublicCard; hasDemo?: boolean },
): React.JSX.Element {
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
      {hasDemo && (
        <p className="mt-6 text-sm text-paper-muted">
          本题配有可运行示例 ·{' '}
          <Link href="/" className="font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80">
            在 App 内查看
          </Link>
        </p>
      )}
      <p className="mt-10 text-sm">
        <Link href="/" className="tnum font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80">
          完整 {card.totalKeyPoints} 条要点在 App 内
        </Link>
      </p>
    </main>
  )
}
