---
id: '20.6.1'
phase: '20'
epic: '20.6'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-19
status_note: 'PR #158 (миграция 0030 events.public_slug, GET /api/public/events/{slug}, страница /e/{slug}); QA: docs/operations/qa/2026-10-19-20-6-1-public-event-visual.md. Follow-up — в конце карточки.'
ref_id: 'P-17'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['20.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-17-public-event-pages.md'
  screens: ['5-public']
tags: [reference-v3]
---

# Task 20.6.1: Публичная страница события (`P-17`)

## Цель

Событие по ссылке для тех, кто ещё не в Mini App.

## Контекст

- Спецификация референса: [P-17 · Публичные страницы события](../design/reference-v3/specs/01-platform/P-17-public-event-pages.md); макет: 5 Public Pages.
- **Как есть (main `e68acf2`):** Публичной страницы события нет (`organizations.publicPageEnabled` без маршрута).
- **Дельта до референса:** `GET /public/events/{slug}` без авторизации, три режима (fixed / split-прогноз / закрыто), CTA «Записаться через Telegram».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Перенесено из 20.1.1 ([решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01)):** визуальная сверка цены по `5-public` (вкладки fixed / split / split-closed); цена — только из `quoteEventPrice` (тот же расчёт, что `GET …/events/{id}/price`, 20.1.1).
  - Ответ цены не сигнализирует полный состав: `seatCount.current` ограничен вместимостью — «мест нет» показывать по занятости события, а не по цене (ревью 20.1.1, Minor).
  - Для отменённого события split эндпоинт по-прежнему отдаёт прогноз — интерфейс цену отменённого события не показывает (ревью 20.1.1, Minor).

**Общий функционал с другими интерфейсами:**

- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03 → 20.1.1](20-1-1-pricing.md), [M-07 → 20.4.6](20-4-6-split-price-event.md), [W-04 → 20.5.5](20-5-5-event-create.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#split)

## Что должно быть сделано

1. Вкладки по типу оплаты: фиксированная / сбор суммой
2. Кнопка записи ведёт в Mini App
3. Данные и API: GET /public/events/{slug}.
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Цена совпадает с P-03
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Цена и прогноз берутся из `quoteEventPrice` (тот же расчёт, что `GET …/events/{id}/price`, 20.1.1; публичный эндпоинт без авторизации вызывает функцию напрямую), а не из `readEventPricing`/`previewSplitAmount`; тест доказывает совпадение показанной цены с ответом эндпоинта для тех же мест (перенесено из 20.1.1, [решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01))
- ✅ Визуальная сверка включает блок цены по `5-public` (fixed, split, split-closed) (перенесено из 20.1.1)
- ✅ Публичный маршрут получает состав без `includeLevel`: уровни игроков публичная страница не показывает (решение владельца 2026-10-14, карточка [20.4.10](20-4-10-player-level.md)). Guard-тест падает, если `includeLevel` появляется в `apps/web/server/api` вне allowlist; сейчас allowlist — только `organizations/[orgId]/events/[eventId]/index.get.ts` (участники группы)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Для публичного состава можно переименовать `bookingService.publicRoster` в `rosterFor` (необязательно); поведение без опции `includeLevel` не меняется.

- Скриншоты: [5-public](../design/reference-v3/screenshots/5-public) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-public.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Решения и ограничения (ревью PR #158, 2026-10-19)

- Решения владельца записаны в [журнале решений](../operations/decisions/2026-10-12-reference-v3-decisions.md): индексирование только при `seoIndex` группы (invite-only и отменённые — никогда); страница без `publicPageEnabled`; инициалы скрыты при числе игроков меньше 3 и после окончания события; лимит 120 запросов в минуту и кеш 15 с.
- Идентификатор: `events.public_slug` (миграция 0030, 12 hex). **Follow-up:** slug нельзя отозвать или перевыпустить; deeplink `start=event_<id>` раскрывает числовой id события — заменить непрозрачными токенами.

### Follow-up (ревью gate, PR #158; бэклог, не блокируют закрытие)

- `.ics` отдавать отдельным эндпоинтом с `Content-Disposition`, а не `data:` URL (iOS Safari и встроенный браузер Telegram).
- Защита внутреннего вызова без `remoteAddress` в `00.rate-limit.ts` (комментарий есть; нужен env-флаг или признак внутреннего вызова вместо «нет адреса»).
- HTTP-тест границы «игроков 2 → 3» (появление инициалов) в `public-event.integration.test.ts`.
- Визуальная проверка страницы 429, отменённого события, «по приглашению» и «запись откроется»; пересъёмка скриншотов после скрытия инициалов — в QA релиза [20.7.1](20-7-1-release-v0-2-0-qa.md).
- Отзыв/перевыпуск slug и непрозрачные токены вместо `start=event_<id>` (см. выше).

## Не делать

- ❌ Не раскрывать персональные данные участников без согласия: только счётчики и инициалы, если иное не решено владельцем
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
