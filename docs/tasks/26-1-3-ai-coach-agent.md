---
id: '26.1.3'
phase: '26'
epic: '26.1'
status: todo
release: 'v0.7.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-15a'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: ['19.2.3', '23.1.1']
supersedes: []
decisions: []
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-15a-ai-coach-agent.md'
  screens: ['9.1-ai-coach']
tags: [reference-v3]
---

# Task 26.1.3: AI-тренер: агент (`M-15a`)

## Цель

Генерация персонального плана упражнений.

## Контекст

- Спецификация референса: [M-15a · AI-тренер · агент](../design/reference-v3/specs/02-mini-app/M-15a-ai-coach-agent.md); макет: 9.1 AI-тренер.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** План недели по схеме, замена упражнения, безопасность, кэш и лимиты, шаблон при сбое модели.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [M-14 → 20.4.10](20-4-10-player-level.md), [W-06 → 21.2.2](21-2-2-players.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [W-13 → 24.1.1](24-1-1-group-page-builder.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md). [Подробнее](../design/reference-v3/specs/links.md#levels)
- **Самооценка → прогресс → составы → тренер** — Данные самооценки питают прогресс, балансировку и план тренера. С этим связаны: [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md). [Подробнее](../design/reference-v3/specs/links.md#skill-chain)

## Что должно быть сделано

1. Вход: цель (подача, приём…), уровень, частота, инвентарь, ограничения
2. Выход: план на неделю, упражнения с дозировкой
3. Замена упражнения
4. Ограничения безопасности: травмы, нагрузка, дисклеймер
5. Кэш и лимит вызовов модели
6. Данные и API: POST /coach/plan; POST /coach/exercise/replace.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ План валидируется по схеме перед показом
- ✅ При сбое модели — шаблонный план с пометкой
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [9.1-ai-coach](../design/reference-v3/screenshots/9.1-ai-coach) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/idea-app.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-a.jsx`, `docs/design/reference-v3/handoff/screens-ideas-deep-b.jsx`, `docs/design/reference-v3/handoff/screens-ideas-future.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
