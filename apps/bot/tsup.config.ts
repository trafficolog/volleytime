import { defineConfig } from 'tsup'

/** Прод-сборка бота в JS (Task 9.9.10): в образе нет tsx и исходников TS. */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // воркспейс-пакеты бандлим, внешние зависимости оставляем в node_modules; zod тоже бандлится
  // (22.3.1): его тянет `@volley-time/shared`, а в рантайм-образе нет `packages/shared/node_modules`
  noExternal: [/^@volley-time\//, 'zod'],
  sourcemap: true,
  clean: true,
})
