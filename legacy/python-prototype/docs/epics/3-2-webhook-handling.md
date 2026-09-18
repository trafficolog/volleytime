---
id: "3.2"
phase: 3
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Самый чувствительный эпик: ошибка тут = деньги ушли, бронь не подтвердилась, или наоборот — двойное подтверждение."
---

# Epic 3.2: Приём и обработка webhook

**Цель.** Полноценная обработка webhook от bePaid: парсинг payload, идемпотентность, обновление БД, побочные эффекты (подтверждение брони / активация подписки / запись в кассу / уведомление пользователю).

## Контекст

В Phase 1 (Epic 1.4) уже сделан скелет `src/web/bepaid_webhook.py` с проверкой RSA-подписи. Сейчас он отвечает 200 OK и ничего не делает. Phase 3 наполняет его реальной логикой.

Этот эпик опирается на:
- Существующий `PaymentService.confirm(payment_id)` (из Phase 2) — он уже умеет делать побочные эффекты.
- Уникальный индекс на `Payment.bepaid_uid` (из Phase 1) — основа идемпотентности.

## Definition of Done

- Webhook парсит payload bePaid (структура `transaction.uid`, `tracking_id`, `status`, etc.)
- Идемпотентность: повторный webhook с тем же `bepaid_uid` возвращает 200 без побочных эффектов
- При `successful` → `PaymentService.confirm(payment_id)` (он сам активирует subscription/booking и пишет в кассу)
- При `failed`/`error` → `PaymentService.fail(payment_id)`
- Webhook с неверной подписью получает 403
- Webhook с неизвестным `tracking_id` (платёж не найден) логируется как warning, возвращается 200 (чтобы bePaid не ретраил)
- В логах нет `Authorization`-заголовка и тела с потенциальным PAN

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [3.2.1](../tasks/3-2-1-webhook-payload-parser.md) | Парсер payload | todo |
| [3.2.2](../tasks/3-2-2-webhook-idempotency.md) | Идемпотентность по bepaid_uid | todo |
| [3.2.3](../tasks/3-2-3-webhook-confirm-flow.md) | Подтверждение через PaymentService | todo |

## Не делать

- **Не дублировать логику `PaymentService.confirm` в webhook.** Только парсинг и вызов сервиса.
- **Не делать ретраи ИЗ webhook.** Если что-то упало — отвечаем 500, bePaid сам ретраит.
- **Не отправлять ответ до выполнения побочных эффектов.** Сначала `commit()`, потом 200.
- **Не доверять `amount` из webhook.** Сравнить с `Payment.amount` — если расходится, логировать warning и отказать (защита от подделки тестового платежа на 1 BYN вместо реального на 100).
