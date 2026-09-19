---
id: '3.10.6'
phase: '3'
epic: '3.10'
status: done
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Prettier was applied only to the two reported documents; focused checks and git diff --check pass with no semantic status changes.'
roles:
  - TECH_WRITER
  - QA
depends_on:
  - '3.9.6'
estimated_hours: '0.5'
tags:
  - documentation
  - formatting
---

# Task 3.10.6: baseline-форматирование операционной документации

## Цель

Устранить два содержательных нарушения Prettier, скрывавшихся за массовой CRLF-ошибкой Windows checkout.

## Контекст

После отдельной диагностики окончаний строк `prettier --check` продолжает отклонять только `docs/operations/status/current-state.md` и `docs/superpowers/plans/2026-09-18-release-readiness.md`.

## Что должно быть сделано

1. Применить Prettier только к двум выявленным документам.
2. Не менять смысл, статусы готовности или выводы документов.
3. Зафиксировать независимую проверку обоих файлов.

## Критерии приёмки

- ✅ Оба документа проходят `prettier --check`.
- ✅ Изменения являются только форматированием.
- ✅ `git diff --check` проходит.

## Не делать

- ❌ Не обновлять операционный статус проекта в рамках этой задачи.
- ❌ Не форматировать остальные файлы репозитория.
