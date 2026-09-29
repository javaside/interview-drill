import type { Config } from 'tailwindcss'
export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 深夜刷题：Zinc 深底 + 纸白文字 + 电光青绿强调（掌握/成长的语义色）
        // token 名保持 paper/ink 语义（ink=文字色，paper=底色），值整体反转——组件层平滑迁移
        paper: {
          DEFAULT: '#0C0D10',   // 页面底：Zinc-950 系（禁纯黑）
          deep: '#101116',      // 更沉一档（页脚/分区）
          card: '#15161B',      // 卡面
          line: '#26272E',      // 深灰细线（white/8 一档）
          ink: '#EDEEF2',       // 主文字（纸白）
          muted: '#9BA0AB',     // 次级文字（Zinc-400 系）
          wash: '#1B1D24',      // 悬停/禁用面
        },
        accent: {
          DEFAULT: '#34D399',   // Emerald-400：链接/强调/进度
          soft: '#0E271F',      // 选中底（深绿面）
        },
        // 判分三态（深色适配：亮字色 + 深底面）
        mark: {
          good: { DEFAULT: '#4ADE80', soft: '#0E271F' },
          miss: { DEFAULT: '#FBBF24', soft: '#2A2210' },
          bad: { DEFAULT: '#F87171', soft: '#301418' },
        },
      },
      fontFamily: {
        // 深色软件 UI：去衬线，标题与正文同族不同重（Outfit 有则用，无则系统栈）
        serif: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      // 深色下阴影几乎不可见——发光边与提亮面替代；保留极弱扩散影
      boxShadow: {
        paper: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35)',
        'paper-lg': '0 0 0 1px rgba(255,255,255,0.06), 0 16px 40px rgba(0,0,0,0.5)',
        stamp: '0 0 12px rgba(52, 211, 153, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
} satisfies Config