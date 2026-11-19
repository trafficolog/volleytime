---
id: '22.2.1'
phase: '22'
epic: '22.2'
status: in_progress
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-19
status_note: 'Реализация в PR (ветка trafficolog/feat/22.2.1-balance-tariffs) по принятому ADR-22-2-1 и D-18, ждёт независимого ревью и CI. Сделано: миграция 0041 (таблица event_balance_packages с version, сид трёх прежних пакетов, purchase_requests.package_id и разовый бэкфилл approved/pending по точному снимку, откат с NULL-безопасным guard), каталог в БД вместо константы, покупка по packageCode (FOR SHARE; 409 event_balance.package_unavailable вместо 422), API /api/platform/event-balance/packages (список с ценой за событие, продажами и строкой «Без пакета», создание, дублирование, правка с оптимистичной блокировкой, архив, история из audit_log; requireRootAdmin, no-store, аудит в той же транзакции), страница /root/billing «Баланс и тарифы» (список, «Новый пакет», история), витрина организатора из БД, раздел runbook про 0041. Не вошло (соседние карточки): demo-квота и начисления root — 22.2.2, тариф и стартовый баланс при создании группы — 22.1.8, онлайн-оплата (D-07). Визуальная сверка с 4b-root-admin/05–07 выполнена вручную (1440x900 и 375x812, D-16), отчёт в теле PR.'
ref_id: 'R-02'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['20.2.1', '22.1.2']
supersedes: ['7.7.2']
decisions: ['D-18']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-02-balance-tariffs.md'
  screens:
    ['4b-root-admin/05-screen.png', '4b-root-admin/06-screen.png', '4b-root-admin/07-screen.png']
tags: [reference-v3]
---

# Task 22.2.1: Баланс и тарифы платформы (`R-02`)

## Цель

Пакеты событий платформы.

## Контекст

- **ADR:** [ADR-22-2-1 · Каталог пакетов баланса событий](../architecture/ADR-22-2-1-event-balance-packages.md) — схема `0041`, контракт API, атрибуция продаж, откат (решение [D-18](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-18)).
- Спецификация референса: [R-02 · Баланс и тарифы](../design/reference-v3/specs/04-root-admin/R-02-balance-tariffs.md); макет: 7 Root Admin → Credits & тарифы.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Пакеты, «Новый пакет», история изменений; изменение цены не трогает купленные пакеты.
- Поглощает карточки (входные материалы, читать перед реализацией): [7.7.2](7-7-2-admin-pricing-audit.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)

## Что должно быть сделано

1. Пакеты
2. Форма «Новый пакет»
3. История изменений
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Изменение цены не трогает купленные пакеты
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/05-screen.png](../design/reference-v3/screenshots/4b-root-admin/05-screen.png), [4b-root-admin/06-screen.png](../design/reference-v3/screenshots/4b-root-admin/06-screen.png), [4b-root-admin/07-screen.png](../design/reference-v3/screenshots/4b-root-admin/07-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
