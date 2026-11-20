---
id: '28.1.6'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'По желанию; делается, если 28.1.3 признала граф полезным.'
ref_id: ''
review_ref: ''
priority: P3
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [DevOps]
depends_on: ['28.1.3']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, sql, design]
---

# Task 28.1.6: По желанию — схема SQL и материалы дизайна

## Цель

Добавить в граф схему БД из миграций и текстовые спецификации дизайна, если это улучшает ответы.

## Контекст

- Extra `sql` разбирает файлы SQL локально; extra `postgres` подключается к живой БД по DSN ([28.1.1](28-1-1-graphify-evaluation.md)).
- Референс — [docs/design/reference-v3](../design/reference-v3/README.md); изображения идут через семантический проход (правила [28.1.4](28-1-4-graphify-docs-semantic.md)).

## Что должно быть сделано

1. Включить extra `sql` и разбор SQL-миграций репозитория; проверить узлы таблиц и связи с кодом.
2. Текстовые спецификации дизайна — только в рамках решения по 28.1.4; изображения не отправлять без отдельного решения владельца.
3. Два контрольных вопроса по схеме; вывод «оставить / убрать» в карточке.

## Критерии приёмки

- ✅ Таблицы из миграций видны в графе и связаны с кодом
- ✅ Вывод записан
- ✅ Ревью `claude-sonnet-5-5` без Critical/Important

## Не делать

- ❌ Не использовать `--postgres` с DSN и не подключаться к stage/prod БД
- ❌ Не отправлять скриншоты и макеты без решения владельца
