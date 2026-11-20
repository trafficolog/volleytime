---
id: '28.1.4'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Решение владельца D-22 (2026-11-20): модель ассистента в сессии, разрешённые папки.'
ref_id: ''
review_ref: ''
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps, Security]
depends_on: ['28.1.3']
supersedes: []
decisions: ['D-22']
estimated_hours: '3-7'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, docs, privacy]
---

# Task 28.1.4: Семантический проход по документам

## Цель

Связать в графе карточки, эпики, ADR, решения и референс с кодом, отправляя внешней модели только разрешённые владельцем папки.

## Контекст

- Семантический проход отправляет содержимое файлов модели ассистента или настроенному backend ([28.1.1](28-1-1-graphify-evaluation.md)). Репозиторий публичный, но `docs/operations` содержит evidence с хостами, IP и данными выкладки.
- Решение владельца [D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22): проход моделью ассистента в сессии, без отдельного API-ключа; разрешены `docs/tasks`, `docs/epics`, `docs/phases`, `docs/architecture`, текст `docs/design/reference-v3`, корневые `docs/*.md`; `docs/operations` исключена.
- Как включается `/graphify` без хука (по коду 0.9.103, [28.1.1](28-1-1-graphify-evaluation.md#что-пишет-graphify-install-по-installpy)): `graphify install` без `--project` копирует только скилл в `~/.claude/skills/graphify/` и добавляет блок регистрации в `~/.claude/CLAUDE.md` (уровень пользователя), хуков не ставит; `graphify install --project` и `graphify claude install` пишут хук в `.claude/settings.json` и запрещены D-22.

## Что должно быть сделано

1. Проверить, что в окружении нет `ANTHROPIC_API_KEY` и других ключей backend; проход идёт через `/graphify` в сессии ассистента.
2. Расширить `.graphifyignore` или `--exclude` так, чтобы проход видел только разрешённые папки; `docs/operations` и любые файлы с IP, хостами VPS, персональными данными — исключены.
3. Запустить проход, затем `--update` после изменения одного файла — проверить, что пересобирается только он.
4. Повторить проверку `graph.json` на секреты из 28.1.2, плюс IP и имена хостов.
5. Три контрольных вопроса через документы (например: какая карточка владеет правилом лимита событий в день, какие решения повлияли на 22.3.1).

Заметка из 28.1.2: прототипы `docs/design/reference-v3/handoff/` входят в область графа кода (AST), поэтому 28.1.4 решает, исключать ли их из `.graphifyignore` как шум.

## Критерии приёмки

- ✅ Список отправленных файлов совпадает с разрешёнными (лог прохода)
- ✅ Проверка на секреты, IP и хосты пуста
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не задавать API-ключ backend и не расширять список папок без нового решения владельца
- ❌ Не отправлять `docs/operations`, ключи, `.env*`, данные игроков
- ❌ Не использовать Graphify Cloud, `graphify add <url>` и `--wiki`
