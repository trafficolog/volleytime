---
id: '20.4.3'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-04'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.1']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-04-group-switcher.md'
  screens: ['3-miniapp-player/14-screen.png']
tags: [reference-v3]
---

# Task 20.4.3: Переключатель групп (`M-04`)

## Цель

Переход между группами игрока.

## Контекст

- Спецификация референса: [M-04 · Переключатель групп](../design/reference-v3/specs/02-mini-app/M-04-group-switcher.md); макет: 3 Mini App → тап по названию группы.
- **Как есть (main `e68acf2`):** Список групп `/m/orgs`, создание `/m/orgs/create`.
- **Дельта до референса:** Шторка «Мои группы» из шапки, логотип или монограмма (цвет по хэшу), выбранная — залитый flame-круг с галочкой (`role="radio"`), «Создать свою группу»; в Mini App везде «группа».
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Шторка «Мои группы»
2. Логотип группы или заглушка с инициалами
3. Выбранная группа — залитый круг с галочкой
4. «Создать свою группу»
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Переключение меняет данные всех вкладок
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/14-screen.png](../design/reference-v3/screenshots/3-miniapp-player/14-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
