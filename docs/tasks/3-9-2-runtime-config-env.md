---
id: '3.9.2'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P0 #1 (корневая причина 1; закрывает также 4 P0#2, 8 P0#2, 9 P0#5)'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.9.1'
estimated_hours: '2-3'
tags:
  - env
  - nuxt
  - telegram
  - security
  - review-fix
---

# Task 3.9.2: Env → runtimeConfig: явный маппинг и fail-fast; validateInitData отвергает пустой токен

## Цель

Убрать подделку Telegram-входа и пустые значения конфигурации: web читает `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `BOT_INTERNAL_URL`, `BOT_INTERNAL_SECRET`, `WEB_URL` из привычных переменных, а при их отсутствии в production не стартует.

## Контекст

`runtimeConfig.telegramBotToken` всегда пустой: Nuxt переопределяет runtimeConfig только из `NUXT_*`, а `.env`/`.env.prod` задают `TELEGRAM_BOT_TOKEN`. В ревью: initData, подписанный настоящим токеном → 401; подписанный **пустой строкой** → 200 и сессия. Та же причина ломает имя бота в инвайтах (4 P0#2), адрес/секрет internal notify (8 P0#2) и прод-конфиг (9 P0#5).

## Что должно быть сделано

1. `apps/web/server/utils/config.ts` — единая точка чтения и валидации:

   ```ts
   export function readServerEnv(env = process.env) {
     const isProd = env.NODE_ENV === 'production'
     const cfg = {
       telegramBotToken: env.NUXT_TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN ?? '',
       telegramBotUsername:
         env.NUXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? env.TELEGRAM_BOT_USERNAME ?? '',
       botInternalUrl:
         env.NUXT_BOT_INTERNAL_URL ??
         env.BOT_INTERNAL_URL ??
         (isProd ? '' : 'http://localhost:3001'),
       botInternalSecret:
         env.NUXT_BOT_INTERNAL_SECRET ??
         env.BOT_INTERNAL_SECRET ??
         (isProd ? '' : 'dev-internal-secret'),
       webUrl: env.NUXT_PUBLIC_WEB_URL ?? env.WEB_URL ?? '',
     }
     const missing = Object.entries(REQUIRED)
       .filter(([k]) => !cfg[k])
       .map(([, n]) => n)
     return { cfg, missing }
   }
   ```

2. `nuxt.config.ts` — `runtimeConfig` заполняется из `process.env` (значения при build/dev), а в runtime дополнительно из `NUXT_*`.
3. Nitro-плагин `server/plugins/00.config-check.ts`: в production при `missing.length` → `throw` (процесс не стартует), в dev — `console.warn`.
4. `validateInitData(initData, botToken)`: `if (!botToken) throw new TelegramAuthError('Bot token is not configured')`.
5. `telegram.post.ts` использует проверенный токен; пустой → 500 «misconfigured», а не попытка валидации.
6. Тесты: `readServerEnv` (маппинг, missing в prod), `validateInitData('', …)` бросает, initData подписанный пустым токеном отвергается.

## Критерии приёмки

- ✅ `TELEGRAM_BOT_TOKEN` из `.env` попадает в `useRuntimeConfig().telegramBotToken`
- ✅ initData, подписанный пустой строкой → 401/500, **никогда** 200
- ✅ `validateInitData` с пустым токеном бросает `TelegramAuthError`
- ✅ Прод-старт без `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`/`BOT_INTERNAL_URL`/`BOT_INTERNAL_SECRET`/`WEB_URL` → процесс завершается с понятной ошибкой
- ✅ Юнит-тесты на маппинг и fail-fast

## Подсказки

- Nuxt: `runtimeConfig` в `nuxt.config` вычисляется на этапе сборки; в runtime его перекрывают только `NUXT_*`. Поэтому fail-fast проверяет итоговое значение `useRuntimeConfig()` + fallback на `process.env` в плагине.
- Compose (9.9.5) дополнительно пробрасывает `NUXT_*` — двойная страховка.

## Не делать

- ❌ Не оставлять дефолтные секреты в production
- ❌ Не логировать значения секретов в fail-fast сообщении — только имена переменных
