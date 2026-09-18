---
id: '7.7'
phase: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Root-admin (расширенный super-admin 10.3): grant, confirm, тарифы, audit.'
estimated_hours: '3-4'
depends_on: ['7.5', '10.3']
---

# Epic 7.7: Root-admin — grant, confirm, тарифы, audit

**Цель.** Расширить super-admin (Phase 10.3): grant credits организации, подтверждение/отклонение заявок на покупку, управление тарифной сеткой, audit транзакций.

## Контекст

Решение 7: root-admin = расширенный super-admin (не новый слой). Phase 10.3 дал обзор беты по telegram_id. Phase 7 добавляет управление монетизацией.

## Definition of Done

- Grant credits организации (admin_grant transaction, с заметкой)
- Список заявок на покупку (pending) → подтвердить/отклонить
- Подтверждение заявки → grant credits (7.5)
- Управление тарифной сеткой (7.4): просмотр/редактирование порогов/цен
- Audit: история всех credit-транзакций (по организациям)
- Только super-admin (10.3.1 requireSuperAdmin)

## Задачи

| ID    | Задача                                               | Часов |
| ----- | ---------------------------------------------------- | ----: |
| 7.7.1 | Grant credits + confirm/reject заявок (super-admin)  |   1-2 |
| 7.7.2 | Управление тарифами + audit транзакций (super-admin) |   1-2 |

## Не делать

- ❌ Не плодить отдельный admin-слой (расширяем 10.3)
- ❌ Не давать grant обычным организаторам
- ❌ Не делать сложную BI — простой audit-список
