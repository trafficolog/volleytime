---
id: '3.9.4'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P0 #3'
priority: P0
roles:
  - BACK
  - FE
  - SECURITY
depends_on:
  - '3.9.3'
estimated_hours: '3-4'
tags:
  - better-auth
  - telegram
  - session
  - review-fix
---

# Task 3.9.4: Единая система сессий: Telegram-вход создаёт сессию better-auth

## Цель

Один источник сессий: Telegram Mini App вход выдаёт стандартную cookie better-auth, `useAuth`/`get-session` видят пользователя, `vt_session` удалён.

## Контекст

Telegram ставил собственную cookie `vt_session` (своя таблица-логика в `packages/auth/telegram/session.ts`), фронт (`useAuth`) знал только better-auth → с валидной `vt_session` `/m/orgs` редиректил на `/auth/login`. `requireAuth` поддерживал два источника — лишняя поверхность атаки.

## Что должно быть сделано

1. better-auth плагин `telegramPlugin({ botToken })` с эндпоинтом `POST /api/auth/sign-in/telegram`:

   ```ts
   const endpoint = createAuthEndpoint(
     '/sign-in/telegram',
     { method: 'POST', body: z.object({ initData: z.string().min(1) }) },
     async (ctx) => {
       const { userId } = await authenticateViaTelegram(ctx.body.initData, botToken)
       const session = await ctx.context.internalAdapter.createSession(String(userId))
       const user = await ctx.context.internalAdapter.findUserById(String(userId))
       await setSessionCookie(ctx, { session, user })
       return ctx.json({ userId, isNewUser })
     },
   )
   ```

2. `apps/web/server/api/auth/telegram.post.ts` удалить (маршрут обслуживает `[...auth]`); фронт `useTelegram.authenticate()` → `/api/auth/sign-in/telegram`, затем `fetchSession()`.
3. `requireAuth` — только `auth.api.getSession`.
4. Удалить `createSessionForUser/findValidSession/revokeSession` и тесты на них; интеграционные тесты Phase 8 переписать на плагин.
5. ADR в карточке: хеш session token — accepted risk (better-auth хранит token, cookie подписана `BETTER_AUTH_SECRET`); OTP/verification — хешем (3.9.3).

## Критерии приёмки

- ✅ После Telegram-входа `GET /api/auth/get-session` возвращает пользователя
- ✅ `/m/orgs` открывается после Telegram-входа без редиректа на логин
- ✅ Cookie `vt_session` нигде не используется (`grep -r vt_session` → 0)
- ✅ Интеграционный тест: sign-in/telegram → get-session → `/api/organizations` 200

## Подсказки

- `setSessionCookie` экспортируется из `better-auth/cookies`, `createAuthEndpoint` — из `better-auth/api`.

## Не делать

- ❌ Не хранить параллельную таблицу/cookie сессий
- ❌ Не принимать initData без проверки подписи и срока (3.9.10)
