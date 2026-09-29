# Task 8.10.6 — ошибка загрузки приглашений Mini App

## Изменение и проверяемый результат

Ветка `trafficolog/fix/8.10.6-miniapp-invite-load-retry` от принятого `main=c946142`. SDD-карточка и ограниченный план утверждены до кода; specification commit `5227759`, первоначальный implementation `e3b8031`, уточнение критерия после review `60dc3f2` до correction `40759fc6cbfe491baa1d0beba88c74c1fa19d20a`.

Production delta: самостоятельный error-paragraph заменён на существующий `ErrorState` внутри цепочки `loading → error → successful-empty → successful-list`, с `@retry="load"`. Whole-branch review выявил, что отказ `POST revoke` тоже записывался в `loadError` и скрывал уже загруженный список. Локальная коррекция разделяет `revokeError` и `loadError`: ошибка отзыва показывается отдельным `role="alert"` над прежней ссылкой и действиями без GET retry, успешный/повторный `load()` её очищает. API, схема, auth, роли, создание, копирование, отправка, подтверждение и сам POST не менялись.

Mounted Vue tests используют настоящие page / ErrorState / EmptyState / SkeletonList. Первоначальный RED: 4/4 expected failures — ложное «Активных ссылок нет» при 503 и отсутствие настоящей retry-кнопки; GREEN: 4/4. Review-fix RED: 1 failed / 4 passed — после failed revoke POST отсутствует `ul li`, показан GET `ErrorState` с «Повторить». GREEN: 5/5; ссылка, copy/share/revoke и отдельный alert остаются, GET retry отсутствует. Typed InviteLink/member fixtures полные; точные HTTP assertions требуют GET той же организации и ровно один перехваченный POST только в revoke-сценарии. Декоративные header/icon/chip и Nuxt/HTTP boundary контролируются fixture, не выдаются за backend acceptance.

## Gates и review

- Baseline PostgreSQL suite: 124 files / 722 tests, pass.
- Первоначальный GET fix: `pnpm format:check`, `pnpm lint` (0 errors / 12 прежних warnings), `pnpm typecheck` (6/6), `pnpm test` (125 files / 726 tests), `pnpm build` (2/2), `git diff --check` — pass. Сохраняются dependency build warnings DEP0155 / Zod annotation.
- После review-fix: format pass, lint 0 errors / 12 прежних warnings, typecheck 6/6, полный PostgreSQL suite 125 files / 727 tests pass, build 2/2 pass (1m25.786s).
- Оба `DATABASE_URL` и `DATABASE_URL_TEST` указывают на отдельную `volleytime_qa_8101_post56`; browser DB `volleytime_qa_8101_selfcheck` не использовалась тестовым suite.
- Независимый task-review на `5227759..e3b8031`: spec compliance и task quality approved, без Critical/Important. Последующее whole-branch review квалифицировало shared `loadError` для failed revoke как Important regression; focused independent re-review на `40759fc` подтвердило исправление без новых Critical/Important. Minor о неподтверждённом successful empty после реального GET закрыт новым browser assertion и PNG после повтора.
- Exact-head CI / PR / main ещё ожидаются. Карточка пока `in_progress`.

## Chrome и реальные локальные GET

Предыдущий preview остановлен до build; новый built Nuxt запущен только после сборки на `http://127.0.0.1:3168`. Chrome CLI `fonts3119`, штатная owner-сессия из email OTP, свежие private contexts, только синтетическая browser DB. Cookies, OTP и credentials не сохраняются в отчёте.

`output/playwright/r06-error-retry.pwcode` повторён на `40759fc`: **45/45**, failures/pageerrors/mutations пусты. Это совместный read-only error/retry проход 8.10.3; к 8.10.6 относятся четыре `/m/orgs/1/invite` состояния 320/390 CSS px × light/dark. Управляемый GET503 не показывает empty/list; Enter на реальной кнопке повторяет запрос после снятия interception, настоящий локальный GET возвращает 200. Новый browser assertion после ответа проверил видимый успешный empty; `r06-recovered-mini-invite-320-light.png` просмотрен. Кнопка **102,5625 × 44 CSS px**, document scrollWidth = clientWidth, все семь локальных Oswald/Golos faces loaded. Error PNG 320 light / 390 dark просмотрены: error с retry, без ложного empty, сохранены header/new-link/dock. Тёмная тема — явный `.dark`, не настоящий Telegram `themeChanged`.

Команда: `npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/r06-error-retry.pwcode`. Локальные ignored PNG: `r06-error-mini-invite-{320,390}-{light,dark}.png`; полный JSON — `r06-error-retry-report.json`. Предыдущий 41 pass / 4 RED остаётся историческим результатом до исправления, не текущим blocker.

Первый `8106-revoke-recovery.pwcode` на `e3b8031` принимал скрытие списка и GET retry после failed POST, что review обоснованно признало регрессией; это историческое доказательство ошибки, не приёмка. Исправленный script повторён на `40759fc`: **4/4** 320/390 light/dark, failures=[], browser pageerrors=[] и нет overflow. Отмена confirm отправляет 0 POST; подтверждение — ровно один полностью перехваченный 503 POST; после отказа видны ссылка и copy/share/revoke, отдельный alert и нет GET retry. Reload делает только GET, не повторяя POST, и очищает ошибку. Все четыре POST перехвачены до сервера; реальные ссылки не отзывались и не создавались. Error PNG `8106-revoke-error-320-light.png` / `390-dark.png` просмотрены, прежние действия видимы без горизонтального обрезания.

## Локальный runtime smoke и границы

`pnpm smoke` повторён на preview `40759fc6cbfe491baa1d0beba88c74c1fa19d20a`: health 200, точный release SHA, session 200, подписанный синтетический initData 200, authorized organizations 200, forged initData 401, cleanup удалил одну локальную smoke-сессию и отметил синтетического user inactive. Используется фиктивный локальный bot token, не настоящий Telegram. Webhook smoke пропущен: `WEBHOOK_SECRET_PATH` не задан.

Это не native 200%, экранный диктор, Telegram-host, VPS, production deploy, backup/restore, мониторинг или реальная группа. Ранее подтверждённые пользователем ручные пункты не запрашиваются повторно и не расширяются на новые экраны. Общая 8.10.3 / финальный R0.6 gate остаются отдельно открыты; `prod=67bbfe8` / v0.1.5 и VPS не менялись. Настоящий Telegram QA выполняется после controlled deploy полного кандидата в пустом пилоте.
