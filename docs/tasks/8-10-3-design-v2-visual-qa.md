---
id: '8.10.3'
phase: '8'
epic: '8.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-29
status_note: 'Implementation-зависимости, 3.11.9 и 8.10.6 приняты в main. Локальный R0.6 closure-map дополнен Chrome 200% auth/player; найден minor OTP timer 0:60 → 3.11.10, до его исправления QA не закрыт. Прежние task-level POST остаются P, Telegram-host T после controlled deploy. Итоговые gates/review/CI после интеграции 3.11.10 ещё ожидаются; prod/VPS не менялись.'
roles: [QA, FE]
depends_on:
  [
    '3.11.3',
    '3.11.4',
    '3.11.8',
    '3.11.9',
    '3.11.10',
    '8.10.1',
    '8.10.2',
    '8.10.4',
    '8.10.5',
    '8.10.6',
    '5.15.1',
    '6.10.1',
  ]
estimated_hours: '6-10'
tags: [qa, mvp, redesign]
---

# Task 8.10.3: Сквозная приёмка дизайна v2

## Цель

Подтвердить полноту MVP-экранов и состояний относительно архива v2 и отсутствие регрессий.

## Контекст

2026-09-29: [native Chrome 200% auth/player](../operations/qa/2026-09-29-native-200-auth-player.md) завершил недостающий репрезентативный zoom-проход: email/code, две группы, Home/event/bookings/subscriptions/profile сверху и после прокрутки, без горизонтального переполнения; группа с выключенными новыми абонементами и сохранённым остатком показывает просмотр по правилу. В кодовом состоянии обнаружен `0:60`, исправление выделено в 3.11.10 и требуется до итогового QA gate. Реальный Telegram не заявлен.

