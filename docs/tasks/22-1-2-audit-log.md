---
id: '22.1.2'
phase: '22'
epic: '22.1'
status: in_progress
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-19
status_note: 'Реализация в PR (ветка feat/22.1.2-audit-log), ждёт независимого ревью и CI. Сделано: GET /api/platform/audit (requireRootAdmin: 401/403 forbidden.root_only, no-store; сервис platformAuditService.list повторно проверяет root по базе), страница /root/audit, пункт «Аудит» в сайдбаре. Журнал только на чтение: у /api/platform/audit единственный маршрут GET, у сервиса единственный метод list. Фильтры: период (24 часа, 7 дней по умолчанию, 30 дней, всё время), организация, категория (баланс, тарифы, организации, настройки — по имени действия), поиск по действию, имени и email исполнителя; постраничная загрузка по курсору (id, новые сверху), счётчик «Показано N из M». В значениях old/new поля с токенами, секретами, паролями, кодами и ссылками заменены на «[скрыто]», IP и user-agent не отдаются. Без миграций и lockfile. Не вошло: уровни INFO/OK/WARN/ERROR и их счётчики (в audit_log нет уровня, нужна миграция и решение), экспорт JSON (нет в «Что должно быть сделано»), поиск по объекту и глобальный поиск шапки. Визуальная сверка с 4b-root-admin/11 выполнена вручную (1440x900 и 375x812, локальная БД), см. PR.'
ref_id: 'R-07'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['19.3.1', '22.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-07-audit-log.md'
  screens: ['4b-root-admin/11-screen.png']
tags: [reference-v3]
---

# Task 22.1.2: Журнал действий платформы (`R-07`)

## Цель

Кто, что и когда изменил.

## Контекст

- Спецификация референса: [R-07 · Журнал действий](../design/reference-v3/specs/04-root-admin/R-07-audit-log.md); макет: 7 Root Admin.
- **Как есть (main `e68acf2`):** Аудит организаций (4.6) и страница аудита организатора.
- **Дельта до референса:** Платформенный журнал root-действий, только чтение.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Баланс
2. Тарифы
3. Организации
4. Настройки
5. Сверить экраны с референсом и приложить отчёт к PR. По решению владельца [D-16](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-16) (2026-11-19) пункт выполняется ручной проверкой (десктоп 1440x900 и мобильный 375x812, отчёт в теле PR), а не харнессом [19.0.2](19-0-2-visual-reference-harness.md): в нём нет роли root.

## Критерии приёмки

- ✅ Журнал нельзя изменить из интерфейса
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/11-screen.png](../design/reference-v3/screenshots/4b-root-admin/11-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
