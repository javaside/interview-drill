import type { Config } from 'tailwindcss'
export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 暖白纸感编辑风：页面是纸，内容是墨，赭红是唯一强调色（红笔批改）
        paper: {
          DEFAULT: '#FAF8F3', // 页面底：暖白
          deep: '#F4F0E6',    // 更沉一档的纸（分区/页脚），同色相不跳变
          card: '#FFFEFA',    // 纸卡（微微偏暖的白，与底拉开半档）
          line: '#E5DFD1',    // 暖灰细线
          ink: '#211D16',     // 墨（近黑暖调）
          muted: '#6F6A5D',   // 次级文字（暖灰）
          wash: '#F1ECDF',    // 悬停/禁用的纸面微沉
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
        serif: ['"LXGW WenKai Screen"', '"Songti SC"', '"Noto Serif SC"', 'STSong', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      // 染色阴影：影随纸色（暖褐）而非纯黑——光从上来，影落在纸面
      boxShadow: {
        paper: '0 1px 2px rgba(87, 74, 51, 0.06), 0 2px 8px rgba(87, 74, 51, 0.05)',
        'paper-lg': '0 2px 4px rgba(87, 74, 51, 0.07), 0 10px 28px rgba(87, 74, 51, 0.10)',
        stamp: '0 1px 3px rgba(158, 58, 34, 0.35)',
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
