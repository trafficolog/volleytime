---
id: '5.16.1'
phase: '5'
epic: '5.16'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'SDD подготовлена; письменные финансовые правила ожидают review пользователя. Код и acceptance ещё не выполнены.'
roles: [BE, DB, QA]
depends_on: ['8.10.2', '5.15.1']
tags: [mvp, events, split, money]
---

# Task 5.16.1: режимы цены события и точный расчёт копеек

## Цель

Подготовить совместимую модель fixed/split и алгоритм, сохраняющий общую сумму до копейки.

## Контекст

[Спецификация R0.7](../superpowers/specs/2026-10-01-event-split-pricing-design.md) — общий источник правил. Предыдущие SDD исключали split из R0.6; пользователь теперь подтвердил расширение MVP. Эта карточка не означает закрытую Telegram/pilot приёмку R0.6.

## Что должно быть сделано

1. Аддитивно добавить events.priceMode/targetAmount/pricingSettledAt/pricingParticipantCount и bookings.allocatedAmount, constraints и generated migration metadata по процессу репозитория.
2. Старые события получают fixed; отсутствие mode в старом POST сохраняет fixed. Проверить nullable пары, positive count/amount, integer bounds и валюта организации.
3. Чистый алгоритм распределяет целые копейки поровну с остатком по bookedAt/id; empty и total<N отклоняются. Формировать прогноз без деления на ноль.
4. Create/update validation не принимает клиентские settlement поля. Смена режима запрещена после любой истории брони; target меняется только до settlement. Финансовое изменение использует event lock.
5. Split creation защищён серверной `EVENT_SPLIT_PRICING_ENABLED` (только `true`, default false), UI получает несекретную capability. Флаг проверяется в create/переходе mode; уже существующие split продолжают обслуживаться. Промежуточные task PR не делают незавершённую функцию доступной на production.

## Критерии приёмки

- RED→GREEN проверяет миграцию старого fixed/free, несовместимые mode/price/target и недопустимые суммы до обращения к БД.
- 10000/3 даёт 3334/3333/3333, сумма долей равна total, разница ≤1; N1/500, ties и max integer детерминированы.
- POST/PATCH нельзя использовать для задания settlement/count/allocation или обхода закрытия.
- Focused unit/DB tests, пять gates и отдельное review проходят; PR/CI acceptance фиксируется в карточке после фактического выполнения.

## Подсказки

Изменять существующие events/schema, core events/schemas/service и shared money helper по месту. `price===0` имеет смысл бесплатного только для fixed. Алгоритм не выполняет SQL и не создаёт платежи.

## Не делать

Не конвертировать старые события, не создавать новый ledger, не добавлять multi-seat, онлайн-оплату, автоматическое закрытие или кредиты. Не объявлять эту подготовительную задачу готовой пользовательской функцией.
