---
id: '8.7'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Автотесты (initData, notifier) + manual QA MVP в реальном Telegram.'
estimated_hours: '3-4'
depends_on: ['8.5', '8.6']
---

# Epic 8.7: Tests + manual QA

**Цель.** Тесты initData валидации, notifier. Manual QA полного MVP-сценария в реальном Telegram (iOS + Android).

## Контекст

Скелет (сессия 2). Финальная проверка MVP-готовности перед Phase 9 (deploy).

## Definition of Done

- initData валидация тесты (валидная/невалидная подпись, expired)
- Notifier тесты (рендеринг, fire-and-forget)
- Manual QA чеклист: полный сценарий игрока + организатора в Telegram
- iOS + Android Telegram проверка
- MVP-критерий: неделя тренировок только через Mini App

## Задачи

| ID                                             | Задача                                | Часов |
| ---------------------------------------------- | ------------------------------------- | ----: |
| [8.7.1](../tasks/8-7-1-auth-notifier-tests.md) | initData + notifier автотесты         |   1-2 |
| [8.7.2](../tasks/8-7-2-manual-qa.md)           | Manual QA чеклист + прогон в Telegram |   1-2 |

## Не делать

- ❌ E2E браузерные — Phase 9
- ❌ Детали — в сессии 2
