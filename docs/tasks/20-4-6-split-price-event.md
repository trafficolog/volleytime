---
id: '20.4.6'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-07'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.1', '20.4.5']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-07-split-price-event.md'
  screens: ['3-miniapp-player/02-screen.png']
tags: [reference-v3]
---

# Task 20.4.6: Событие со сбором суммой v3 (`M-07`)

## Цель

Понятная цена, которая зависит от числа игроков.

## Контекст

- Спецификация референса: [M-07 · Событие со сбором суммой](../design/reference-v3/specs/02-mini-app/M-07-split-price-event.md); макет: 3 Mini App → событие «сбор суммой».
- **Как есть (main `e68acf2`):** Прогноз и итоговая доля split у игрока реализованы в 8.11.2.
- **Дельта до референса:** Прогноз диапазоном из 20.1.1, учёт нескольких мест, визуал v3, пометка «абонемент не применяется».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Перенесено из 20.1.1 ([решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01)):** визуальная сверка блока цены split по `3-miniapp-player/02-screen.png`; цена — только из `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1).
  - Ответ цены не сигнализирует полный состав: `seatCount.current` ограничен вместимостью — «мест нет» показывать по занятости события, а не по цене (ревью 20.1.1, Minor).
  - Для отменённого события split эндпоинт по-прежнему отдаёт прогноз — интерфейс цену отменённого события не показывает (ревью 20.1.1, Minor).

**Общий функционал с другими интерфейсами:**

- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03 → 20.1.1](20-1-1-pricing.md), [W-04 → 20.5.5](20-5-5-event-create.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-17 → 20.6.1](20-6-1-public-event-pages.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#split)

## Что должно быть сделано

1. До закрытия: цель сбора и прогноз «≈ от … до …»
2. После закрытия: итоговая доля и оплата
3. Пометка «абонемент не применяется»
4. Состояния экрана: Запись открыта; Запись закрыта, доля рассчитана; Оплачено.
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Прогноз обновляется при каждой новой записи
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Цена и прогноз берутся из `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1), а не из `readEventPricing`/`previewSplitAmount`; тест доказывает совпадение показанной цены с ответом эндпоинта для тех же мест (перенесено из 20.1.1, [решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01))
- ✅ Визуальная сверка включает блок цены split (прогноз «от … до …», итоговая доля) по `3-miniapp-player/02-screen.png` (перенесено из 20.1.1)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/02-screen.png](../design/reference-v3/screenshots/3-miniapp-player/02-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
