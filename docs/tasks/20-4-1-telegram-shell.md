---
id: '20.4.1'
phase: '20'
epic: '20.4'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-15
status_note: 'Реализовано, ревью ожидается: плагин telegram-shell (тема, safe area, BackButton с историей и закрытием листа), MainButton на создании группы, haptics; полноэкранный режим не включён (нужно решение владельца), проверка на реальном устройстве Telegram не выполнена — см. docs/operations/qa/2026-10-15-20-4-1-telegram-shell.md.'
ref_id: 'M-01'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.3.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-01-telegram-shell.md'
  screens: ['3-miniapp-player']
tags: [reference-v3]
---

# Task 20.4.1: Оболочка Telegram Mini App (`M-01`)

## Цель

Каркас Mini App в нативном поведении Telegram.

## Контекст

- Спецификация референса: [M-01 · Оболочка Telegram](../design/reference-v3/specs/02-mini-app/M-01-telegram-shell.md); макет: 3 Mini App.
- **Как есть (main `e68acf2`):** `useTelegram` (тема, initData), `MiniHeader`, BackButton используется на части экранов; layouts `miniapp`/`miniapp-org`.
- **Дельта до референса:** Системная BackButton везде вместо кнопки в шапке, MainButton для главных действий, haptics на подтверждениях, safe area и полноэкранный режим, стек навигации с возвратом на место (handoff `app-nav.jsx`: push/back/reset, sheet, popover, toast, alert).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-07 → 22.1.2](22-1-2-audit-log.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. WebApp SDK, тема и цвета Telegram
2. Safe area, полноэкранный режим
3. Системная BackButton вместо кнопки «назад» в шапке
4. MainButton для главных действий
5. Haptics на подтверждениях
6. Стек навигации с возвратом на место
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Назад работает одинаково из любого экрана, включая экраны гипотез
- ✅ Экран не перекрывается системными элементами на iOS и Android
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player](../design/reference-v3/screenshots/3-miniapp-player) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
