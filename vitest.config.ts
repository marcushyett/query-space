import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Use happy-dom instead of jsdom - significantly faster (2-3x)
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.tsx'],
    include: ['**/*.test.{ts,tsx}'],
    // Run test files in parallel
    fileParallelism: true,
    // Vitest 4 pool configuration (options are now top-level)
    pool: 'threads',
    maxWorkers: 4,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'vitest.config.ts',
        'vitest.setup.tsx',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
