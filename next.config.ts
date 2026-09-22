import type { NextConfig } from 'next'
export default {
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
