---
id: '8.11.2'
phase: '8'
epic: '8.11'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'Спецификация и письменный план утверждены пользователем 2026-10-01; реализация и browser/Telegram acceptance не начаты.'
roles: [FE, QA]
depends_on: ['5.16.2']
tags: [mvp, split, miniapp, player, landing]
---

# Task 8.11.2: прогноз и персональная сумма игрока

## Цель

Игрок записывается в split-событие и видит актуальный прогноз до закрытия и свой точный долг после него.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md), references/screens-player.jsx. Полная анонимная event page/QR/share-link остаётся отдельной будущей задачей; действующие roster/deep links входят в эту.

## Что должно быть сделано

1. EventCard, player Home, список событий, event page, booking confirmation и «Мои записи» используют общий согласованный pricing view.
2. До фиксации знак ≈, текущий taken или ясно подписанный full-capacity прогноз при N0; pending без paymentId не называется бесплатным/оплаченным.
3. Cash/transfer рабочие; абонемент недоступен для split независимо от настроек организации и личного остатка. Waitlist не получает начисление до повышения/фиксации.
4. После расчёта показать именно личную allocatedAmount/payment status; убрать самостоятельную отмену по серверному правилу, не скрывать сохранённый итог при дальнейших статусах.
5. Read models/privacy/error/loading/stale org/route сохраняются. Landing может вернуть применимые реальные split-блоки/FAQ исходника только после готовности потока.

## Критерии приёмки

- RED→GREEN проверяет N0, forecast при смене состава, 100/3 персональную копейку, waitlist, server refusal subscription и отказ self cancel после фиксации.
- Browser320/390 light/dark с реальным локальным API доказывает запись→прогноз→закрытие организатором→личный итог, error/retry и deep link. Fixed/free/subscription regressions проходят.
- Нет false paid в public roster, не раскрыты чужие платежи; пять gates и review проходят. Telegram доставка проверяется 9.8.11.

## Подсказки

Использовать настоящий event/booking/payment response; price===0 перед проверкой mode является ошибкой. Лендинг не должен обещать multi-seat или автоматическое закрытие.

## Не делать

Не платить приблизительную сумму, не добавлять отдельную анонимную event page, multi-seat, online payment, будущие reminders/credits или realtime transport.
