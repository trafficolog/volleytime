---
id: '11'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'Сборы. Phase 11+ — после подтверждения гипотезы.'
estimated_hours: '25-35'
depends_on: ['10']
---

# Phase 11: Contributions (сборы)

**Цель.** Прозрачный учёт сборов: на мяч, на турнир, на форму, на аренду, на судью.

Подробный дизайн — в [../strategy/CONTRIBUTIONS.md](../strategy/CONTRIBUTIONS.md).

## Эпики (черновой план)

| ID   | Эпик                                                    | Задач |
| ---- | ------------------------------------------------------- | ----: |
| 11.1 | ContributionCampaign CRUD                               |     3 |
| 11.2 | Contribution CRUD (pledge → received)                   |     4 |
| 11.3 | UI: список кампаний, карточка, прогресс-бар             |     3 |
| 11.4 | UI: создание кампании (FSM)                             |     2 |
| 11.5 | UI: внесение вклада (pledge), отметка получения (admin) |     3 |
| 11.6 | Public link для visibility=public_link                  |     2 |
| 11.7 | Связь с Ledger (income при received_*)                  |     1 |
| 11.8 | Уведомления о новой кампании в организацию              |     1 |
| 11.9 | Tests                                                   |     2 |

## Definition of Done

- Owner создаёт кампанию «Новый мяч 250 BYN»
- Игроки видят кампанию, обещают N BYN (pledged)
- Owner отмечает получение наличными → progress растёт
- При received_* → LedgerEntry (income, category=contribution)
- Public link даёт share-ссылку
- Feature entitlement `contributions` проверяется (Phase 7+)

## Что переносим из Level Volley

Ничего напрямую. Контрибуции — новая фича.
