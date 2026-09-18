---
id: '13'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'Каждая организация подключает свой bePaid аккаунт через add-on.'
estimated_hours: '25-35'
depends_on: ['12']
---

# Phase 13: Online Payments — organizer add-on

**Цель.** Превратить bePaid-интеграцию из Phase 12 в **подключаемый модуль** для любого организатора. Каждая организация подключает свой bePaid-аккаунт (или ЮKassa для РФ).

## Эпики

| ID   | Эпик                                                    | Задач |
| ---- | ------------------------------------------------------- | ----: |
| 13.1 | Encrypted storage для bepaid_credentials (per org)      |     2 |
| 13.2 | UI: настройки организации → «Подключить bePaid»         |     2 |
| 13.3 | Feature entitlement: `online_payments` (paid add-on)    |     1 |
| 13.4 | Multi-merchant BePaidClient (creds per request)         |     2 |
| 13.5 | Webhook routing по tracking_id → правильная организация |     2 |
| 13.6 | Документация для организатора: как подключить bePaid    |     1 |
| 13.7 | ЮKassa интеграция для РФ-организаторов (опционально)    |     4 |
| 13.8 | Tests                                                   |     3 |

## Definition of Done

- Новая организация подключает свои bePaid creds через UI
- Платежи в этой организации идут через её bePaid (не платформы)
- Платформа никогда не видит сумм платежей кроме `bepaid_uid` и `status`
- Encryption key для credentials хранится в env, ротация документирована
- Если организация — резидент РФ, опция подключить ЮKassa

## Открытые вопросы

- AES-256-GCM для encryption credentials — финализировать в Phase 13
- Что делать если creds устарели / отозваны merchant'ом — graceful degradation
