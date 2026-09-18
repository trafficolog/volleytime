---
id: '8.1.3'
phase: '8'
epic: '8.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - FE
depends_on:
  - '8.1.2'
  - '3.4.2'
  - '3.4.3'
estimated_hours: '1-2'
tags:
  - telegram
  - auth
  - mini-app
---

# Task 8.1.3: Mini App auto-login + email fallback

## Цель

Mini App при загрузке авто-логинится через initData. Если открыт вне Telegram (браузер, нет initData) — fallback на обычный email-логин (3.4.2).

## Контекст

Решение 3: initData основной путь + email fallback. Phase 3 (3.4.3) сделал Mini App entrypoint, (3.4.2) email-логин. Здесь — связываем: внутри Telegram авто-логин, вне — email.

## Что должно быть сделано

1. **Plugin/composable авто-логина `apps/web/plugins/telegram-auth.client.ts`:**

   ```ts
   export default defineNuxtPlugin(async () => {
     // Только на клиенте, только если в Telegram
     const tg = (window as any).Telegram?.WebApp
     if (!tg?.initData) return // не в Telegram → fallback на email

     const { loggedIn, fetchSession } = useAuth() // composable из Phase 3
     if (loggedIn.value) return // уже залогинен

     try {
       await $fetch('/api/auth/telegram-miniapp', {
         method: 'POST',
         body: { initData: tg.initData },
       })
       await fetchSession() // обновить состояние auth
     } catch (e) {
       console.error('[telegram-auth] auto-login failed', e)
       // не блокируем — пользователь увидит email-логин
     }
   })
   ```

2. **Middleware auth (Phase 3) учитывает Telegram-контекст:**
   Обновить auth middleware (3.4.2): если не залогинен И в Telegram → дать plugin отработать (или показать loading), если не в Telegram → redirect на email-логин.

   ```ts
   // middleware/auth.ts — добавить:
   // если process.client и window.Telegram.WebApp.initData есть, но сессии нет —
   // подождать авто-логин (plugin) перед redirect на /login
   ```

3. **Mini App entrypoint (3.4.3)** — индикатор загрузки во время авто-логина:

   ```vue
   <!-- /m/ или layout miniapp: показать loader пока auth резолвится -->
   <div v-if="authPending" class="min-h-screen flex items-center justify-center">
     <div class="text-center">
       <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
       <p class="text-gray-500 text-sm">Загрузка…</p>
     </div>
   </div>
   ```

4. **Fallback flow (браузер):** если нет initData и нет сессии → стандартный email-логин (3.4.2) работает как раньше. Mini App страницы доступны после email-логина.

5. **Edge case:** initData есть, но авто-логин упал (сервер недоступен) → показать сообщение/retry, не белый экран.

## Критерии приёмки

- ✅ В Telegram (initData есть) → авто-логин при загрузке, без формы
- ✅ Уже залогинен → не перелогинивается
- ✅ Вне Telegram (нет initData) → email-логин fallback (3.4.2)
- ✅ Loader во время авто-логина (не белый экран)
- ✅ Авто-логин упал → graceful (сообщение/retry, не краш)
- ✅ После авто-логина Mini App страницы (4-6) доступны
- ✅ Сессия совместима с middleware (защищённые страницы работают)

## Подсказки

- **Plugin .client.ts** — только клиент (window.Telegram доступен в браузере Telegram).
- **useAuth composable** из Phase 3 — fetchSession обновляет состояние после авто-логина.
- **Loading важен** — initData валидация + создание сессии занимает время, без loader пользователь видит мелькание.
- **Fallback не ломать** — email-логин (3.4.2) для разработки/веба остаётся рабочим.

## Не делать

- ❌ Не показывать email-форму внутри Telegram (там авто-логин)
- ❌ Не делать белый экран при загрузке
- ❌ Не блокировать навсегда если авто-логин упал
- ❌ Не требовать ручных действий в Telegram-сценарии
