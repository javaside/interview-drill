import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['tests/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'jsdom', environment: 'jsdom',
          include: ['tests/app/**/*.test.tsx'],
          setupFiles: ['tests/app/setup.ts'],
        },
      },
    ],
  },
})
