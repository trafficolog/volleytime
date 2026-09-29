# Task 8.10.6 — ошибка загрузки приглашений Mini App

## Изменение и проверяемый результат

Ветка `trafficolog/fix/8.10.6-miniapp-invite-load-retry` от принятого `main=c946142`. SDD-карточка и ограниченный план утверждены до кода; specification commit `5227759`, implementation `e3b8031c17c90384d3857dc69d3beb0d286e652b`.

Production delta: самостоятельный error-paragraph заменён на существующий `ErrorState` внутри цепочки `loading → error → successful-empty → successful-list`, с `@retry="load"`. Whole-branch review выявил, что отказ `POST revoke` тоже записывался в `loadError` и скрывал уже загруженный список. Локальная коррекция разделяет `revokeError` и `loadError`: ошибка отзыва показывается отдельным `role="alert"` над прежней ссылкой и действиями без GET retry, успешный/повторный `load()` её очищает. API, схема, auth, роли, создание, копирование, отправка, подтверждение и сам POST не менялись.

Mounted Vue tests используют настоящие page / ErrorState / EmptyState / SkeletonList. Первоначальный RED: 4/4 expected failures — ложное «Активных ссылок нет» при 503 и отсутствие настоящей retry-кнопки; GREEN: 4/4. Review-fix RED: 1 failed / 4 passed — после failed revoke POST отсутствует `ul li`, показан GET `ErrorState` с «Повторить». GREEN: 5/5; ссылка, copy/share/revoke и отдельный alert остаются, GET retry отсутствует. Typed InviteLink/member fixtures полные; точные HTTP assertions требуют GET той же организации и ровно один перехваченный POST только в revoke-сценарии. Декоративные header/icon/chip и Nuxt/HTTP boundary контролируются fixture, не выдаются за backend acceptance.

## Gates и review

- Baseline PostgreSQL suite: 124 files / 722 tests, pass.
- Первоначальный GET fix: `pnpm format:check`, `pnpm lint` (0 errors / 12 прежних warnings), `pnpm typecheck` (6/6), `pnpm test` (125 files / 726 tests), `pnpm build` (2/2), `git diff --check` — pass. Сохраняются dependency build warnings DEP0155 / Zod annotation.
- После review-fix: format pass, lint 0 errors / 12 прежних warnings, typecheck 6/6, полный PostgreSQL suite 125 files / 727 tests pass, build 2/2 pass (1m25.786s). Browser на исправленном HEAD пока ожидается.
- Оба `DATABASE_URL` и `DATABASE_URL_TEST` указывают на отдельную `volleytime_qa_8101_post56`; browser DB `volleytime_qa_8101_selfcheck` не использовалась тестовым suite.
- Независимый task-review на `5227759..e3b8031`: spec compliance и task quality approved, без Critical/Important. Последующее whole-branch review квалифицировало shared `loadError` для failed revoke как Important regression; исправление требует независимого re-review.
- Exact-head CI / PR / main ещё ожидаются. Карточка пока `in_progress`.

## Chrome и реальные локальные GET

Предыдущий preview остановлен до build; новый built Nuxt запущен только после сборки на `http://127.0.0.1:3168`. Chrome CLI `fonts3119`, штатная owner-сессия из email OTP, свежие private contexts, только синтетическая browser DB. Cookies, OTP и credentials не сохраняются в отчёте.

`output/playwright/r06-error-retry.pwcode`: **45/45**, failures/pageerrors/mutations пусты. Это совместный read-only error/retry проход 8.10.3; к 8.10.6 относятся четыре `/m/orgs/1/invite` состояния 320/390 CSS px × light/dark. Управляемый GET503 не показывает empty/list; Enter на реальной кнопке повторяет запрос после снятия interception, настоящий локальный GET возвращает 200 и прежний empty корректно появляется после успеха. Кнопка **102,5625 × 44 CSS px**, document scrollWidth = clientWidth, все семь локальных Oswald/Golos faces loaded. PNG 320 light / 390 dark просмотрены: error с retry, без ложного empty, сохранены header/new-link/dock. Тёмная тема — явный `.dark`, не настоящий Telegram `themeChanged`.

Команда: `npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/r06-error-retry.pwcode`. Локальные ignored PNG: `r06-error-mini-invite-{320,390}-{light,dark}.png`; полный JSON — `r06-error-retry-report.json`. Предыдущий 41 pass / 4 RED остаётся историческим результатом до исправления, не текущим blocker.

Исторический `8106-revoke-recovery.pwcode` на `e3b8031`: **4/4** 320/390 light/dark подтвердил, что браузерное подтверждение при отмене не отправляет POST, а подтверждение отправляет ровно один полностью перехваченный POST; server-side отзывов/созданий не было. Но fixture принимал скрытие списка и GET retry после failed POST, что whole-branch review затем признало регрессией. Mounted RED→GREEN теперь требует видимые copy/share/revoke, отдельный alert и отсутствие GET retry. Повторный browser на исправленном HEAD ещё не выполнен; исторические 4/4 не считаются приёмкой нового состояния.

## Локальный runtime smoke и границы

Исторический `pnpm smoke` на preview `e3b8031`: health 200, точный `release=e3b8031c17c90384d3857dc69d3beb0d286e652b`, session 200, подписанный синтетический initData 200, authorized organizations 200, forged initData 401, cleanup удалил одну сессию локального smoke-user и отметил его inactive. Это не smoke исправленного HEAD. Используется фиктивный локальный bot token, не настоящий Telegram. Webhook smoke пропущен: `WEBHOOK_SECRET_PATH` не задан.

Это не native 200%, экранный диктор, Telegram-host, VPS, production deploy, backup/restore, мониторинг или реальная группа. Ранее подтверждённые пользователем ручные пункты не запрашиваются повторно и не расширяются на новые экраны. Общая 8.10.3 / финальный R0.6 gate остаются отдельно открыты; `prod=67bbfe8` / v0.1.5 и VPS не менялись. Настоящий Telegram QA выполняется после controlled deploy полного кандидата в пустом пилоте.
