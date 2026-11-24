---
id: '30.5.1'
phase: '30'
epic: '30.5'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Релизная задача v0.6.0 (D-34), перепланирование 19.0.5.'
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS]
depends_on:
  [
    '29.1.1',
    '29.1.2',
    '29.1.3',
    '29.2.1',
    '29.2.2',
    '29.2.3',
    '29.3.1',
    '29.3.2',
    '29.3.3',
    '29.3.4',
    '29.3.5',
    '29.4.1',
    '29.4.2',
    '29.4.3',
    '29.4.4',
    '30.1.1',
    '30.1.2',
    '30.1.3',
    '30.2.1',
    '30.2.2',
    '30.2.3',
    '30.2.4',
    '30.2.5',
    '30.3.1',
    '30.3.2',
    '30.3.3',
    '30.3.4',
    '30.4.1',
    '30.4.2',
    '30.4.3',
    '30.4.4',
    '24.2.1',
  ]
supersedes: []
decisions: ['D-34']
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 30.5.1: Релиз v0.6.0: QA, выкладка и приёмка

## Цель

Принять v0.6.0: роли на членстве и тренер, работа на зале, техподдержка и база знаний, роли команды платформы, адреса страниц групп `/{город}/{группа}`.

## Контекст

- Задача добавлена оркестратором при перепланировании [19.0.5](19-0-5-replan-2026-11-24.md): в списке задач референса её нет, но она нужна для выпуска.
- Состав релиза — фазы [29](../phases/29-support-help-center.md), [30](../phases/30-platform-review.md) и эпик [24.2](../epics/24-2-group-page-urls.md) (решение владельца [D-34](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-34)).
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates, визуальная сверка с `docs/design/reference-v3/screenshots-2026-11-24/`, Lighthouse SEO ≥ 95 на новом адресе страницы группы и на help.volleytime.by.
2. Проверить миграции релиза по порядку на копии production: роли на членстве (`assistant` → `coach`), `platform_staff`, история адресов страниц групп, обращения, база знаний.
3. Проверить 301 со старых адресов `/g/<slug>` на выборке реальных групп.
4. DNS и сертификат help.volleytime.by — до Promote.
5. Promote, backup, smoke, тег v0.6.0.

## Критерии приёмки

- ✅ Production health = release SHA
- ✅ Текущие root работают как Owner, помощники — как тренеры без приёма оплаты
- ✅ Старые адреса страниц групп отвечают 301, новые — 200
- ✅ Обращение из Mini App доходит в очередь Root Admin, ответ приходит в бот
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Порядок задач релиза — [ROADMAP](../ROADMAP.md#фазы-2930-и-242-v060).

## Не делать

- ❌ Не включать гипотезы фаз 25–26: они в `v0.7.0` и `v0.8.0`
