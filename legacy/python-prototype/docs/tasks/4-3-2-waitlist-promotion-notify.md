---
id: "4.3.2"
phase: 4
epic: "4.3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - BOT
depends_on:
  - "4.1.1"
estimated_hours: "3"
tags:
  - scheduler
  - waitlist
  - notifications
---

# Task 4.3.2: Уведомление waitlist с TTL 30 мин

## Цель

Когда место освобождается (отмена кем-то), вместо автоматического продвижения первого из waitlist (как сейчас в `BookingService.promote_from_waitlist`) — сначала уведомить его с кнопкой «Подтвердить» и TTL 30 минут. Если не подтвердил — следующему.

## Контекст

Текущая логика Phase 1 «автопродвижение» проблемна: игрок мог записаться в waitlist неделю назад и забыть. Без подтверждения он окажется в основном составе без своего ведома.

Phase 4 делает это явным: после освобождения слота первый получает сообщение «есть свободное место, у тебя 30 мин на подтверждение». Если успел — переходит в main/rotation. Если нет — следующему.

## Что должно быть сделано

- Изменить `BookingService.promote_from_waitlist`:
  - Вместо немедленного перевода первого в main/rotation — создать «pending promotion»:
    - Найти первого в waitlist (по позиции)
    - Создать новый статус `BookingStatus.waitlist_pending_confirmation` (или use `slot_type=main/rotation` + `status=pending_confirmation` — выбрать в реализации)
    - Отправить ему уведомление с inline-кнопкой «✅ Подтвердить» с callback_data `waitlist:confirm:<booking_id>`
    - Зарегистрировать scheduler-job на 30 мин: `waitlist_promotion_timeout(booking_id)`
- Новый хендлер `waitlist:confirm:<booking_id>`:
  - Проверить, что нажал тот же user
  - Перевести `status=confirmed`, `slot_type=main` или `rotation` (по тому, где есть место)
  - Отменить scheduler-job
  - Ответить «✅ Вы в основном составе!»
- Новый job `waitlist_promotion_timeout(booking_id)`:
  - Если booking всё ещё в pending_confirmation (не подтвердил) — оставить в waitlist (`status=confirmed`, `slot_type=waitlist`)
  - Перейти к следующему: `BookingService.promote_from_waitlist(training_id)` (рекурсивно)

## Критерии приёмки

- Тест: создать тренировку, заполнить все 14 слотов, добавить 2 в waitlist, отменить кого-то из main → первый из waitlist получает уведомление, его статус `waitlist_pending_confirmation`
- Тест: нажатие «Подтвердить» → переход в main/rotation
- Тест: спустя 30 мин без подтверждения → job вызвана → первый остался в waitlist, второй получил уведомление
- Тест: при отмене всей тренировки — задачи на promotion отменяются

## Подсказки

- Можно ввести новый статус Booking, или использовать поле `Booking.promotion_offered_at: datetime | None` без нового статуса.
- Кнопка «Отказаться» (вместо просто игнора): можно, но не обязательно. Без неё проще — игрок просто не отвечает.

## Не делать

- Не уведомлять следующего в waitlist немедленно — только после таймаута предыдущего.
- Не лишать игрока места в waitlist при отказе. Он остаётся в waitlist на следующее освобождение.
- Не настраивать TTL пользователем — 30 мин достаточно.
