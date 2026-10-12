---
id: '24.1.1'
phase: '24'
epic: '24.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-13'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['19.2.2', '19.2.3']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-13-group-page-builder.md'
  screens: []
tags: [reference-v3]
---

# Task 24.1.1: Страница группы: конструктор (`W-13`)

## Цель

Организатор собирает SEO-страницу из секций.

## Контекст

- Спецификация референса: [W-13 · Страница группы · конструктор](../design/reference-v3/specs/03-organizer-web/W-13-group-page-builder.md); макет: 4 Кабинет организатора → Страница группы.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Секции, порядок, предпросмотр, мета-теги, переключатель индексации.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10 → 19.2.3](19-2-3-player-levels.md), [M-14 → 20.4.10](20-4-10-player-level.md), [W-06 → 21.2.2](21-2-2-players.md), [M-24 → 21.1.3](21-1-3-org-players-report.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-15a → 26.1.3](26-1-3-ai-coach-agent.md). [Подробнее](../design/reference-v3/specs/links.md#levels)
- **Страница группы** — Конструктор организатора, рендер и модерация root. С этим связаны: [W-14 → 24.1.2](24-1-2-group-page-render.md), [R-06 → 24.1.3](24-1-3-group-page-moderation.md), [P-02 → 19.2.2](19-2-2-group-settings.md). [Подробнее](../design/reference-v3/specs/links.md#seo)

## Что должно быть сделано

1. Секции: обложка, коротко о группе, расписание, форматы и уровни, цены, зал, как записаться, FAQ
2. Порядок и включение секций
3. Предпросмотр компьютер/телефон
4. Мета-теги и проверки
5. Переключатель индексации с подтверждением

## Критерии приёмки

- ✅ Выключение индексации не влияет на режим записи
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
