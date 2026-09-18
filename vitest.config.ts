import { defineConfig } from 'vitest/config'

/**
 * Проекты (Task 3.9.11):
 * - unit — без БД: shared, bot, web
 * - integration — пакеты, работающие с Postgres: db, core, auth
 */
const shared = {
  globals: true,
  environment: 'node' as const,
  setupFiles: ['./vitest.setup.ts'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', 'legacy/**'],
}

export default defineConfig({
  test: {
    ...shared,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.config.ts', '**/dist/**', '**/*.test.ts'],
    },
    projects: [
      {
        test: {
          ...shared,
          name: 'unit',
          include: [
            'packages/shared/src/**/*.{test,spec}.ts',
            'apps/bot/src/**/*.{test,spec}.ts',
            'apps/web/server/**/*.{test,spec}.ts',
            'apps/web/app/**/*.{test,spec}.ts',
          ],
          exclude: [...shared.exclude, '**/*.integration.test.ts'],
        },
      },
      {
        test: {
          ...shared,
          name: 'integration',
          include: [
            'packages/db/src/**/*.{test,spec}.ts',
            'packages/core/src/**/*.{test,spec}.ts',
            'packages/auth/src/**/*.{test,spec}.ts',
            'apps/web/server/**/*.integration.test.ts',
          ],
          // общий Postgres: файлы не параллелим, чтобы cleanup одного не мешал другому
          fileParallelism: false,
        },
      },
    ],
  },
})
