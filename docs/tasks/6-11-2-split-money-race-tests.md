---
id: '6.11.2'
phase: '6'
epic: '6.11'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'SDD подготовлена; детерминированные гонки и финансовая интеграция ещё не проверены.'
roles: [BE, QA]
depends_on: ['6.11.1', '8.11.1']
tags: [mvp, split, tdd, concurrency, money]
---

# Task 6.11.2: интеграционные проверки денег и гонок split

## Цель

Доказать, что одновременные операции не создают дублированные начисления, частичный settlement или неверную сумму.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md). Ранее закрытые payment/cancel races остаются regression; тесты используют отдельную PostgreSQL-БД и управляемые barriers.

## Что должно быть сделано

1. Проверить concurrent settle/settle, book/settle, cancel/settle, promotion/settle, target edit/settle и full event cancel/settle.
2. Проверить confirm/reject/event cancel после фиксации: один доход/возврат, отсутствие deadlock и нового распределения, repeat после изменения платежа; full event cancel возвращает также succeeded payment ранее снятой split-брони.
3. Ввести контролируемый отказ посередине начисления и доказать атомарный rollback event/booking/payments/audit, отсутствие dispatch.
4. Проверить запреты режима после истории booking, PATCH bypass, foreign org/player access, free/subscription methods, bounds и privacy read models.

## Критерии приёмки

- Тесты проверяют SQL-state и sum(amount)=target для полного settlement, не один mock-call; фиксируют оба допустимых порядка конкурирующих операций.
- Ошибки не оставляют orphan payment, settled metadata без начислений или дублированную привязку; waitlist не платит.
- При найденном дефекте синхронизировать карточку до кода и сделать RED→GREEN; controlled money subset повторяется по установленной воспроизводимости, без произвольного ожидания.
- Пять gates и независимое review проходят на task branch; доступность БД обязательна, tests не доказывают Telegram или deploy.

## Подсказки

Повторно использовать существующие integration fixtures и barriers из money-races, а не таймауты/sleep в качестве доказательства порядка.

## Не делать

Не добавлять тестовый hook в production ради гонки, не обращаться к production DB, не подменять денежные утверждения mock count или случайными Promise.all без контроля.
