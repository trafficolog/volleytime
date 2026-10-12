---
id: '19.3.1'
phase: '19'
epic: '19.3'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-11'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, SECURITY]
depends_on: ['19.2.1']
supersedes: []
decisions: ['D-05']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-11-auth-roles.md'
  screens: ['6-auth']
tags: [reference-v3]
---

# Task 19.3.1: Авторизация и роли v3 (`P-11`)

## Цель

Безопасный вход и проверка прав.

## Контекст

- Спецификация референса: [P-11 · Авторизация и роли](../design/reference-v3/specs/01-platform/P-11-auth-roles.md); макет: 6 Авторизация.
- **Как есть (main `e68acf2`):** better-auth: email OTP для веба, Telegram initData (валидация, 3.9.10), роли участника owner/organizer/assistant/player, `users.isRootAdmin`, tenant middleware, API security tests (4.9.15).
- **Дельта до референса:** Матрица прав для новых ресурсов v3 (серии, баланс, сборы, уведомления, root), IDOR-тесты на каждый новый эндпоинт, срок жизни initData, способ входа в веб по D-05.
- Зависит от решений владельца: [D-05](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-05). До решения карточка не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-07 → 22.1.2](22-1-2-audit-log.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Проверка подписи Telegram initData, срок жизни
2. Вход в веб: Telegram Login или код из бота
3. Роли: игрок, организатор, админ группы, root
4. Проверка доступа на каждом эндпоинте
5. Данные и API: Middleware авторизации; Матрица прав по ролям.
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Подделанный initData отклоняется
- ✅ Организатор не видит данные чужой группы (тесты на IDOR)
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [6-auth](../design/reference-v3/screenshots/6-auth) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-auth.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
