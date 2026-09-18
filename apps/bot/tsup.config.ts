import { defineConfig } from 'tsup'

/** Прод-сборка бота в JS (Task 9.9.10): в образе нет tsx и исходников TS. */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // воркспейс-пакеты бандлим, внешние зависимости оставляем в node_modules
  noExternal: [/^@volley-time\//],
  sourcemap: true,
  clean: true,
})
