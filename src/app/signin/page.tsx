import { GitHubButton } from './GitHubButton.js'

/**
 * 自定义登录页（auth.ts pages.signIn 注册）：NextAuth 默认页是白底英文裸页，
 * 与本站图纸蓝视觉断裂。此页只做三件事——告诉用户为什么登录（进度跟账号走）、
 * 一个 GitHub 登录按钮、一条回家的路。
 * searchParams：error（OAuth 回跳失败码，友好文案兜底）与 callbackUrl（回原页）。
 */
export default async function SignInPage(
  { searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> },
): Promise<React.JSX.Element> {
  const { error, callbackUrl } = await searchParams
  return (
    <div className="flex min-h-[72vh] items-center justify-center px-6 py-16">
      <section
        data-testid="signin-card"
        className="w-full max-w-md rounded-2xl border border-paper-line bg-paper-card p-8 md:p-10"
      >
        <p className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-accent" />
          <span className="text-[15px] font-bold tracking-tight text-paper-ink">面试刷题</span>
        </p>
        <p className="eyebrow mt-8">登录</p>
        <h1 className="mt-3 font-sans text-3xl font-extrabold leading-tight tracking-tight text-paper-ink">
          一键登录，
          <span className="relative inline-block">
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0.5 h-[0.55em] bg-accent/30" />
            <span className="relative">进度</span>
          </span>
          跟你走
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-paper-muted">
          进度、判分、复习排期都跟着 GitHub 账号走——换设备接着刷。
          目前仅支持 GitHub 登录。
        </p>
        {error !== undefined && (
          <p role="alert" className="mt-5 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-paper-ink">
            登录没有成功，再试一次就好。
          </p>
        )}
        <div className="mt-8">
          <GitHubButton callbackUrl={callbackUrl ?? '/'} />
        </div>
        <a
          href="/"
          className="mt-5 inline-block text-sm text-paper-muted underline decoration-paper-line transition-colors duration-150 ease-snap hover:text-paper-ink hover:decoration-paper-muted"
        >
          返回首页
        </a>
      </section>
    </div>
  )
}
