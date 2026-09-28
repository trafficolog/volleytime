# 8.10.1 — интеграция Player Mini App после organizer main, 2026-09-28

Статус: локальная повторная проверка объединённого дерева; окончательная приёмка R0.6 и Telegram-host QA не заявлены. Ветка `trafficolog/feat/8.10.1-player-miniapp-v2` объединена с `origin/main` `f4c0da2`, содержащим принятые organizer PR #55/#56. `prod` и VPS не менялись.

## Изоляция и проверки

- Конфликты общего Sheet, layout, Home, списка событий и статусной документации разрешены с сохранением обеих ролей. Отдельные mounted-тесты проверили player hero/расписание, organizer cash/home/маршрут управления, несовпадение роли dashboard, stale organization и приостановленную группу. Для последней получен RED → GREEN: меню не монтируется при suspended.
- Интеграционный RED против собранного organizer main preview на `3143`: при active player fixture ожидание ссылки «Профиль» в нижней навигации завершилось timeout (в принятом organizer main её ещё нет). GREEN на объединённом дереве: mounted-тест проверил маршрут `/profile`, а настоящая player session открыла его в real-API матрице. Это доказывает именно сохранение player-навигации при merge, без изменения main preview.
- Браузерный `player-miniapp-network-retry.pwcode` выявил потерю конкретного 503 `statusMessage` при сохранённой кнопке повтора. Дефект добавлен в SDD 8.10.1; mounted-тест упал до исправления и прошёл после него. Повторный сценарий на собранном preview также прошёл.
- Пять gates объединённой ветки: `pnpm format:check`; `pnpm lint` — 0 ошибок/12 предупреждений; `pnpm typecheck` — 6/6; `pnpm test` — 121 файл/710 тестов на отдельной PostgreSQL `volleytime_qa_8101_post56`; `pnpm build` — web/bot 2/2. Первый typecheck после расширения fixture выявил узкий TypeScript-тип mock; повторный typecheck после правки прошёл.
- Production-preview `http://127.0.0.1:3142` работал с отдельной QA-БД `volleytime_qa_8101_selfcheck`, `/api/health` вернул `status=ok`, `db=ok`, `auth=ok`. Это не production health.

## Браузер и визуальный осмотр

- Edge CLI, готовая сборка: `player-miniapp-fidelity.pwcode` 41/41, `player-miniapp-group-race.pwcode` без stale-группы, `player-miniapp-network-retry.pwcode` после исправления, `player-miniapp-auth-merge.pwcode` шесть состояний доступа. Fixture-подмены API не выдаются за реальную серверную проверку.
- Штатный email OTP тестового игрока и настоящий QA API: `player-miniapp-real-screen-matrix.pwcode` прошёл 7 экранов × 320/390 CSS px × light/dark = 28 случаев без горизонтального переполнения, недостижимого контента, перекрытия dock или видимых целей меньше 44 px. Просмотрены снимки Home, detail, profile, светлая/тёмная темы; пример — `output/playwright/real-320-light--m-orgs-1.png` (локальный игнорируемый артефакт). Ранее проверенные денежные/двухаккаунтные сценарии задокументированы в [player self-check](2026-09-27-player-miniapp-selfcheck.md); они не были целиком повторены здесь.
- Штатный email OTP тестового owner и настоящий QA API: при 320 px Home показал реальные cash/pending/events и ссылки `/manage`; меню открылось с фокусом внутри, Tab остался внутри, Escape вернул фокус кнопке; список событий сохранил organizer rows. Осмотрен `output/playwright/post56-org-home-320.png`.
- Сообщения `ERR_FAILED` для Telegram SDK и Google Fonts в fixture-прогонах ожидаемы: скрипты преднамеренно блокируют эти внешние URL. Это не проверка настоящего Telegram WebView. Локальные шрифты игрока проверены fixture-скриптом.

Открыто: независимое whole-branch review, финальный CI PR #47, общая визуальная/функциональная приёмка 8.10.3 и native 200% Mini App; реальный Telegram/two-account QA — после контролируемой выкладки полного кандидата на пустой пилотный production. Никакого основания считать R0.6 принятым или выкладывать только 8.10.1 на `prod` этот отчёт не даёт.