2026-09-29: [8.10.6](./8-10-6-miniapp-invite-load-retry.md) принята через [PR #64](https://github.com/trafficolog/volleytime/pull/64) в `main=c473de1`, CI PR/main прошли, merge tree совпадает с проверенным head. Исправленный Chrome даёт 45/45 error/retry с настоящими локальными GET200 и успешным empty после повтора; failed-revoke fixture 4/4 сохраняет ссылку/действия без повторного POST. Дополнительно primary-route error/retry 21/21. [Актуальное дополнение](../operations/qa/2026-09-29-entry-invite-error-states.md) и [closure-map](../operations/qa/2026-09-28-r06-integrated-matrix.md) разделяют свежие F, принятые ранее P и будущие Telegram T. Старые строки ниже о незавершённой 8.10.6 — исторический RED checkpoint. До принятия этой QA-ветки нужны финальные пять gates/review/CI; production не менялся.

2026-09-29: [дополнительный Chrome проход](../operations/qa/2026-09-29-entry-invite-error-states.md) дал 60/60 entry/invite/group states и 41/41 error→retry к real local API. Organizer invite при GET 503 показал ложный empty и отсутствие retry в четырёх размерах/темах; до кода создана отдельная [8.10.6](./8-10-6-miniapp-invite-load-retry.md). Пользователь подтвердил bounded RED→GREEN план исправления. Общий QA остаётся открытым до исправления, remaining targeted primary-route/role checks и release gates; prod/VPS не менялись.

2026-09-29: [3.11.9](./3-11-9-global-local-reference-fonts.md) принята в main через PR #61/#62; main `c946142` объединён с сохранённым checkpoint `c0883fc` как `12b6c96`. Документные конфликты разрешены без потери QA evidence; runtime diff с main отсутствует. [Повторная font/visual QA](../operations/qa/2026-09-29-global-local-reference-fonts.md): 48 Mini App + 55 desktop cases с фактически loaded faces, auth 15/15, landing 5/5, реальные read-only organizer controls, пять gates (124/722), независимые review и точный CI. Историческое замечание о font-delivery ниже закрыто; оставшиеся entry/invite/error states и итоговый release smoke ещё не приняты. Это не общий R0.6 gate и не Telegram-host acceptance.

2026-09-28: landing 3.11.4 принят в main через PR #43 (`1fa662f`), CI `36467608712` success на `e6bfaf3`, дерево merge идентично проверенному. [Повторная landing QA](../operations/qa/2026-09-28-landing-post-main.md) фиксирует Chrome matrix, no-JS SSR/FAQ, motion/reduced-motion/teardown и пользовательский zoom 200%/реальный фон stop-resume; эти ручные пункты не требуют повторного запроса. Minor session failure fallback выделен в 3.11.8 до общего R0.6 gate. Эти свидетельства не закрывают всю сквозную матрицу и реальный Telegram-host QA.

Частичная [organizer QA 2026-09-28](../operations/qa/2026-09-28-organizer-miniapp-post-main.md) не означает завершения зависимостей/общей приёмки. Фикс 8.10.5 принят в main через PR #53; его локальная интеграция прошла пять gates, независимое whole-branch review без замечаний, 28 основных browser cases и 12 invite cases. Home native 200% подтверждён пользователем; остальные native-zoom и совместная player/organizer/auth/desktop матрица не считаются закрытыми этим результатом.

[Карта v2](../design/2026-09-23-reference-v2.md) задаёт screen matrix и границу будущих релизов.

### Интегрированный проход 2026-09-28

3.11.8 принята в main как `07fb8af` через PR #59, exact-head CI `36476869854` success; документация PR #60 принята как `060ecdf`, CI `36477590297` success. Обе merge tree идентичны соответствующим проверенным head. Начата отдельная `trafficolog/test/8.10.3-r06-integrated-qa` от `060ecdf`. Обновления между проверенной сборкой 3.11.8 и этим main — только четыре документа, runtime-source неизменён.

[Матрица reference → route → state → evidence](../operations/qa/2026-09-28-r06-integrated-matrix.md) отделяет свежий Chrome, прежнюю task acceptance и оставшиеся пункты. План: сначала public/auth + player 320/390 light/dark и ошибки, затем organizer на тех же размерах/темах, desktop 1280/1440 и узкий reflow; отдельно сверить клавиатуру/листы/длинные строки и уже полученные manual evidence. После полного доступного локального прохода — финальные gates/review/CI, controlled prod promotion и отдельный реальный Telegram QA по решению пользователя. Нельзя закрывать общую задачу лишь потому, что все implementation cards done.

Свежий Chrome на built preview `3168`: landing 503/FAQ/CTA и regression smoke прошли; player fidelity 41/41, group-race, network/retry, switcher restricted-group routes и шесть auth/access error states прошли с HTTP fixtures. Штатный email OTP `qa8101-player@example.test`, отдельная QA-БД `volleytime_qa_8101_selfcheck`, настоящий API без interception: 7 экранов × 320/390 × light/dark = 28/28 (overflow, низ страницы/dock, видимые цели ≥44×44). Выборочные PNG Home/Event/Subscriptions/Profile просмотрены. Это не новый полный денежный сценарий, native browser 200% или Telegram themeChanged/host acceptance. Ранее подтверждённые пользователем landing/organizer Home/desktop finance 200% и screen-reader evidence не запрашиваются повторно.

## Что должно быть сделано

Дополнительный Chrome owner-проход: 12 Mini App routes × 320/390 × light/dark и 11 desktop routes × 1280/1440/720/390 дали 92 geometry cases без overflow/pageerrors. Штатный owner OTP показал выбор двух организаций. Cashbox real GET loading→empty сохраняет баланс/фокус; Menu/expense focus trap/Escape/restore и event tabs ArrowRight/Home прошли без POST. При визуальном просмотре подтверждён отдельный дефект [3.11.9](./3-11-9-global-local-reference-fonts.md): auth/desktop direct entry зависит от внешнего Google CSS и при его недоступности даёт FontFaceSet=[]/fallback. Сквозная visual acceptance не закрывается geometry pass. Карточка/план созданы до исправления; общий QA остаётся in_progress. Подробные routes, состояния и ограничения — в [интегрированной матрице](../operations/qa/2026-09-28-r06-integrated-matrix.md).

1. Собрать матрицу «референс → route → state → screenshot/test» для публичного MVP-лендинга, auth, Mini App игрока/организатора и desktop-организатора.
2. Пройти визуальный QA 320/390/1280/1440 px, светлую и Telegram-тёмную тему, 200% zoom, клавиатуру и состояния ошибок; на лендинге также проверить CTA/якоря/FAQ, reduced motion и отсутствие обещаний будущих функций.
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
