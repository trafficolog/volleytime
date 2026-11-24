---
id: '29.2.2'
phase: '29'
epic: '29.2'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз v0.6.0 (D-34).'
ref_id: 'P-25'
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [BACK]
depends_on: ['29.1.2', '20.3.3']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-25-bot-support.md'
  screens: []
tags: [reference-v3]
---

# Task 29.2.2: Бот: «Помощь» и /support

## Цель

Из бота можно открыть базу знаний и создать обращение в одно нажатие.

## Контекст

- Спецификация референса: [P-25 · Бот · «Помощь» и /support](../design/reference-v3/specs/01-platform/P-25-bot-support.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 2 Telegram Bot → Меню и команды → «Помощь»; 2 Telegram Bot → Поддержка.
- **Как есть (main `69a5595`):** команды бота /start, /games, /my (20.3.3).
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Ответ на «Помощь»: список команд + кнопки «База знаний» (url) и «Написать в поддержку» (web_app)
- Команда /support открывает новое обращение в Mini App
- Команда добавлена в меню команд бота

## Критерии приёмки

- ✅ Кнопки работают в личном чате и не показываются в групповых чатах
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
- ❌ Не принимать вложения в чате с ботом в этой задаче
