---
id: '15.7.2'
phase: '15'
epic: '15.7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.7.1'
  - '8.5'
estimated_hours: '1-2'
tags:
  - notifier
  - queue
---

# Task 15.7.2: Перевод критичных уведомлений на очередь

## Цель

Перевести критичные уведомления (waitlist_offer, payment_confirmed/rejected, event_cancelled) с прямого send на sendReliable (очередь). Некритичные оставить прямыми.

## Контекст

Решение 7: критичные не должны теряться. Определяем какие критичны и переводим на sendReliable (15.7.1). Завершает закрытие долга Phase 8.

## Что должно быть сделано

1. **Классификация уведомлений:**

   ```
   КРИТИЧНЫЕ (sendReliable — очередь, retry):
   - waitlist_offer       — от него зависит попадёт ли в состав (TTL 30мин!)
   - payment_confirmed    — деньги получены, игрок должен знать
   - payment_rejected     — игрок должен знать что не оплачено
   - event_cancelled      — критично для планов игрока
   - credits_purchased    — платформенная оплата (Phase 7)

   НЕКРИТИЧНЫЕ (send — прямой, потеря терпима):
   - booking_confirmed    — приятно, но не критично (видно в приложении)
   - booking_waitlisted   — статусное
   - reminder_24h/2h      — напоминание (не критично если одно потеряется)
   - pending_payment_for_organizer — организатор увидит в приложении
   ```

2. **Перевод в точках вызова (8.5):**

   ```ts
   // было (8.5.x): notifierService.send(userId, 'waitlist_offer', ...)
   // стало: notifierService.sendReliable(userId, 'waitlist_offer', ...)

   // payment confirmed (8.5.2 / 6.1.3):
   notifierService.sendReliable(userId, 'payment_confirmed', ...)
   // event cancelled (8.5.3 / 6.4.1):
   notifierService.sendReliable(userId, 'event_cancelled', ...)
   ```

3. **waitlist_offer особенно критичен** — TTL 30 мин, если не доставлено, игрок не узнает про предложение и упустит место (а место заблокировано на 30 мин зря). Обязательно через очередь.

4. **Reminders остаются прямыми** — потеря одного напоминания терпима (есть второе, есть приложение). Но можно и через очередь если хочется — не критично. Оставляем send для простоты.

5. **Проверка:** критичные уведомления при временном сбое Telegram доставляются после восстановления (retry), не теряются.

6. **Тесты:**
   ```ts
   test('waitlist_offer uses sendReliable (queued)', async () => {})
   test('payment_confirmed uses sendReliable', async () => {})
   test('event_cancelled uses sendReliable', async () => {})
   test('booking_confirmed uses direct send (not queued)', async () => {})
   test('critical notification survives transient telegram failure (retry)', async () => {})
   ```

## Критерии приёмки

- ✅ Критичные (waitlist_offer, payment_confirmed/rejected, event_cancelled, credits_purchased) → sendReliable
- ✅ Некритичные (booking_confirmed/waitlisted, reminders) → прямой send
- ✅ waitlist_offer гарантированно через очередь (TTL-зависимость)
- ✅ Критичные переживают временный сбой Telegram (retry)
- ✅ Точки вызова (8.5, 6.x, 7.x) обновлены
- ✅ Тесты

## Подсказки

- **waitlist_offer = самое критичное.** TTL 30 мин: не доставили → игрок не нажмёт кнопку → место зря блокируется 30 мин → уйдёт следующему, хотя первый бы согласился. Очередь с retry обязательна.
- **payment/cancelled критичны** — про деньги и сорванные планы игрок должен узнать надёжно.
- **reminders терпимы** — два напоминания + приложение. Потеря одного не катастрофа. Оставляем прямыми (проще), хотя можно и в очередь.
- **Не переусердствовать** — всё в очередь = лишняя нагрузка/сложность. Только то, где потеря реально вредит.

## Не делать

- ❌ Не переводить reminders/статусные (терпимы)
- ❌ Не оставлять waitlist_offer на прямом send (критично)
- ❌ Не дублировать логику доставки (общий deliverNotification 15.7.1)
