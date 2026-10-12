---
id: '20.1.3'
phase: '20'
epic: '20.1'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-07'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK]
depends_on: ['19.2.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-07-join-mode-invites.md'
  screens: []
tags: [reference-v3]
---

# Task 20.1.3: Режим записи и приглашения на событие (`P-07`)

## Цель

Свободная запись или по приглашению с наследованием группа → событие.

## Контекст

- Спецификация референса: [P-07 · Режим записи и приглашения](../design/reference-v3/specs/01-platform/P-07-join-mode-invites.md); макет: 4 Кабинет → Настройки и Создание события; 3 Mini App.
- **Как есть (main `e68acf2`):** Приглашения в организацию (4.4, токен, срок, лимит использований); тип `event_join` есть в enum, но не используется.
- **Дельта до референса:** `joinMode` события с наследованием от группы, личная ссылка на событие (startapp), запросы приглашения от игрока и ответ организатора, запрет записи без приглашения на уровне API.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [P-08 → 20.2.1](20-2-1-event-balance.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)

## Что должно быть сделано

1. Значение группы подставляется в новое событие; событие может переопределить
2. Личная ссылка-приглашение (startapp-параметр), срок действия, однократность
3. Запрос приглашения от игрока и ответ организатора
4. Режим записи не связан с индексацией страницы группы
5. Данные и API: POST /events/{id}/invites; POST /events/{id}/invite-requests.

## Критерии приёмки

- ✅ Без приглашения запись на событие `invite` невозможна через API
- ✅ Изменение настройки группы не меняет созданные события
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
