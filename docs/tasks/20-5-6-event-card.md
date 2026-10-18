---
id: '20.5.6'
phase: '20'
epic: '20.5'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-18
status_note: 'PR #151 merged as e298d22, Opus review merge after one fix round, CI green on a6c7b5f. RED evidence for the clamp test recorded: pricing-overbooked.integration.test.ts failed with RangeError «Invalid split participant count or capacity» before the clamp in readEventPricing. Follow-up: фиксация суммы при составе больше вместимости отклоняется (event.split_over_capacity). Вне карточки: журнал события, ручное добавление игрока, дублирование / «В чат» (20.5.8). Отчёт сверки: docs/operations/qa/2026-10-16-20-5-6-cabinet-event-card-visual.md.'
ref_id: 'W-05'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.2', '20.2.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-05-event-card.md'
  screens: ['4-cabinet/04-screen.png']
tags: [reference-v3]
---

# Task 20.5.6: Карточка события в кабинете v3 (`W-05`)

## Цель

Управление составом и оплатами.

## Контекст

- Спецификация референса: [W-05 · Карточка события](../design/reference-v3/specs/03-organizer-web/W-05-event-card.md); макет: 4 Кабинет организатора → событие.
- **Как есть (main `e68acf2`):** Карточка события с составом, оплатами, отметкой посещения и распределением split (5.15.1, 6.10.1, 5.16.2).
- **Дельта до референса:** «+N» в составе, лист ожидания с TTL предложения, доли сбора, отмена события с возвратом на баланс и показом последствий.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Перенесено из 20.1.1 ([решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01)):** визуальная сверка цены и долей сбора по `4-cabinet/04-screen.png`; цена — только из `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1).
  - Ответ цены не сигнализирует полный состав: `seatCount.current` ограничен вместимостью — «мест нет» показывать по занятости события, а не по цене (ревью 20.1.1, Minor).
  - Для отменённого события split эндпоинт по-прежнему отдаёт прогноз — интерфейс цену отменённого события не показывает (ревью 20.1.1, Minor).

**Общий функционал с другими интерфейсами:**

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05 → 20.1.2](20-1-2-multi-seat-booking.md), [M-05 → 19.1.2](19-1-2-booking-statuses.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#booking)
- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03 → 20.1.1](20-1-1-pricing.md), [M-07 → 20.4.6](20-4-6-split-price-event.md), [W-04 → 20.5.5](20-5-5-event-create.md), [P-17 → 20.6.1](20-6-1-public-event-pages.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#split)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)
- **Перенесено из 20.1.2 (решение владельца 2026-10-14, [D-03, уточнение](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-03)):** «+N» в составе кабинета (`seats`, `waitlistSeats` в `GET …/events/{id}/bookings`; `taken`/`players`/`waitlist` в статистике события) и визуальная сверка (4-cabinet/04-screen.png). Включение `EVENT_MULTI_SEAT_ENABLED` требует этой карточки, 20.4.5, 20.4.8 и п. 6 карточки 20.7.1.

## Что должно быть сделано

1. Состав с «+N»
2. Лист ожидания
3. Оплаты и доли сбора
4. Отмена события с возвратом на баланс
5. Общий компонент строки состава (подтверждён, ждёт оплаты, пришёл, не пришёл, очередь) для кабинета и Mini App организатора: `seatsOf` для «+N», `pendingOf`, словарь организатора отдельно от игрока («Иду») — рекомендация ревью 19.1.2.
6. Уровень игрока (В1–В4+) чипом в строке состава кабинета — перенесено из 20.4.10; данные только через маршруты для участников группы ([решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md)), не через публичный состав.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Отмена требует подтверждения и показывает последствия
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Цена и прогноз берутся из `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1), а не из `readEventPricing`/`previewSplitAmount`; тест доказывает совпадение показанной цены с ответом эндпоинта для тех же мест (перенесено из 20.1.1, [решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01))
- ✅ Визуальная сверка включает прогноз цены и доли сбора по `4-cabinet/04-screen.png` (перенесено из 20.1.1)
- ✅ В составе кабинета у игроков с уровнем показан чип В1–В4+; тест подтверждает, что уровень приходит только из ответа для участников группы (перенесено из 20.4.10)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/04-screen.png](../design/reference-v3/screenshots/4-cabinet/04-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
