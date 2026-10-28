---
id: '21.5.6'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Решение владельца OQ-3 (2026-10-28): удалить legacy/python-prototype и документы фаз 1–2, история остаётся в Git. Пакет из отчёта 21.5.1: LEG-21.'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FULLSTACK, TECHNICAL_WRITER]
depends_on: ['21.5.1', '21.3.1']
supersedes: []
decisions: []
estimated_hours: '2-6'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup, docs]
---

# Task 21.5.6: Удаление наследия, Python-прототип и документы фаз 1–2

## Цель

Удалить каталог `legacy/python-prototype` и два документа фаз 1–2, исправить ссылки на них и убрать ставшие мёртвыми записи в конфигурации (`LEG-21` принятого отчёта [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md)).

## Контекст

- Решение владельца **OQ-3** ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), запись 2026-10-28): удалить; история остаётся в Git. Это снимает запрет эпика 21.5 на удаление `legacy/python-prototype` для данного пакета.
- Состав (повторить проверки на актуальном `main` перед удалением):
  - каталог `legacy/python-prototype` (215 файлов, 1125 КБ): `find legacy/python-prototype -type f | wc -l`;
  - ровно два документа «фаз 1–2»: `docs/phases/1-python-legacy.md` и `docs/phases/2-python-legacy-subscriptions.md`; эпиков и карточек фаз 1–2 в `docs/epics`, `docs/tasks` нет.
- Входящие ссылки, которые пакет исправляет: `README.md` (раздел «Legacy 1: Python-прототип» и дерево каталогов, строки 66, 126), `docs/MIGRATION_STRATEGY.md` (строки 38, 222, 271, 272). Запись о том, где искать код прототипа: последний коммит `main`, содержавший каталог (SHA указать в тексте), и пометка «удалён в 21.5.6».
- Простая текстовая строка `docs/ROADMAP.md:108` «Phase 1-2 ✅ — Python-прототип (legacy, для domain knowledge)» ссылки не содержит; пакет обновляет её (прототип удалён, история в Git) либо оставляет как историю фаз по решению ревью.
- Датированная сессия `docs/operations/sessions/2026/2026-05-25-strategic-pivot-to-saas.md` (строка 112) — история, текст не править.
- Конфигурация, ставшая мёртвой после удаления каталога, чистится в этом же пакете: `vitest.config.ts:15` (`'legacy/**'` в `exclude`), `.prettierignore:11`, `.dockerignore:12`, `eslint.config.js:16`. Удалять запись только если после удаления каталога она не относится ни к чему другому (проверить `rg -n "legacy" <файл>`).
- Риск низкий: прототип не входит в workspace, сборку, CI и Dockerfile; домен-знание хранится в Git и в `docs/DOMAIN.md`, `docs/PLATFORM_VISION.md`.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Повторить проверки: `rg -n "1-python-legacy|2-python-legacy" .` вне самих файлов → 0; `rg -n "python-prototype|legacy/python" . --glob '!legacy/**'` → только перечисленные в контексте места; убедиться, что `legacy/` не упомянут в `pnpm-workspace.yaml`, `package.json`, `turbo.json`, workflows и Dockerfile.
2. Зафиксировать SHA `main`, содержащий каталог, для ссылок «история в Git».
3. Удалить `legacy/python-prototype`, `docs/phases/1-python-legacy.md`, `docs/phases/2-python-legacy-subscriptions.md`.
4. Исправить `README.md` и `docs/MIGRATION_STRATEGY.md`: заменить ссылки на путь на пометку «удалён, смотри Git (SHA)».
5. Убрать мёртвые записи из `vitest.config.ts`, `.prettierignore`, `.dockerignore`, `eslint.config.js`.
6. Проверить `pnpm format:check`, `lint`, `test`, `build`; локальные ссылки документов (`rg` по `legacy/`).
7. Обновить отчёт аудита: статус `LEG-21` — удалено + номер PR.

## Критерии приёмки

- ✅ Удалены только `legacy/python-prototype` и два названных документа; других документов фаз и каталогов не затронуто
- ✅ `rg -n "python-prototype|legacy/python|1-python-legacy|2-python-legacy" . --glob '!legacy/**'` находит только сессию 2026-05-25, журнал решений, отчёт аудита, эпик `docs/epics/21-5-legacy-cleanup.md` и карточки 21.5.x
- ✅ Конфигурация очищена от `legacy`-записей, которые больше ни к чему не относятся; `format:check`, `lint`, `typecheck`, `test`, `build` зелёные
- ✅ Данные, схема и миграции не изменены
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять ничего, чего нет в принятом отчёте аудита 21.5.1
- ❌ Не править датированные сессии и журнал решений
- ❌ Не удалять другие документы фаз и не менять `docs/DOMAIN.md`, `docs/PLATFORM_VISION.md`
- ❌ Не трогать данные, миграции, rollback-скрипты
