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
  // 怎么用：四步一环扣一环。讲「用户要做什么、会得到什么」，与下面的差异点是两个角度。
  const loop: Array<{ step: string; body: string }> = [
    { step: '学', body: '按知识块通读教材，先理解再做题——不是上来就考你。' },
    { step: '练', body: '按计划出题，交卷立刻出结果；想专门练某一块也行。' },
    { step: '判', body: '逐条判给你看：漏了哪条、错勾了哪条——答错的明天就回来。' },
    { step: '排', body: '定个目标日期，倒推每天刷几题，到日子刚好就绪。' },
  ]

  const props: Array<{ title: string; body: string }> = [
    // 标题一律写成「用户会问自己的那句话」——扫一眼就能对号入座，
    // 而不是「我们有什么功能」。用过的人懂，没用过的人也能立刻懂。
    {
      title: '卡住了没人问？',
      body: '每题都能追问 AI：这个选项为什么不对、交卷后我错在哪。它只围绕这道题讲。',
    },
    {
      title: '看不懂术语？',
      body: '先用大白话讲清「为什么」，再对应上正式的面试说法。零基础也读得懂。',
    },
    ...(tracks.length > 0 ? [{
      title: '不知道从哪刷起？',
      body: `${tracks.join(' / ')}：点一下，这个岗位该刷的块全勾上。`,
    }] : []),
    {
      // 讲的是「临时加急」这个场景（cram：把选中块重铺成冲刺计划），
      // 与上面「排」一步的常规倒推排期是两件事，别写成同一句。
      title: '面试就剩几天？',
      body: '把要考的块重铺成冲刺计划，集中过一遍还没掌握的。',
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
            <p data-testid="landing-hero-copy" className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-paper-muted">
              知识点不是背会的，是练会的。
              填了面试日期，题自己会排：最常问的先来，没记住的追着你练，练熟的少打扰；到面试前，每道题都刚练过。
              不填日期也能刷：该复习的自己回来，想单刷哪一块随时挑。
              不懂的题，直接问 AI——像问老师一样，问到懂。
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

      {/* ===== 怎么用：学 → 练 → 判 → 排，四步一环扣一环 ===== */}
      <section aria-labelledby="landing-loop" className="mt-16">
        <div className="mb-5 flex items-baseline gap-4">
          <h2 id="landing-loop" className="text-lg font-bold text-paper-ink">怎么用</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
        </div>
        <ol data-testid="landing-loop" className="grid gap-x-8 gap-y-6 md:grid-cols-4">
          {loop.map((s, i) => (
            <li key={s.step} className="border-t border-paper-line pt-4">
              <p className="font-mono text-xs text-paper-muted">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1.5 text-lg font-bold leading-none text-accent">{s.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== 价值主张：安静的编号列表，不搞卡片墙 ===== */}
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
            进度、判分、复习计划都跟着账号走——换台设备也能接着刷。
            用 GitHub 一键登录，几秒钟就能开始。
          </p>
          <p>
            登录即免费刷 2 个知识块（约 30–50 题），完整走一遍「学 → 练 → 判 → 排」，
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
