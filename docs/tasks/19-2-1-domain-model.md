---
id: '19.2.1'
phase: '19'
epic: '19.2'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-01'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, DB]
depends_on: ['19.0.3']
supersedes: []
decisions: ['D-01', 'D-02', 'D-03', 'D-04', 'D-09']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-01-domain-model.md'
  screens: []
tags: [reference-v3]
---

# Task 19.2.1: Доменный контракт v3: ADR, API-соглашения, демо-сиды (`P-01`)

## Цель

Единая схема данных и контракт API, на которых строятся Mini App, кабинет и Root Admin.

## Контекст

- Спецификация референса: [P-01 · Доменная модель](../design/reference-v3/specs/01-platform/P-01-domain-model.md); макет: все макеты.
- **Как есть (main `e68acf2`):** Схема Drizzle (21 миграция): organizations, members, invites, venues, events (fixed/split), bookings (1 место, waitlist статусом), subscription plans/subscriptions, payments, ledger, audit. API — Nuxt server routes `/api/organizations/{orgId}/…`, ошибки через общий формат 4.9.11. Сидов нет.
- **Дельта до референса:** Нет: мест в записи, серий, баланса событий, сборов (кроме категории ledger), ленты уведомлений, запросов приглашений, уровней, настроек группы (maxSeats, joinMode, priceMode по умолчанию, политика отмены, seoIndex, район), OpenAPI и сидов.
- Зависит от решений владельца: [D-01](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01), [D-02](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-02), [D-03](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-03), [D-04](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-04), [D-09](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-09). До решения карточка не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Сущности: организация (группа), участник и роль, событие, серия, запись, место в записи, лист ожидания, абонемент, план абонемента, сбор, операция кассы, баланс событий и его операции, приглашение, уведомление
2. Связи и ограничения целостности: запись принадлежит событию и игроку, мест в записи ≥ 1
3. Статусы события: черновик → запись открыта → запись закрыта → прошло / отменено
4. Статусы записи: иду, в очереди (позиция), отменена, не пришёл
5. Версионирование API, формат ошибок, пагинация
6. ADR `docs/architecture/ADR-v3-domain.md`: целевая схема, владельцы сущностей, порядок миграций по задачам, правила обратной совместимости (forward-compatible, как требует deploy runbook)
7. Миграции создают задачи-владельцы (19.2.2, 20.1.2, 20.2.1, 20.2.2, 20.3.2, 21.2.4 …) по этому ADR, а не одна большая миграция
8. Соглашения API: пагинация, формат ошибок, версионирование — описать; OpenAPI генерировать для новых ресурсов
9. Демо-сиды по макетам (VolleyTime Минск, МинскВолей, СпайкКлуб) для локальной разработки и харнесса 19.0.2
10. Данные и API: Схема БД и миграции; OpenAPI-описание всех ресурсов; Сиды демо-данных по макетам (VolleyTime Минск, МинскВолей, СпайкКлуб).

## Критерии приёмки

- ✅ Все экраны макетов получают данные из описанных ресурсов без «заглушек»
- ✅ Схема покрывает сбор суммой, несколько мест и серию без отдельных таблиц-костылей
- ✅ Миграции применяются и откатываются на пустой и на заполненной базе
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Меняет модель данных: схема и контракт по ADR [19.2.1](19-2-1-domain-model.md) до UI; миграция forward-compatible (deploy runbook).

## Не делать

- ❌ Не переписывать работающие таблицы R0.7 ради имён из макета
- ❌ Не делать одну миграцию на всё
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
