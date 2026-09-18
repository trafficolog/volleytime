---
id: '17'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'Объединение Events + Matches под турнирные сетки.'
estimated_hours: '50-70'
depends_on: ['16']
---

# Phase 17: Tournament Mode

**Цель.** Объединить Events и Matches под турнирные сетки. Создание турнира с командами, расписанием, round-robin / playoff.

## Эпики

| ID    | Эпик                                                           | Задач |
| ----- | -------------------------------------------------------------- | ----: |
| 17.1  | Tournament model и CRUD                                        |     3 |
| 17.2  | TournamentTeam model + members                                 |     3 |
| 17.3  | Team generation: random, balanced (по рейтингу)                |     4 |
| 17.4  | Drag-and-drop игроков между командами                          |     3 |
| 17.5  | Schedule generation: round-robin                               |     3 |
| 17.6  | Группировка матчей по раундам                                  |     2 |
| 17.7  | UI: создание турнира (FSM или multi-step form)                 |     3 |
| 17.8  | UI: страница турнира с табами (Обзор/Команды/Матчи/Статистика) |     4 |
| 17.9  | Импорт участников (CSV, email-list)                            |     2 |
| 17.10 | Назначение судей на каждый матч (per-match assignment)         |     2 |
| 17.11 | Public page турнира с QR-кодом                                 |     3 |
| 17.12 | Tests                                                          |     4 |

## Что переносим из Level Volley

- Tournament concept (на уровне модели и UX)
- Балансированный team generation (по rating)
- Round-robin генератор
- Tab layout страницы события
- QR-код для публичной страницы

## Definition of Done

- Owner создаёт турнир, импортирует список email
- Owner генерирует команды (balanced по рейтингу)
- Owner генерирует расписание (round-robin)
- Назначает судью на каждый матч
- Матчи играются (Phase 16 функционал)
- Live scoreboard, standings, MVP голосование работают
- Публичная страница доступна по QR
