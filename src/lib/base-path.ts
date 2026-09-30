/**
 * 站点基路径（2026-09-30 生产共域部署）：drill 整站挂在 https://xibaojun.com/drill/ 下，
 * 与同域的 xibaojun（Spring /api/**、/admin/）零交集。
 * - next.config.ts basePath（页面/Link/静态资源自动带前缀）与此处必须同值；
 * - 裸 fetch 与服务端 redirect() **不会**自动带前缀——一律经 withBase()；
 * - NextAuth 基路径 = withBase('/api/auth')（服务端由 NEXTAUTH_URL 的 path 决定，
 *   客户端由根布局 SessionProvider basePath 决定）。
 */
export const BASE_PATH = '/drill'

/** 站内绝对路径 → 带基路径（输入须以 / 开头；根路径归一为 /drill 不带尾斜杠） */
export function withBase(path: string): string {
  return path === '/' ? BASE_PATH : `${BASE_PATH}${path}`
}
