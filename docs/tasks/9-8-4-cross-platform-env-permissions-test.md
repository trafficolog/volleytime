---
id: '9.8.4'
phase: '9'
epic: '9.8'
status: done
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Windows now verifies the renderer permission contract without treating emulated NTFS mode bits as POSIX evidence; the focused test and a fresh full repository gate pass.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.8.2'
estimated_hours: '0.5'
tags:
  - deployment
  - windows
  - permissions
  - tests
---

# Task 9.8.4: кроссплатформенный тест прав production env

## Цель

Сделать deploy-contract test воспроизводимым на Windows, не ослабляя требование `0600` для production Linux.

## Контекст

`render-production-env.mjs` создаёт файл с `mode: 0o600` и вызывает `chmodSync(..., 0o600)`. На Windows Node/NTFS не поддерживает POSIX permission bits: `statSync().mode & 0o777` возвращает эмулированное `0666`, хотя вызов renderer успешен. Production deploy и GitHub Actions работают на Linux.

## Что должно быть сделано

1. Сохранить проверки содержимого dotenv и отсутствия секретов в stdout/stderr на всех ОС.
2. Проверять фактический `0600` только там, где платформа поддерживает POSIX modes.
3. Не изменять production renderer и deploy workflow.
4. Повторить focused test и полный repository gate в свежем checkout.

## Критерии приёмки

- ✅ Focused deploy-contract test проходит на Windows.
- ✅ На POSIX тест продолжает требовать фактический mode `0600`.
- ✅ Renderer по-прежнему содержит оба уровня защиты: create mode и `chmodSync`.
- ✅ Полные format/lint/typecheck/test/build gates проходят.

## Не делать

- ❌ Не считать Windows mode bits доказательством Linux permissions.
- ❌ Не удалять или ослаблять `chmodSync(..., 0o600)`.
- ❌ Не менять состав или значения production secrets.

## Проверка

- `pnpm exec vitest run apps/web/server/utils/deploy-contract.test.ts` — 1 файл, 6 тестов пройдены.
- Свежий detached checkout на Windows: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — успешно.
- Полный тестовый набор: 71 файл, 389 тестов пройдены.
