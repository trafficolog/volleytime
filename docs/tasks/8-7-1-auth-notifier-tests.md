---
id: '8.7.1'
phase: '8'
epic: '8.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11."
roles:
  - QA
  - BACK
depends_on:
  - '8.1.2'
  - '8.4.2'
estimated_hours: '1-2'
tags:
  - tests
  - telegram
  - notifier
---

# Task 8.7.1: initData + notifier автотесты

## Цель

Дополнить тесты: auth flow (initData → User → session integration), notifier (рендеринг шаблонов, fire-and-forget, transport mock). initData unit-валидация уже в 8.1.1 — здесь интеграция и notifier.

## Контекст

8.1.1 покрыл validateInitData unit. Здесь — интеграция auth (создание/поиск User + сессия) и notifier (templates + service + transport). Security-критичные части.

## Что должно быть сделано

1. **Auth integration тесты `apps/web/server/api/auth/__tests__/telegram-miniapp.integration.test.ts`:**

   ```ts
   describe('telegram-miniapp auth (integration)', () => {
     test('valid initData → new user created with telegram fields', async () => {})
     test('valid initData existing telegram user → found, not duplicated', async () => {})
     test('invalid initData → 401', async () => {})
     test('expired initData → 401', async () => {})
     test('created user has telegram account link', async () => {})
     test('session created and readable by getSession', async () => {})
   })
   ```

   (использовать signInitData helper из 8.1.1 для генерации валидных данных)

2. **Notifier тесты `apps/web/modules/notifier/__tests__/notifier.test.ts`:**

   ```ts
   describe('notifierService', () => {
     test('send skips user without telegramId', async () => {})
     test('send resolves telegramId, calls transport with rendered message', async () => {
       // mock transport, проверить вызов с правильным text/keyboard
     })
     test('send swallows transport error (fire-and-forget)', async () => {
       // transport throws → send resolves без throw
     })
     test('sendMany isolates failures (Promise.allSettled)', async () => {})
   })

   describe('renderMessage', () => {
     test('all notification types render without error', () => {
       // прогнать каждый NotificationType с sample payload
     })
     test('escapes HTML in user data', () => {})
     test('waitlist_promoted needsPayment toggles warning', () => {})
     test('unknown type → fallback', () => {})
   })
   ```

3. **Transport тест (mock fetch):**

   ```ts
   test('sendToBot posts to internal endpoint with secret header', async () => {})
   test('sendToBot respects timeout', async () => {})
   ```

4. **Internal endpoint бота тест** (8.4.1):
   ```ts
   test('notify endpoint rejects missing/wrong secret (403)', async () => {})
   test('notify endpoint builds keyboard from payload', async () => {})
   ```

## Критерии приёмки

- ✅ Auth integration: new/existing user, 401 invalid/expired, account link, session
- ✅ Notifier: skip no-telegram, resolve+render+send, swallow errors, sendMany isolation
- ✅ renderMessage: все типы рендерятся, HTML экранируется, условные части (needsPayment)
- ✅ Transport: secret header, timeout
- ✅ Internal endpoint: secret защита, keyboard построение
- ✅ Все тесты стабильны
- ✅ Security-критичные пути (initData, secret) покрыты

## Подсказки

- **Auth integration переиспользует signInitData** (8.1.1 helper) — генерирует валидно подписанные данные для теста.
- **Notifier mock transport** — не слать реально, мокать sendToBot, проверять аргументы.
- **renderMessage без моков** — чистая функция, легко тестировать все типы.
- **Security фокус:** initData (подделка/expiry) и internal secret — главные security-поверхности Phase 8.

## Не делать

- ❌ Не слать реальные Telegram-сообщения в тестах (mock)
- ❌ Не дублировать validateInitData unit (8.1.1)
- ❌ Не делать E2E — manual QA (8.7.2) + Phase 9
