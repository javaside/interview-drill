import type { Config } from 'tailwindcss'
export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 暖白纸感编辑风：页面是纸，内容是墨，赭红是唯一强调色（红笔批改）
        paper: {
          DEFAULT: '#FAF8F3', // 页面底：暖白
          card: '#FFFFFF',    // 纸卡
          line: '#E7E2D6',    // 暖灰细线
          ink: '#211D16',     // 墨（近黑暖调）
          muted: '#6F6A5D',   // 次级文字（暖灰）
          wash: '#F3EFE5',    // 悬停/禁用的纸面微沉
        },
        accent: {
          DEFAULT: '#9E3A22', // 赭红——全站唯一强调色（§10.1：只用于功能强调，不构成付费提示文案）
          soft: '#F6E8E0',
        },
        // 屏② 判分三态：降饱和的纸面批注色（勾对苔绿/漏选赭黄/错勾砖红）
        mark: {
          good: { DEFAULT: '#4A6741', soft: '#EEF1E4' },
          miss: { DEFAULT: '#96700F', soft: '#F7F0D8' },
          bad: { DEFAULT: '#A2402F', soft: '#F8E9E4' },
        },
      },
      fontFamily: {
        serif: ['"Songti SC"', '"Noto Serif SC"', 'STSong', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
} satisfies Config
