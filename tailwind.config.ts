import type { Config } from 'tailwindcss'
export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ethereal Glass：OLED 深底 + 纸白文字 + Emerald 唯一强调
        paper: {
          DEFAULT: '#050506',   // OLED 近黑（禁纯黑 #000）
          deep: '#08080A',
          card: '#0E0F13',      // 卡内核面
          line: '#232429',      // hairline
          ink: '#EDEEF2',
          muted: '#9BA0AB',
          wash: '#17181D',
        },
        accent: {
          DEFAULT: '#34D399',
          soft: '#0E271F',
        },
        mark: {
          good: { DEFAULT: '#4ADE80', soft: '#0E271F' },
          miss: { DEFAULT: '#FBBF24', soft: '#2A2210' },
          bad: { DEFAULT: '#F87171', soft: '#301418' },
        },
      },
      fontFamily: {
        serif: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // 扩散影：极宽极淡，营造悬浮而非投影
        diffuse: '0 24px 48px -16px rgba(0, 0, 0, 0.55)',
        'diffuse-lg': '0 32px 64px -20px rgba(0, 0, 0, 0.65)',
        stamp: '0 0 16px rgba(52, 211, 153, 0.3)',
      },
      // 全站过渡曲线：无 linear / ease-in-out
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(40px)', filter: 'blur(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
      animation: {
        reveal: 'reveal 0.9s cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
} satisfies Config