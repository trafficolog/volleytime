---
id: '4.9.6'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #6'
priority: P1
roles:
  - SECURITY
  - DOCS
depends_on:
  - '4.9.1'
estimated_hours: '1'
tags:
  - permissions
  - sdd
  - review-fix
---

# Task 4.9.6: Матрица прав: синхронизировать карточку 4.3.1 с кодом (SDD)

## Цель

Устранить расхождение «спека owner-only / код organizer»: зафиксировать решение в карточке до кода и привести политики к нему.

## Контекст

В e5fd27c права organizer расширены (участники, инвайты в т.ч. с ролью organizer, аудит) без обновления карточки 4.3.1.

## Что должно быть сделано

1. Решение (ADR в карточке 4.3.1): организатор — операционный помощник владельца:
   - owner: настройки, архив, **смена ролей**, инвайты с ролью `organizer`/`assistant`
   - owner + organizer: инвайты с ролью `player`, approve/reject, block/unblock игроков, просмотр аудита
   - organizer не может блокировать/менять owner и других organizer
2. Политики: `requireCanInviteRole(member, role)`, `requireCanModerate(actor, target)`.
3. Тесты политик на всю матрицу.

## Критерии приёмки

- ✅ Карточка 4.3.1 содержит матрицу и дату решения
- ✅ Организатор не создаёт инвайт с ролью organizer (403), не блокирует organizer/owner (403)

## Подсказки

- Дизайн «Кабинет организатора» предполагает управление игроками организатором — поэтому выбрано обновление спеки, а не откат.

## Не делать

- ❌ Не менять код раньше карточки
