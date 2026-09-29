/**
 * 登录提示（登录逻辑 v2）：浏览零门槛（首页/知识库默认可见），
 * 动作时刻（刷题/学习）才要身份——给出说明与 GitHub 登录入口，
 * 不再静默 redirect 到 NextAuth 默认页。
 */
export function SignInPrompt({ what }: { what: string }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-28 pt-16" data-testid="signin-prompt">
      <section className="relative overflow-hidden rounded-2xl border border-paper-line bg-paper-card p-8 md:p-12">
        <p className="eyebrow">需要登录</p>
        <h1 className="mt-3 font-sans text-3xl font-extrabold leading-tight tracking-tight text-paper-ink md:text-4xl">
          {what}前，先登录
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-paper-muted">
          进度、判分和复习排期都跟着账号走。用 GitHub 一键登录，几秒钟就能开始；
          知识库无需登录，随时可以先逛逛。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="/api/auth/signin" className="btn-primary text-base" data-testid="signin-cta">
            使用 GitHub 登录
          </a>
          <a
            href="/map"
            className="rounded-lg border border-paper-line px-4 py-2.5 text-sm text-paper-muted transition-colors duration-150 ease-snap hover:border-paper-muted hover:text-paper-ink"
          >
            先逛逛知识库
          </a>
        </div>
      </section>
    </div>
  )
}
