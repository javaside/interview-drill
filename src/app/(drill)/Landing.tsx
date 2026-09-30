import { withBase } from '../../lib/base-path.js'
import Link from 'next/link'
/**
 * 未登录首页（站点介绍落地页）：先让人看见本站是什么、有什么不一样，
 * 再给登录入口——「为什么要点登录」由页面自己回答，不靠访客猜。
 * 纯展示 server component：数字与岗位名由调用方从真实库取
 * （loadBlocks/loadTracks，匿名安全、零用户数据查询），组件不查库、
 * 不硬编码——内容扩产时落地页自动跟上。
 */
export function Landing({ totals, tracks }: {
  totals: { cards: number; blocks: number; categories: number }
  tracks: readonly string[]
}): React.JSX.Element {
  const props: Array<{ title: string; body: string }> = [
    {
      title: '判到要点，不只对错',
      body: '每题拆成要点逐条判分：答错的明天优先再来，会的少打扰。',
    },
    {
      title: '白话讲解，零基础能读',
      body: '入门版用类比讲「为什么」，术语带白话映射；进阶内容折叠待展开。',
    },
    ...(tracks.length > 0 ? [{
      title: '岗位一键勾齐',
      body: `${tracks.join(' / ')}：一键展开该岗位要刷的全部块。`,
    }] : []),
    {
      title: '面试冲刺，有日子就有进度',
      body: '定个目标日期，按「每天刷几题」排好，到日子刚好就绪。',
    },
  ]
  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-8" data-testid="landing">
      {/* ===== Hero：一句话讲清本站 + 真实库量 + 登录/逛逛双入口 ===== */}
      <header className="relative overflow-hidden rounded-2xl border border-paper-line bg-paper-card p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">后端面试 · 知识点训练</p>
            <h1 className="mt-3 font-sans text-4xl font-extrabold leading-tight tracking-tight text-paper-ink md:text-5xl">
              题海刷不完，
              <span className="relative inline-block">
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0.5 h-[0.55em] bg-accent/30" />
                <span className="relative">知识点</span>
              </span>
              刷得完
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-paper-muted">
              每道题拆成要点判分：答错的要点明天优先再来；
              每题配白话讲解，零基础也读得懂术语背后的门道。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={`/api/auth/signin?callbackUrl=${withBase('/')}`} className="btn-primary text-base" data-testid="signin-cta">
                用 GitHub 登录 · 免费开始
              </Link>
              <Link href="/map" className="btn-ghost text-base" data-testid="landing-browse">
                先逛逛知识库
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 md:gap-10">
            <div>
              <dd className="tnum font-mono text-3xl font-semibold text-accent">{totals.cards}</dd>
              <dt className="mt-1 font-mono text-xs text-paper-muted">题目</dt>
            </div>
            <div className="border-l border-paper-line pl-6 md:pl-8">
              <dd className="tnum font-mono text-3xl font-semibold text-paper-ink">{totals.blocks}</dd>
              <dt className="mt-1 font-mono text-xs text-paper-muted">知识块</dt>
            </div>
            <div className="border-l border-paper-line pl-6 md:pl-8">
              <dd className="tnum font-mono text-3xl font-semibold text-paper-ink">{totals.categories}</dd>
              <dt className="mt-1 font-mono text-xs text-paper-muted">分类</dt>
            </div>
          </dl>
        </div>
      </header>

      {/* ===== 四条价值：安静的编号列表，不搞卡片墙 ===== */}
      <section aria-labelledby="landing-different" className="mt-16">
        <div className="mb-5 flex items-baseline gap-4">
          <h2 id="landing-different" className="text-lg font-bold text-paper-ink">有什么不一样</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
        </div>
        <ol className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {props.map((p, i) => (
            <li key={p.title} className="border-t border-paper-line pt-5">
              <p className="font-mono text-xs text-paper-muted">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1.5 font-bold text-paper-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== 登录理由 + 免费口径：诚实作答，页尾再给一次入口 ===== */}
      <section aria-labelledby="landing-why-login" className="mt-16">
        <div className="mb-5 flex items-baseline gap-4">
          <h2 id="landing-why-login" className="text-lg font-bold text-paper-ink">为什么要登录</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
        </div>
        <div className="max-w-[68ch] space-y-3 text-[15px] leading-relaxed text-paper-muted">
          <p>
            进度、判分、复习排期都跟着账号走——换台设备也能接着刷。
            用 GitHub 一键登录，几秒钟就能开始。
          </p>
          <p>
            登录即免费刷 2 个完整块（约 30–50 题），走通「学 → 判 → 排」的闭环，
            再决定要不要解锁全部。{' '}
            <Link
              href={`/api/auth/signin?callbackUrl=${withBase('/')}`}
              data-testid="landing-signin-inline"
              className="font-semibold text-accent underline decoration-accent/40 transition-colors duration-150 ease-snap hover:decoration-accent"
            >
              用 GitHub 登录
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
