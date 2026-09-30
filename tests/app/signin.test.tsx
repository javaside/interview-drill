import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from '../../src/app/signin/page.js'

// signIn 是 client 侧 OAuth 跳转入口（拿 csrf → 跳 GitHub），测试里替换成 spy
const signIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}))

const page = (params: Record<string, string | undefined> = {}) =>
  SignInPage({ searchParams: Promise.resolve(params) })

test('登录卡渲染：品牌 + 标题 + 说明 + 提交按钮 + 返回首页', async () => {
  render(await page())
  const card = screen.getByTestId('signin-card')
  expect(card).toHaveTextContent('面试刷题')
  expect(card).toHaveTextContent('一键登录')
  expect(card).toHaveTextContent('进度跟你走')
  expect(card).toHaveTextContent('换设备接着刷')
  expect(screen.getByTestId('signin-submit')).toHaveTextContent('使用 GitHub 登录')
  expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/')
})

test('无 error 参数不出错误提示；有 error 出 role=alert 友好文案', async () => {
  const { unmount } = render(await page())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  unmount()

  render(await page({ error: 'OAuthCallback' }))
  expect(screen.getByRole('alert')).toHaveTextContent('登录没有成功，再试一次就好')
})

test('点提交按钮：signIn("github", { callbackUrl })，无参回首页', async () => {
  render(await page())
  await userEvent.click(screen.getByTestId('signin-submit'))
  expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/' })
})

test('callbackUrl 透传：从哪来回哪去（OAuth 回跳后再回原页）', async () => {
  render(await page({ callbackUrl: '/practice?block=b1' }))
  await userEvent.click(screen.getByTestId('signin-submit'))
  expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/practice?block=b1' })
})
