---
id: '20.4.7'
phase: '20'
epic: '20.4'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-25
status_note: 'PR #174 смёржен (ревью Opus — merge, CI green на 32340c7), закрытие — PR docs/20.4.7-close. Состояния M-08 из атомов v3, бэкенд без миграций (invite-access, отзыв запроса, шаблоны уведомлений); владелец утвердил скриншоты приложения 2026-10-25 (журнал решений, D-06). Follow-up (Minor): окно между коммитом запроса и записью строки ленты.'
ref_id: 'M-08'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BE]
depends_on: ['20.1.3', '19.0.3']
supersedes: []
decisions: ['D-06']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-08-invite-booking.md'
  screens:
    - '3-miniapp-player/07-screen.png'
    - '3-miniapp-player/m08-invite-none.jpg'
    - '3-miniapp-player/m08-invite-requested.jpg'
    - '3-miniapp-player/m08-invite-invited.jpg'
    - '3-miniapp-player/m08-invite-expired.jpg'
tags: [reference-v3]
---

# Task 20.4.7: Запись по приглашению в Mini App (`M-08`)

## Цель

Событие с записью по приглашению в Mini App.

## Контекст

- Спецификация референса: [M-08 · Запись по приглашению](../design/reference-v3/specs/02-mini-app/M-08-invite-booking.md); макет: 4 Кабинет → Создание события → Запись (в Mini App пока нет).
- **Как есть (main `e68acf2`):** Экран приглашения в группу `/m/invite/[token]` (8.10.6).
- **Дельта до референса:** Бейдж «по приглашению», «Запросить приглашение» и статус запроса, вход по ссылке сразу в событие, просроченная ссылка. Состояния не были нарисованы в референсе; D-06 закрыт 2026-10-20 — владелец утвердил 4 экрана (`3-miniapp-player/m08-invite-*.jpg`).
- Решения владельца (2026-10-12): [D-06](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06) — исполнитель собирает 4 состояния из атомов v3 и прикладывает скриншоты; владелец утверждает до merge.
- **2026-10-20 · D-06 закрыт: экраны M-08 утверждены** ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06)): владелец утвердил четыре целевых экрана — «без приглашения», «запрос отправлен», «вы приглашены», «ссылка просрочена» — снимки `m08-invite-none|requested|invited|expired.jpg` в `reference.screens` и в карте харнесса. Принятое отступление: валюта «BYN», не «Br» (владелец, 2026-10-19); цена только из `quoteEventPrice` / `GET …/price`.
- **Уточнение владельца 2026-10-20 (ревью PR #174)**, [журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06): (A) сжатый состав — стопка аватаров и «и ещё N · M мест свободно» — для незаписанного игрока на событии «по приглашению», кнопки на первом экране 390×820; (B) «Записаться · цена» в нижней панели / MainButton — принятое отступление; (C) отзыв запроса помечает запись ленты организатора «Запрос отозван» и прочитанной (без миграции, бот не меняется), ответ на отозванный запрос — 409 `invite_request.not_pending`.
- **Бэкенд (без миграции):** `POST …/events/{id}/invite-access` (состояние, срок, имя пригласившего), `POST …/invite-requests/{id}/cancel` (отзыв своего запроса), шаблоны бота `invite_request_organizer` (в ленту `organizer_action_required`) и `invite_request_decided`; права — [permissions-v3](../architecture/permissions-v3.md), IDOR-таблица обновлена.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)

## Что должно быть сделано

1. Бейдж «по приглашению»
2. Кнопка «Запросить приглашение» и статус запроса
3. Вход по ссылке-приглашению сразу в событие
4. Состояния экрана: Без приглашения; Запрос отправлен; Приглашение принято; Ссылка просрочена.
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Четыре состояния собраны из атомов v3, скриншоты утверждены владельцем до merge (D-06; утверждено 2026-10-25, см. [журнал решений](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06))
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Follow-up (ревью PR #174, Minor)

- Окно между коммитом запроса и записью строки ленты: отзыв в этом окне оставляет организатору активный пункт; вариант — check доставки в `NotifyJobInput`.

## Подсказки

- Скриншоты: [3-miniapp-player/07-screen.png](../design/reference-v3/screenshots/3-miniapp-player/07-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
