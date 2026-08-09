import { defineConfig } from 'vitest/config'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, './src'),
}

const coverage = {
  provider: 'v8' as const,
  reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
  reportsDirectory: './coverage',
  thresholds: {
    lines: 65,
    functions: 70,
    branches: 55,
    statements: 65,
  },
  exclude: [
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**',
    '**/tests/**',
    '**/workshop/**',
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
          name: 'workshop',
          include: ['workshop/subaru/**/*.test.ts'],
          exclude: ['node_modules', '.next'],
          environment: 'node',
        },
      },
    ],
    coverage,
  },
})
