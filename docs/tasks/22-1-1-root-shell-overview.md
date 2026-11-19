---
id: '22.1.1'
phase: '22'
epic: '22.1'
status: in_progress
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-19
status_note: 'Реализация в PR (ветка trafficolog/feat/22-1-1-root-shell-overview), ждёт ревью Opus и CI. Сделано: GET /api/platform/overview (requireRootAdmin: 401/403 forbidden.root_only, root из БД на каждый запрос; сервис platformOverviewService повторно проверяет root), страница /root (SPA, как /app) с layout root; не-root получает 403 на страницах /root/** от server/middleware/root-pages.ts и на API, без сессии клиент уходит на вход (сессия better-auth не несёт isRootAdmin, поэтому роль на клиенте не проверяется), `platform` добавлен в зарезервированные короткие ссылки, North Star, события и записи за неделю, 4 метрики гипотез Phase 10 (значение/цель), записи за 14 дней. Без миграций и lockfile. Не вошло (чужие карточки): активность за 24 часа (22.1.2), MRR-прогноз (22.2.x), поиск, экспорт метрик, плашка Health, allowlist и ручные метрики (willingness to pay, Mini App ratio). Визуальная сверка с 4b-root-admin/01 выполнена вручную (1440x900 и 375x812, локальная БД с демо-сидом), расхождений Critical/Important нет; харнесс 19.0.2 не знает роль root, добавлять её в харнесс не входило в карточку, см. PR.'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.3.1']
supersedes: ['10.3.1', '10.3.2']
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: ['4b-root-admin/01-screen.png']
tags: [reference-v3]
---

# Task 22.1.1: Root Admin: оболочка и обзор платформы

## Цель

Каркас Root Admin (тёмный сайдбар, бейдж ROOT) и обзор платформы.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Root-страниц нет; флаг `users.isRootAdmin` есть.
- **Дельта до референса:** Новый интерфейс.
- Поглощает карточки (входные материалы, читать перед реализацией): [10.3.1](10-3-1-super-admin-overview.md), [10.3.2](10-3-2-gate-metrics-allowlist.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Оболочка и маршрутизация `/root`, доступ только `isRootAdmin`
2. Обзор: North Star (активные организации за неделю), метрики гипотез Phase 10
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Не-root получает 403 на всех `/root` маршрутах и API
- ✅ Совпадение с `4b-root-admin/01`
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/01-screen.png](../design/reference-v3/screenshots/4b-root-admin/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
