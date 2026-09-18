---
id: '3.9.3'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P0 #2 (корневая причина 2; закрывает 9 P0#1)'
priority: P0
roles:
  - BACK
  - DB
depends_on:
  - '3.9.2'
estimated_hours: '3-4'
tags:
  - better-auth
  - drizzle
  - migrations
  - review-fix
---

# Task 3.9.3: Схема БД, совместимая с better-auth: verifications, sessions.updatedAt, accounts, числовые ID

## Цель

Сделать email-OTP вход рабочим: схема Drizzle соответствует модели better-auth 1.7, адаптер работает с serial ID, есть интеграционный тест полного OTP-цикла.

## Контекст

`send-verification-otp` → HTTP 500 `SchemaMismatch`: нет таблицы `verifications`, у `sessions` нет `updated_at`, у `accounts` нет колонок токенов/`password`/`scope`. `config.test.ts` проверял только создание инстанса. В прод-сборке (9 P0#1) better-auth падает на **любом** обращении к сессии.

## Что должно быть сделано

1. Схема:
   - `verifications` (`id serial`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`)
   - `sessions.updated_at timestamptz not null default now()`
   - `accounts`: `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`
2. Миграция `drizzle-kit generate` (+ ручная проверка SQL).
3. `config.ts`:

   ```ts
   betterAuth({
     database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
     advanced: { database: { generateId: 'serial' } },
     verification: { storeIdentifier: 'hashed' },
     plugins: [emailOTP({ ..., storeOTP: 'hashed' })],
   })
   ```

4. Интеграционный тест `email-otp.integration.test.ts`: `sendVerificationOTP` (перехват письма через тестовый драйвер) → `signInEmailOTP` → `getSession` по cookie → user.id — число.

## Критерии приёмки

- ✅ `POST /api/auth/email-otp/send-verification-otp` → 200
- ✅ Полный цикл send → sign-in → get-session проходит в тесте на реальном Postgres
- ✅ ID пользователя/сессии — числа (serial)
- ✅ OTP хранится в БД хешем, не открытым текстом

## Подсказки

- `usePlural: true` → модели `users/sessions/accounts/verifications`.
- Для перехвата кода в тесте — `EMAIL_DRIVER=memory` (новый драйвер, только для тестов).

## Не делать

- ❌ Не использовать `db:push` — только миграции
- ❌ Не хранить OTP в открытом виде
