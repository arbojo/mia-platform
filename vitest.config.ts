import { defineConfig } from 'vitest/config'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, './src'),
}

const coverage = {
  provider: 'v8' as const,
  reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
  reportsDirectory: './coverage',
  // Ratchet, not a target: set just under the measured baseline (lines 67.49,
  // functions 59.31, branches 58.58, statements 65.55) so the gate catches
  // regressions instead of failing on coverage that was never achieved.
  thresholds: {
    lines: 62,
    functions: 55,
    branches: 50,
    statements: 60,
  },
  exclude: [
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**',
    '**/tests/**',
    '**/scripts/**',
    '**/*.config.{js,ts}',
    '**/*.d.ts',
    'src/app/**',
    'src/components/ui/**',
    'src/lib/channels/adapters/**',
  ],
}

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['node_modules', '.next', 'tests/e2e/**'],
          environment: 'node',
          testTimeout: 30000,
          setupFiles: ['./tests/setup.ts'],
        },
        resolve: { alias },
      },
      {
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.tsx'],
          exclude: ['node_modules', '.next', 'tests/e2e/**'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts', './tests/setup-component.ts'],
        },
        resolve: { alias },
      },
      {
        test: {
          name: 'scripts',
          include: ['scripts/__tests__/**/*.test.ts'],
          exclude: ['node_modules', '.next'],
          environment: 'node',
          testTimeout: 30000,
        },
      },
    ],
    coverage,
  },
})
