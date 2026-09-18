---
id: '3.9.9'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #9'
priority: P1
roles:
  - DB
  - SECURITY
depends_on: []
estimated_hours: '0.5'
tags:
  - db
  - tests
  - review-fix
---

# Task 3.9.9: truncateAll только из @volley-time/db/test-utils

## Цель

Убрать опасную функцию `TRUNCATE users CASCADE` из основного entry пакета БД (карточка 3.7.2).

## Контекст

`truncateAll` экспортируется из `@volley-time/db` — попадает в прод-бандл web и доступна любому серверному коду.

## Что должно быть сделано

1. `packages/db/package.json` → `exports["./test-utils"]`.
2. Удалить реэкспорт из `src/index.ts`; в `test-utils.ts` guard: `if (process.env.NODE_ENV === 'production') throw`.
3. Обновить импорты тестов.

## Критерии приёмки

- ✅ `import { truncateAll } from '@volley-time/db'` не компилируется
- ✅ `@volley-time/db/test-utils` работает в тестах; в production бросает

## Подсказки

- Проверка: `grep -r truncateAll apps` → 0.

## Не делать

- ❌ Не использовать truncate в прикладном коде
