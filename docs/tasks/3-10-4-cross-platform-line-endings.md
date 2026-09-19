---
id: '3.10.4'
phase: '3'
epic: '3.10'
status: done
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Added a repository LF policy; after the separate 3.10.6 baseline-format fix, the full Windows format check and diff checks pass.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '3.9.6'
  - '3.10.6'
estimated_hours: '1'
tags:
  - formatting
  - git
  - windows
---

# Task 3.10.4: кроссплатформенные окончания строк

## Цель

Сделать `pnpm format:check` воспроизводимым на Windows и Linux независимо от глобального `core.autocrlf` разработчика.

## Контекст

Репозиторий хранит LF, но не содержит `.gitattributes`. Системный Git на Windows настроен с `core.autocrlf=true` и преобразует рабочие копии в CRLF. Prettier затем считает 746 файлов неотформатированными, хотя тот же commit проходит Linux CI.

## Что должно быть сделано

1. Зафиксировать LF для отслеживаемых текстовых файлов через корневой `.gitattributes`.
2. Не изменять содержимое существующих файлов и не создавать массовый formatting diff.
3. Проверить чистый Windows checkout при сохранённом глобальном `core.autocrlf=true`.

## Критерии приёмки

- ✅ Git checkout использует LF для tracked text files на Windows и Linux.
- ✅ `pnpm format:check` проходит в Windows worktree.
- ✅ `git diff --check` проходит.
- ✅ В diff отсутствует массовая перезапись файлов.

## Не делать

- ❌ Не коммитить массовую перезапись файлов; локальная нормализация существующего worktree допустима только при нулевом source diff.
- ❌ Не менять глобальную Git-конфигурацию пользователя.
- ❌ Не разрешать смешанные CRLF/LF через `endOfLine: auto`.
