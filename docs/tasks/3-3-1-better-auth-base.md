---
id: '3.3.1'
phase: '3'
epic: '3.3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
depends_on:
  - '3.2.3'
estimated_hours: '2'
tags:
  - auth
  - better-auth
  - email-code
---

# Task 3.3.1: better-auth базовая установка + email-code provider

## Цель

Установить better-auth в `packages/auth`, настроить email-code provider (passwordless), создать публичный экспорт `auth` instance для использования в `apps/web`.

## Контекст

better-auth — TypeScript-first auth-библиотека с email-code provider из коробки. На этой задаче мы **проверяем**, насколько она нам подходит. Если возникнут проблемы — есть fallback на Lucia (см. ниже).

## Что должно быть сделано

1. **Установить better-auth:**

   ```bash
   pnpm -F @volley-time/auth add better-auth
   pnpm -F @volley-time/auth add @volley-time/db
   ```

2. **Структура `packages/auth/`:**

   ```
   packages/auth/
   ├── src/
   │   ├── index.ts        # публичный экспорт `auth`
   │   ├── config.ts       # конфигурация better-auth
   │   ├── email-code.ts   # email-code provider plugin
   │   ├── telegram.ts     # Telegram provider (3.3.3)
   │   └── env.ts
   ├── package.json
   └── tsconfig.json
   ```

3. **`src/env.ts`:**

   ```ts
   const required = (key: string): string => {
     const v = process.env[key]
     if (!v) throw new Error(`${key} is not set`)
     return v
   }

   export const env = {
     BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
     BETTER_AUTH_URL: required('BETTER_AUTH_URL'),
   } as const
   ```

4. **`src/email-code.ts`** — provider (реализуется в 3.3.2 деталь sendCode):

   ```ts
   import type { BetterAuthPlugin } from 'better-auth'

   export interface EmailCodeOptions {
     sendCode: (params: { email: string; code: string }) => Promise<void>
     codeLength?: number
     codeExpiresInMinutes?: number
     rateLimitPerEmailSeconds?: number
     maxAttempts?: number
   }

   export function emailCode(options: EmailCodeOptions): BetterAuthPlugin {
     // ... здесь сама механика: generate code, save to verification_tokens, send, verify
     // Подробности зависят от API better-auth — финализируется при реализации
     return {/* plugin object */}
   }
   ```

5. **`src/config.ts`:**

   ```ts
   import { betterAuth } from 'better-auth'
   import { drizzleAdapter } from 'better-auth/adapters/drizzle'
   import { db } from '@volley-time/db'
   import { users, accounts, sessions, verificationTokens } from '@volley-time/db'
   import { env } from './env'
   import { emailCode } from './email-code'
   import { devEmailLogger } from './email-logger' // см. 3.3.2

   export const auth = betterAuth({
     database: drizzleAdapter(db, {
       provider: 'pg',
       schema: {
         user: users,
         account: accounts,
         session: sessions,
         verification: verificationTokens,
       },
     }),
     secret: env.BETTER_AUTH_SECRET,
     baseURL: env.BETTER_AUTH_URL,
     session: {
       cookieCache: { enabled: true, maxAge: 5 * 60 }, // cache session in cookie 5 min
       expiresIn: 60 * 60 * 24 * 30, // 30 days
     },
     plugins: [
       emailCode({
         sendCode: devEmailLogger,
         codeLength: 6,
         codeExpiresInMinutes: 10,
         rateLimitPerEmailSeconds: 60,
         maxAttempts: 5,
       }),
     ],
   })
   ```

6. **`src/index.ts`:**
   ```ts
   export { auth } from './config'
   export type { Auth } from './config'
   ```

## Критерии приёмки

- ✅ Пакет компилируется (`pnpm typecheck`)
- ✅ better-auth instance создаётся без ошибок при запуске
- ✅ Email-code provider реализован: `auth.api.sendCode({ email })` создаёт запись в `verification_tokens` с 6-значным кодом
- ✅ `auth.api.verifyCode({ email, code })` — при правильном коде создаёт User, Session, возвращает cookies
- ✅ Rate limit: повторный `sendCode` в течение 60 сек → ошибка 429
- ✅ Wrong code 5 раз — блокирует код, требуется новый
- ✅ Code expired (>10 мин) — ошибка

## Подсказки

- **Документация better-auth:** https://better-auth.com (актуальная на момент 2026-05). Email-code provider там описан, но возможно потребуется кастомный plugin если стандартный не подходит.
- **Drizzle adapter** требует соответствия имён колонок в schema better-auth defaults: `id`, `email`, `email_verified`, `name`. Наша schema (из 3.2.2) уже соответствует.
- **`cookieCache: true`** — оптимизация, session info хранится в cookie (encrypted), не делается БД-запрос каждый раз.
- **Если sendCode и verifyCode API better-auth не подходят** — implement свой plugin (см. их examples).

## Fallback план

Если в процессе работы обнаружится, что better-auth **не подходит**:

1. Сохрани анализ проблем в `docs/operations/sessions/2026-05-XX-better-auth-evaluation.md`
2. Установи Lucia v3: `pnpm -F @volley-time/auth add lucia oslo`
3. Перепиши `packages/auth` под Lucia — сохранив тот же публичный API (`auth.api.sendCode`, `auth.api.verifyCode`)
4. Это переписывание ~6 часов работы — но другие пакеты не страдают, потому что они импортируют `auth` через consistent interface

## Не делать

- ❌ Не реализовывать sendCode напрямую (это 3.3.2 — отдельная задача)
- ❌ Не делать Telegram identity — это 3.3.3
- ❌ Не делать account linking — это 3.3.4
- ❌ Не сохранять пароли в БД
- ❌ Не оптимизировать раньше времени (Redis sessions, etc.) — БД достаточно для MVP
