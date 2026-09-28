---
id: '8.10.3'
phase: '8'
epic: '8.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'Organizer 8.10.2 и review-fix 8.10.4 приняты через PR #55 с CI; 8.10.5 уже в main. Player/landing интеграция, общая совместная матрица R0.6 и Telegram-host acceptance открыты.'
roles: [QA, FE]
depends_on: ['3.11.3', '8.10.1', '8.10.2', '8.10.4', '8.10.5', '5.15.1', '6.10.1']
estimated_hours: '6-10'
tags: [qa, mvp, redesign]
---

# Task 8.10.3: Сквозная приёмка дизайна v2

## Цель

Подтвердить полноту MVP-экранов и состояний относительно архива v2 и отсутствие регрессий.

## Контекст

Частичная [organizer QA 2026-09-28](../operations/qa/2026-09-28-organizer-miniapp-post-main.md) не означает завершения зависимостей/общей приёмки. Фикс 8.10.5 принят в main через PR #53; его локальная интеграция прошла пять gates, независимое whole-branch review без замечаний, 28 основных browser cases и 12 invite cases. Home native 200% подтверждён пользователем; остальные native-zoom и совместная player/organizer/auth/desktop матрица не считаются закрытыми этим результатом.

[Карта v2](../design/2026-09-23-reference-v2.md) задаёт screen matrix и границу будущих релизов.

## Что должно быть сделано

1. Собрать матрицу «референс → route → state → screenshot/test» для auth, Mini App игрока/организатора и desktop-организатора.
2. Пройти визуальный QA 320/390/1280/1440 px, светлую и Telegram-тёмную тему, 200% zoom, клавиатуру и состояния ошибок.
3. Прогнать пять gates и production-impacting smoke; зафиксировать отдельно ручной Telegram QA и реальную pilot-валидацию.

## Критерии приёмки

- Каждая MVP-ячейка матрицы имеет проверенный результат или отдельный дефектный SDD-task.
- Нет утверждений о live Telegram/production из локальных тестов.
- Пять gates зелёные; статус release readiness обновлён по фактам.

## Подсказки

### Локальная регрессия приглашений 2026-09-28

При post-main organizer QA обнаружен overflow действий `/m/orgs/30/invite`; исправление оформлено отдельной [8.10.5](./8-10-5-miniapp-invite-actions-reflow.md). Его итоговый browser regression прошёл 12/12 (client width 320/390/160, light/dark, оба состояния копирования), клавиатурный Tab copy → share → revoke и цель отзыва 44×44. PNG 320/160 light/dark просмотрены, пять gates и scoped review без блокирующих замечаний. Эти результаты относятся к строке действий приглашения, не закрывают остальные строки матрицы, native zoom или Telegram-host. PR/CI/merge фиксируются в карточке 8.10.5 отдельно.

- Скриншоты будущих фаз не входят в MVP-матрицу.

## Не делать

- Не считать статический JSX-прототип подтверждением работоспособности API.
