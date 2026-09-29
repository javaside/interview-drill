import type { Config } from 'tailwindcss'
export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 蓝图纸 + 荧光笔：工程面试的世界是图纸与划重点。
        // 荧光黄是唯一强调色——语义=「荧光笔划重点」，选中/强调全靠它。
        paper: {
          DEFAULT: '#0F1826',   // 图纸深蓝（带明确蓝调，非 near-black）
          deep: '#0C1420',
          card: '#16202F',      // 卷面卡（蓝灰）
          line: '#253246',      // 蓝灰细线
          ink: '#EDF1F7',       // 粉笔白主文字
          muted: '#8C9AB3',     // 蓝灰次级
          wash: '#1C2938',      // 悬停面
        },
        accent: {
          DEFAULT: '#FACC15',   // 荧光黄 marker——选中它=划重点
          soft: '#FACC151F',    // 荧光笔扫过（黄 12% 透明）
        },
        mark: {
          good: { DEFAULT: '#4ADE80', soft: '#0F2A1E' },
          miss: { DEFAULT: '#FBBF24', soft: '#2B2410' },
          bad: { DEFAULT: '#F87171', soft: '#301420' },
        },
      },
      fontFamily: {
        // 图纸风：黑体标题 + 系统正文 + mono 数字；无衬线花活
        serif: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(4, 10, 20, 0.4)',
        raised: '0 4px 16px rgba(4, 10, 20, 0.5)',
        marker: '0 0 0 1px rgba(250, 204, 21, 0.35), 0 0 20px rgba(250, 204, 21, 0.12)',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
} satisfies Config