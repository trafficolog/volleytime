---
id: '3.9.10'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #10'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.9.2'
estimated_hours: '1'
tags:
  - telegram
  - security
  - zod
  - review-fix
---

# Task 3.9.10: validateInitData: окно 1 ч, дата из будущего, zod-схема user

## Цель

Сузить окно повторного использования initData и валидировать структуру пользователя.

## Контекст

Окно 24 ч при 30-дневной сессии; `auth_date` из будущего проходит; `user` парсится `JSON.parse` без проверки (`id` может быть строкой/отсутствовать).

## Что должно быть сделано

1. `maxAgeSeconds` по умолчанию `3600`; допуск рассинхрона часов `+60 s`: `if (authDate - now > 60) throw 'auth_date is in the future'`.
2. `TelegramUserSchema = z.object({ id: z.number().int().positive(), first_name: z.string().min(1), last_name, username, language_code, photo_url: z.string().url() }).passthrough()`; ошибка парсинга/схемы → `TelegramAuthError('Invalid user')`.
3. Тесты: просроченный (>1 ч), будущий, битый JSON, `id` строкой.

## Критерии приёмки

- ✅ initData старше 1 ч отвергается
- ✅ `auth_date` > now+60 s отвергается
- ✅ `user` без числового `id` отвергается

## Подсказки

- Telegram рекомендует проверять `auth_date`; Mini App получает свежий initData при каждом открытии.

## Не делать

- ❌ Не отключать проверку срока в production
