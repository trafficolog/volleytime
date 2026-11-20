---
id: '28.1.1'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Запрос владельца 2026-11-20. Без установки: только чтение репозитория, PyPI и релизов.'
ref_id: ''
review_ref: ''
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps, Security]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, supply-chain]
---

# Task 28.1.1: Оценка и проверка безопасности Graphify

## Цель

Решить, можно ли ставить Graphify на машину разработки, и какую версию: лицензия, происхождение пакета, что и куда уходит в каждом режиме.

## Контекст

- Эпик [28.1](../epics/28-1-graphify-knowledge-graph.md), раздел «Контекст» — исходные сведения на 2026-11-20.
- Цепочка поставки CI — эпик [27.2](../epics/27-2-supply-chain-ci.md); здесь только локальный инструмент.

## Что должно быть сделано

1. Лицензия Apache-2.0 и лицензии зависимостей выбранных extras (без `all`).
2. Происхождение: страница PyPI `graphifyy` — владелец проекта, ссылки на `Graphify-Labs/graphify`; `publish.yml` — публикация через PyPI Trusted Publishing или токен; наличие attestations у выбранного релиза; совпадение тега и версии на PyPI. Проверить отсутствие typo-пакетов в инструкциях проекта (`graphify`, `graphifyy`).
3. Выбрать версию: релиз не моложе двух недель на момент установки (или решение владельца, вопрос 5 эпика); записать точную версию и хеш wheel.
4. Таблица потоков данных по режимам: AST кода; семантический проход через модель ассистента; через `--backend claude` и другие backend; Ollama; `graphify add <url>`; `graphify prs --triage`; MCP-сервер; Graphify Cloud. Для каждого — что отправляется и куда. Проверить по исходному коду заявление «нет телеметрии» (поиск сетевых вызовов вне backend).
5. Требования к Windows: Python 3.11+ через `uv`, где `uv tool` ставит окружение, что пишет `graphify install` с `--project` и без.
6. Итог — раздел «Результат» в этой карточке: можно / нельзя / с условиями.

## Критерии приёмки

- ✅ Версия, хеш, способ публикации и attestations записаны со ссылками
- ✅ Таблица потоков данных по каждому режиму
- ✅ Вывод о телеметрии подтверждён по коду, а не только по README
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не устанавливать пакет и не запускать `graphify` — это 28.1.2
- ❌ Не регистрироваться в Graphify Cloud и не создавать ключи
- ❌ Не менять код, CI и зависимости репозитория
