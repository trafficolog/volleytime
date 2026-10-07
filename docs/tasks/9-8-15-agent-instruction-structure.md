---
id: '9.8.15'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-07
roles: [DEV, QA]
depends_on: []
tags: [documentation, agent-instructions]
---

# Task 9.8.15: Progressive disclosure of agent instructions

## Цель

Сократить всегда загружаемый AGENTS.md, перенести инженерные правила в корневой CODING_STANDARDS.md и сохранить действующие SDD/TDD, Git и verification обязательства.

## Контекст

Пользователь запросил три предложения субагентов с возрастающей радикальностью и один PR. Изменения только документационные; текущий production и открытая Telegram/pilot приёмка не затрагиваются.

## Что должно быть сделано

1. Сравнить консервативный, сбалансированный и радикальный варианты. Для каждого удаления отличать доказанное дублирование/устаревший cache от предположительного no-op.
2. Сделать AGENTS.md маршрутизатором с конкретными условиями чтения: изменение, review, release/status, production.
3. Собрать инженерные правила и verification в CODING_STANDARDS.md; DEVELOPMENT_PROCESS.md оставить владельцем последовательности SDD/TDD и статусов карточек. Убрать дубли между ними.
4. Проверить ссылки и сохранение обязательств, scoped Markdown formatting, отсутствие изменений runtime/config; независимый review и один PR в main.

## Критерии приёмки

- Три варианта и rationale выбранного решения записаны в карточке.
- Все необходимые документы достижимы через явно сформулированные triggers в AGENTS.md.
- SDD/TDD, пять code gates с PostgreSQL, scope из RELEASES, task branch/commit trailers, review/CI перед merge, UI-reference boundary, immutable tags и реальные operational evidence сохранены.
- Одна авторитетная формулировка каждого правила; команды в package.json остаются источником деталей исполнения.
- Markdown formatting и локальные ссылки проходят; diff содержит только документацию. Полные продуктовые gates для docs-only patch не выдаются за выполненные; применимый hosted CI виден в PR.
- Независимый review не оставляет блокирующих замечаний. Карточка остаётся in_progress до merge.

## Подсказки

AGENTS.md, docs/DEVELOPMENT_PROCESS.md, docs/RELEASES.md, docs/operations/status/current-state.md, docs/operations/runbooks/deploy.md; skill writing-for-agents.

## Сравнение трёх предложений

| Вариант                                    | Структурные изменения                                                                                          | Цена                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1 — консервативный (`agents_conservative`) | Краткий router; engineering/verification в стандарты, Git остаётся в процессе; safety boundary частично inline | Меньше переносов, но root продолжает содержать часть подробных правил |
| 2 — сбалансированный (`agents_balanced`)   | Явные action triggers, единый engineering/verification authority, отдельные ссылки на Telegram/pilot QA        | Лучше disclosure; больше всегда загружаемых ссылок на узкие ветви     |
| 3 — радикальный (`agents_radical`)         | Только router; владельцы правил разделены, release scope берётся исключительно из RELEASES                     | Минимальный root, но надёжность зависит от полноты triggers           |

Выбран компактный router варианта 3 с единым CODING_STANDARDS для engineering, Git и verification, как просил пользователь. Process сохраняет SDD/TDD, task sequence и статусы; operational детали раскрываются через существующий deploy runbook. В root сохранены task-before-change и обнаруженный review defect, добавлены явные ветви integrate/status/production-impacting.

Подтверждённых полностью бесполезных инструкций не найдено. Убраны повторные формулировки SDD, принципов, Git и checks, а также cache фаз/функций и исторический порядок фаз из процесса. Пять gates, PostgreSQL, UI/domain boundary, immutable tags и отдельное реальное evidence перенесены, а не отменены. `package.json` описывает исполнение команд, но не заменяет обязательность gates. Общие лозунги заменены конкретным выбором простого решения и порогом extraction; они не объявлены доказанными no-op.

## Проверка маршрутов

| Действие                                      | Обязательные источники                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Реализация / найденный дефект                 | Change → process и полная карточка; Implement → standards; scope → RELEASES                            |
| Code review / commit / PR / merge             | Change or task review → полные process/card; Implement, review or integrate → standards                |
| Scope / release acceptance                    | Scope or release → RELEASES; dated evidence через Status                                               |
| Production change / migration / rollback      | Production-impacting → deploy runbook и применимые QA/recovery references                              |
| Telegram / monitoring / backup / pilot claims | Standards evidence boundary; readiness → Status с исходным dated evidence; release criteria → RELEASES |

Нормы Git/verification читаются также для docs PR. Текущая R0.7 manual acceptance, production SHA и release tags не меняются этой задачей.

## Local acceptance — 2026-10-07

- Independent re-review `agents_radical`: approved, без блокирующих замечаний после уточнения trigger task review и сохранения исходного порога абстракции.
- Scoped Prettier check: четыре документа PASS; git diff whitespace check PASS; все 10 локальных Markdown links разрешаются.
- AGENTS.md сокращён с 40 до 11 строк. Уменьшение числа строк не означает эквивалентного уменьшения токенов; цель — убрать дубли и разделить владельцев правил.
- Только AGENTS.md, CODING_STANDARDS.md, DEVELOPMENT_PROCESS.md и эта карточка; runtime/config/CI не меняются. Полные code gates не запускались для документационного изменения.
- PR/hosted CI/merge ещё открыты. `status: in_progress` сохраняется до merge, новая выкладка не требуется.

## Не делать

Не менять код, CI, runtime, release acceptance, production, тестовые бюджеты или чужие worktrees. Не ослаблять safety rules ради длины. Не объявлять общий лозунг доказанным no-op без наблюдения поведения.
