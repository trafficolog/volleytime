---
id: '3.5.1'
phase: '3'
epic: '3.5'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
depends_on:
  - '3.1.3'
estimated_hours: '1-2'
tags:
  - grammy
  - telegram
  - bot
---

# Task 3.5.1: grammY init + Bot client

## Цель

Создать `apps/bot` с grammY, базовым Bot client, logging middleware, env validation, graceful start/stop.

## Контекст

Бот — отдельный процесс. Он не имеет прямого доступа к БД (для simplicity Phase 3). Общается с `apps/web` через REST API когда нужна business-logic (это в Phase 4+).

В Phase 3 бот делает минимум: запускается, отвечает на `/start`.

## Что должно быть сделано

1. **Установить grammY:**

   ```bash
   pnpm -F @volley-time/bot add grammy
   pnpm -F @volley-time/bot add -D tsx @types/node
   ```

2. **Структура `apps/bot/`:**

   ```
   apps/bot/
   ├── src/
   │   ├── index.ts          # entry point
   │   ├── client.ts         # Bot instance + init
   │   ├── env.ts            # env validation
   │   ├── handlers/
   │   │   └── start.ts      # 3.5.2
   │   └── middlewares/
   │       └── logging.ts
   ├── package.json
   └── tsconfig.json
   ```

3. **`apps/bot/package.json`:**

   ```json
   {
     "name": "@volley-time/bot",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "tsx watch src/index.ts",
       "build": "tsc",
       "start": "node dist/index.js",
       "typecheck": "tsc --noEmit",
       "lint": "eslint .",
       "test": "vitest run"
     },
     "dependencies": {
       "grammy": "^1.x",
       "@volley-time/shared": "workspace:*"
     }
   }
   ```

4. **`apps/bot/tsconfig.json`:**

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src/**/*"]
   }
   ```

5. **`apps/bot/src/env.ts`:**

   ```ts
   const required = (key: string): string => {
     const v = process.env[key]
     if (!v) throw new Error(`${key} is not set`)
     return v
   }

   const optional = (key: string): string | undefined => process.env[key]

   export const env = {
     TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
     TELEGRAM_BOT_USERNAME: required('TELEGRAM_BOT_USERNAME'),
     WEB_URL: optional('BETTER_AUTH_URL') ?? 'http://localhost:3000',
   } as const
   ```

6. **`apps/bot/src/client.ts`:**

   ```ts
   import { Bot } from 'grammy'
   import { env } from './env'

   export interface BotContext {
     /* extend ctx if needed later */
   }

   export const bot = new Bot(env.TELEGRAM_BOT_TOKEN)
   ```

7. **`apps/bot/src/middlewares/logging.ts`:**

   ```ts
   import type { MiddlewareFn } from 'grammy'

   export const loggingMiddleware: MiddlewareFn = async (ctx, next) => {
     const start = Date.now()
     const update = ctx.update
     const userId = ctx.from?.id
     const updateType = Object.keys(update).filter((k) => k !== 'update_id')[0]
     console.log(`[bot] ← update_id=${update.update_id} type=${updateType} from=${userId}`)
     try {
       await next()
     } finally {
       const ms = Date.now() - start
       console.log(`[bot] → handled update_id=${update.update_id} in ${ms}ms`)
     }
   }
   ```

8. **`apps/bot/src/index.ts`:**

   ```ts
   import { bot } from './client'
   import { loggingMiddleware } from './middlewares/logging'
   import { registerStartHandler } from './handlers/start'

   async function main() {
     bot.use(loggingMiddleware)
     registerStartHandler(bot)

     bot.catch((err) => {
       console.error('[bot] error:', err)
     })

     // Graceful shutdown
     const stop = async () => {
       console.log('[bot] stopping...')
       await bot.stop()
       process.exit(0)
     }
     process.on('SIGINT', stop)
     process.on('SIGTERM', stop)

     console.log('[bot] starting in long-polling mode...')
     await bot.start({
       onStart: (botInfo) => {
         console.log(`[bot] @${botInfo.username} is ready`)
       },
     })
   }

   main().catch((err) => {
     console.error('[bot] fatal:', err)
     process.exit(1)
   })
   ```

9. **Graceful skip если bot token отсутствует:**
   - В `env.ts` вместо `throw` сделать опциональный режим:
   ```ts
   const botToken = process.env.TELEGRAM_BOT_TOKEN
   if (!botToken) {
     console.warn('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled')
     process.exit(0) // graceful exit, не падаем
   }
   ```
   Это позволит `pnpm dev` работать без настроенного бота для frontend-разработчика.

## Критерии приёмки

- ✅ `pnpm -F @volley-time/bot dev` запускает бот в long-polling режиме
- ✅ В логах видно `[bot] @volleytime_dev_bot is ready`
- ✅ Если `TELEGRAM_BOT_TOKEN` не задан — бот выводит warning и graceful exit (без ошибки)
- ✅ Ctrl+C корректно останавливает бот (SIGINT)
- ✅ Логирование middleware пишет каждый update в console
- ✅ Build (`pnpm -F @volley-time/bot build`) создаёт `dist/`
- ✅ `pnpm -F @volley-time/bot typecheck` проходит

## Подсказки

- **`tsx watch`** — для dev, перезапускает бот при изменении кода. Аналог nodemon, но TypeScript-aware.
- **Bot должен останавливаться graceful** — иначе Telegram считает что бот всё ещё запущен (через long-polling это lock), новый процесс не сможет стартовать `409 Conflict`.
- **Если получаешь `409 Conflict`** — где-то уже запущен бот с этим токеном. Останови всех (часто помогает `pkill -f bot` или ребут).

## Не делать

- ❌ Не подключать webhook mode — это Phase 9
- ❌ Не создавать FSM / scenes — пока не нужно
- ❌ Не подключать grammy plugins (sessions, conversations) — добавим когда понадобится
- ❌ Не интегрировать БД напрямую — через REST к apps/web (Phase 4+)
