---
id: '4.9.3'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #3'
priority: P1
roles:
  - BACK
  - DB
depends_on: []
estimated_hours: '1-2'
tags:
  - invites
  - concurrency
  - review-fix
---

# Task 4.9.3: max_uses при конкуренции: атомарный инкремент первым шагом

## Цель

Никогда не превышать `max_uses`: при 25 параллельных redeem с `maxUses=2` вступают ровно 2.

## Контекст

`redeem` делал read-modify-write `usesCount + 1` — 5 прогонов дали 2, 19, 11, 18, 19 вступивших.

## Что должно быть сделано

1. Первым шагом транзакции:

   ```sql
   UPDATE invite_links SET uses_count = uses_count + 1
   WHERE token = $1 AND is_revoked = false AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR uses_count < max_uses)
   RETURNING *
   ```

2. 0 строк → прочитать инвайт и бросить точную причину (not_found / revoked / expired / exhausted).
3. Затем проверка членства и insert/reactivate (4.9.9); ошибка откатывает инкремент.
4. Интеграционный тест: 25 параллельных пользователей, `maxUses=2`, 5 прогонов → ровно 2.

## Критерии приёмки

- ✅ Тест гонки стабильно даёт ровно `maxUses` вступлений
- ✅ Уже-участник не расходует использование

## Подсказки

- Row lock UPDATE сериализует конкурентов по одной строке.

## Не делать

- ❌ Не использовать advisory lock там, где хватает условного UPDATE
