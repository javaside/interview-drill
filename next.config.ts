import type { NextConfig } from 'next'
export default {
  // 整站挂 /drill 前缀（生产共域：xibaojun.com/drill；本地 localhost:3000/drill）。
  // Link/路由/静态资源自动带前缀；裸 fetch 与 redirect() 用 lib/base-path 的 withBase()。
  // NextAuth 的 API 基路径 = /drill/api/auth：服务端由 NEXTAUTH_URL 的 path 决定
  // （.env.local / 服务器 .env.production.local），客户端由根布局 SessionProvider basePath 决定。
  basePath: '/drill',
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  // server/lib 内部用 ESM 风格 `.js` 后缀 import（tsc/vitest 的 bundler 解析原生支持）。
  // Next 的 webpack 默认不把 `.js` 映射到 `.ts` 源——补 extensionAlias 使二者一致。
  webpack(config: { resolve: { extensionAlias?: Record<string, string[]> } }) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    }
    return config
  },
} satisfies NextConfig
