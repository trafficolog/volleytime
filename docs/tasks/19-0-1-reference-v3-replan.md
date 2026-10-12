---
id: '19.0.1'
phase: '19'
epic: '19.0'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Документы подготовлены в PR; ждут review/CI и решений владельца из 19.0.3.'
ref_id: ''
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [PRODUCT, DOCS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 19.0.1: Импорт референса v3, аудит и перепланирование

## Цель

Сделать референс v3 целевым: импортировать его в репозиторий, провести аудит проекта, встроить задачи референса в пул фаз/эпиков/задач с моделями реализации и ревью.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Задачи референса существуют только в локальной папке `references/` вне Git.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Скопировать спецификации, handoff и скриншоты в `docs/design/reference-v3/` (офлайн-HTML остаются локально)
2. Отчёт аудита: локально, GitHub, сервер, CI/CD, пул задач
3. Фазы 19–26, эпики, карточки задач с `ref_id`, `complexity`, `impl_model`, `review_model`
4. Пометить поглощённые карточки фаз 7, 10.3, 15 как `superseded`; синхронизировать статусы фаз и эпиков по карточкам
5. ROADMAP, RELEASES, ORCHESTRATION, AGENTS, шаблоны карточек, агенты `.claude/agents/`

## Критерии приёмки

- ✅ Каждая из 66 задач референса имеет карточку или явное решение «поглощена/отложена»
- ✅ У каждой карточки есть модель реализации и ревью
- ✅ Конфликты референса и принятых правил вынесены в решения владельца (19.0.3)
- ✅ Документы проходят `pnpm format:check`, локальные ссылки целы
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
