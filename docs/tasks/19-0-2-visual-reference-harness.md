---
id: '19.0.2'
phase: '19'
epic: '19.0'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'реализовано в PR, ждёт ревью opus'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [QA, FE]
depends_on: ['19.2.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 19.0.2: Харнесс визуальной сверки с референсом

## Цель

Повторяемо сравнивать экраны приложения со скриншотами референса, чтобы «совпадает с макетом» стало проверяемым критерием.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Визуальная QA выполнялась вручную через Playwright CLI/Chrome (отчёты в docs/operations/qa).
- **Дельта до референса:** Нет общей карты экранов и повторяемого side-by-side отчёта.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Скрипт (Playwright, уже используется в QA) снимает страницы Mini App в 390×820 и кабинета в 1440×900, светлая и тёмная тема
2. Данные: демо-сиды из 19.2.1 (VolleyTime Минск, МинскВолей, СпайкКлуб), вход тестового пользователя без реальных учётных данных
3. Отчёт HTML/MD: экран приложения рядом со скриншотом референса, список расхождений вручную + опционально pixel-diff
4. Карта `route → reference screenshot` в одном JSON-файле, которую расширяют UI-задачи

## Критерии приёмки

- ✅ Одна команда строит отчёт локально по выбранным маршрутам
- ✅ Отчёт прикладывается к PR UI-задачи как evidence
- ✅ Харнесс не входит в обязательные CI-gates (только локальная/ручная проверка)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Как запускать

Подробности — [runbook](../operations/runbooks/visual-reference-harness.md). Кратко: локальная БД с `pnpm db:seed:demo`, приложение с тестовым `TELEGRAM_BOT_TOKEN`, затем `pnpm qa:visual --routes player-home,cabinet-overview --diff`. Карта экранов — `scripts/qa/visual-reference-map.json`, отчёт — `output/visual/<время>/report.html` (не коммитится). Playwright: добавлена devDependency `playwright-core` (без загрузки браузеров, используется системный Chrome).

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не делать pixel-perfect gate в CI: шрифты и антиалиасинг отличаются между ОС
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
