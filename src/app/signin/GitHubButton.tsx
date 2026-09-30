'use client'
import { signIn } from 'next-auth/react'

/**
 * GitHub 登录按钮（client）：signIn('github') 走 NextAuth 的
 * csrf → GitHub OAuth → 回跳链路；callbackUrl 由页面透传，
 * 登录成功后回到出发页（无参回首页今日卷）。
 */
export function GitHubButton({ callbackUrl }: { callbackUrl: string }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => { void signIn('github', { callbackUrl }) }}
      className="btn-primary w-full justify-center text-base"
      data-testid="signin-submit"
    >
      使用 GitHub 登录
    </button>
  )
}
