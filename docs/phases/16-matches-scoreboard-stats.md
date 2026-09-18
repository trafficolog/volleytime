---
id: '16'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'Порт Level Volley: matches, live scoring, standings.'
estimated_hours: '60-80'
depends_on: ['10']
gate: '≥ 3 запросов на турниры от существующих организаторов'
---

# Phase 16: Matches + Live Scoreboard + Stats

**Цель.** Перенести из Laravel Level Volley логику матчей, live scoring и статистики. Это шаг к Tournament Mode.

## Гейт

Phase 16 запускается **только** при выполнении:

- ≥ 3 организаторов на платформе запросили турнирный функционал
- Или Volley Time проводит свой турнир и тестирует на нём

## Эпики

| ID    | Эпик                                                           | Задач |
| ----- | -------------------------------------------------------------- | ----: |
| 16.1  | Models: Match, MatchSet, MatchScoreAction, MatchTimeline       |     4 |
| 16.2  | Append-only Match Timeline с is_reverted                       |     3 |
| 16.3  | Optimistic locking через version field                         |     2 |
| 16.4  | Live scoring service: add point, undo, finish set/match        |     4 |
| 16.5  | Auto-detection завершения сета и матча                         |     2 |
| 16.6  | EventStaff service (judge, event_admin per event)              |     3 |
| 16.7  | UI: judging session (mobile-first, крупные кнопки)             |     4 |
| 16.8  | UI: live scoreboard (auto-refresh 5 сек, на проектор)          |     3 |
| 16.9  | MVP voting                                                     |     3 |
| 16.10 | Standings: standard и sum_points системы                       |     4 |
| 16.11 | Tiebreak order (настраиваемый)                                 |     2 |
| 16.12 | UI: страница статистики, матрица личных встреч                 |     3 |
| 16.13 | Role hierarchy расширение (player → judge → organizer → admin) |     2 |
| 16.14 | Role requests workflow                                         |     2 |
| 16.15 | Tests                                                          |     5 |

## Что переносим из Level Volley

Подробный список — в [../MIGRATION_STRATEGY.md](../MIGRATION_STRATEGY.md#domain-knowledge-из-level-volley).

Ключевое:

- Append-only Match Timeline с is_reverted (золотой паттерн undo)
- Optimistic locking через version
- Live scoreboard auto-refresh
- MVP voting (один голос на участника матча)
- Standings с настраиваемой tiebreak_order
- scoring_system: standard (3/2/1/0) vs sum_points
- Mobile-first judging session

## Definition of Done

- На событие можно назначить судью
- Судья открывает матч, ведёт счёт через мобильный UI с крупными «+1» кнопками
- Undo работает (append-only, не удаление)
- Завершение сета и матча — автоматическое по правилам события
- Live scoreboard на отдельной странице для проектора
- Standings обновляется после каждого матча
- MVP voting работает (один голос на участника)
