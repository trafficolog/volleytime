---
id: '4.8'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Smoke + security-critical tests.'
estimated_hours: '4-6'
depends_on: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6']
---

# Epic 4.8: Tests (smoke + security)

**Цель.** Покрыть тестами все основные flow и критические security-сценарии Phase 4.

## Контекст

Решение 13 в phase-card: B + некоторые из C для security-критичных мест.

Категории:

- **Smoke:** базовый happy path для каждого сервиса (create org → list → archive)
- **Integration:** полный invite flow от создания до acceptance
- **Security:** user A не может видеть/менять данные user B's organization

## Definition of Done

- **Integration тесты** для основных flow:
  - Создание организации → auto-create owner member → list
  - Полный invite flow: create invite → preview → accept → member created (active или pending в зависимости от org setting)
  - Block member → his pending bookings (в Phase 4 их нет, но проверим что member.status=blocked)
  - Leave organization (player) → status=left, history preserved
- **Security тесты:**
  - User A не видит members of org B
  - User A не может изменить settings org B
  - Non-owner не может изменить роли
  - Blocked member не может делать никаких операций в org
  - Archived org не позволяет операций
  - Invite preview доступен без auth, но invite acceptance требует auth
  - Owner не может разжаловать сам себя
- **Race condition tests** (несколько критических):
  - Два user одновременно принимают один invite с max_uses=1 — только один проходит
  - Удаление member в момент его операции — graceful handling

Total: ~30-40 тестов в этом эпике.

## Задачи

| ID                                              | Задача                                   | Часов |
| ----------------------------------------------- | ---------------------------------------- | ----: |
| [4.8.1](../tasks/4-8-1-flow-tests.md)           | Integration tests основных flow          |     2 |
| [4.8.2](../tasks/4-8-2-security-tests.md)       | Security tests (cross-org access denied) |   1-2 |
| [4.8.3](../tasks/4-8-3-race-condition-tests.md) | Race condition tests                     |   1-2 |

## Не делать

- ❌ Не делать E2E через Playwright — Phase 9+
- ❌ Не покрывать 100% — только основные + security-critical
- ❌ Не делать performance tests — Phase 14+
- ❌ Не делать UI snapshot tests — слабый ROI
