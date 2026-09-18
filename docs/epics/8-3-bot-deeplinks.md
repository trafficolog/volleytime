---
id: '8.3'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Бот: команды + deeplinks (org_ refine, event_ new).'
estimated_hours: '3-4'
depends_on: ['3.5', '4.4']
---

# Epic 8.3: Bot команды + deeplinks (org_, event_)

**Цель.** Расширить бота: /start с deeplinks (org_ из 4.4.4 + новый event_), /help, кнопка открытия Mini App. Бот — точка входа, основная работа в Mini App.

## Контекст

Phase 3 (3.5.2) сделал базовый /start, Phase 4 (4.4.4) — org_ invite deeplink. Phase 8 добавляет event_ deeplink (поделиться событием) и финализирует команды.

Решение 8: минимум команд (/start, /help). Решение 9: event_ deeplink да. Решение 10: long-polling.

## Definition of Done

- /start без параметра → приветствие + кнопка «Открыть Volley Time» (Mini App)
- /start org_<token> → invite preview (из 4.4.4, проверить работу)
- /start event_<id> → кнопка открытия Mini App на странице события
- /help → краткая справка
- Кнопка Mini App ведёт на правильный URL с deeplink-контекстом
- Long-polling режим (webhook — Phase 9)
- event deeplink резолвит событие (preview: название, дата, место)

## Задачи

| ID    | Задача                                               | Часов |
| ----- | ---------------------------------------------------- | ----: |
| 8.3.1 | /start расширение: event_ deeplink + Mini App кнопки |     2 |
| 8.3.2 | /help + финализация команд                           |     1 |

## Не делать

- ❌ Не делать inline-режим — после MVP
- ❌ Не делать webhook — Phase 9
- ❌ Не делать /menu, /myorgs (Mini App — основная работа)
- ❌ Не делать кнопки-действия в чате (всё в Mini App)
