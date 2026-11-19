---
id: '22'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Референс v3 Ф2 (Root Admin) + R-08. 9 задач.'
estimated_hours: '52-104'
depends_on: []
---

# Phase 22: Root Admin

**Цель.** Админка платформы: организации, пользователи, баланс и тарифы, выдача баланса, аудит, настройки платформы.

## Контекст

Следующий шаг после MVP организатора. Поглощает эпик 10.3 (super-admin обзор) и экраны 7.7 (root-admin credits).

Источник — референс v3 (Ф2 (Root Admin) + R-08), импорт в [docs/design/reference-v3](../design/reference-v3/README.md); перепланирование — [19.0.1](../tasks/19-0-1-reference-v3-replan.md).

## Definition of Done

1. Root Admin закрыт для не-root на уровне API
2. Все root-действия в журнале
3. v0.4.0 выкачен и принят (22.3.2)

## Эпики

| ID                                     | Эпик                                           | Задач | Часов |
| -------------------------------------- | ---------------------------------------------- | ----: | ----: |
| [22.1](../epics/22-1-root-core.md)     | Root: каркас, организации, пользователи, аудит |     4 | 16-32 |
| [22.2](../epics/22-2-root-money.md)    | Root: деньги платформы                         |     3 | 24-48 |
| [22.3](../epics/22-3-root-settings.md) | Root: настройки платформы                      |     2 | 12-24 |

**Итого:** 3 эпиков, 9 задач, 52-104 ч. Модели реализации: `claude-opus-5-5` — 2, `claude-sonnet-5-5` — 7.

## Технические заметки

### Что НЕ делаем в этой фазе

- ❌ Выплаты и сверка с провайдером — по D-07

### Бэклог фазы

Решение владельца 2026-11-19 ([D-17](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-17)): расхождения Root Admin с макетом вынесены в карточки бэклога без релиза: [22.1.5](../tasks/22-1-5-audit-log-severity-levels.md), [22.1.6](../tasks/22-1-6-audit-export-header-search.md), [22.1.7](../tasks/22-1-7-root-overview-activity-24h.md), [22.1.8](../tasks/22-1-8-root-org-create-plan-credits.md), [22.1.9](../tasks/22-1-9-root-org-create-invite-owner.md). В число задач, часов и состав `v0.4.0` они не входят.

### Открытые вопросы

- Решения владельца: [журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md). Визуальная сверка экранов Root Admin — вручную, а не харнессом 19.0.2: [D-16](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-16).

## Ссылки

- [ROADMAP.md](../ROADMAP.md)
- [RELEASES.md](../RELEASES.md)
- [ORCHESTRATION.md](../ORCHESTRATION.md)
