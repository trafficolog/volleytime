# Task 8.10.6 — ошибка загрузки приглашений Mini App

## Изменение и проверяемый результат

Ветка `trafficolog/fix/8.10.6-miniapp-invite-load-retry` от принятого `main=c946142`. SDD-карточка и ограниченный план утверждены до кода; specification commit `5227759`, implementation `e3b8031c17c90384d3857dc69d3beb0d286e652b`.

Production delta: самостоятельный error-paragraph заменён на существующий `ErrorState` внутри цепочки `loading → error → successful-empty → successful-list`, с `@retry="load"`. API, схема, auth, роли, создание, копирование, отправка и обработчик отзыва не изменены. Повтор перечитывает GET той же организации, а не повторяет мутацию.

Mounted Vue tests используют настоящие page / ErrorState / EmptyState / SkeletonList. RED: 4/4 expected failures — ложное «Активных ссылок нет» при 503 и отсутствие настоящей retry-кнопки. GREEN: 4/4, включая deferred loading → empty/nonempty и повторную ошибку. Typed InviteLink/member fixtures полные; точные HTTP assertions требуют тот же org GET без POST/options. Декоративные header/icon/chip и Nuxt/HTTP boundary контролируются fixture, не выдаются за backend acceptance.

## Gates и review

- Baseline PostgreSQL suite: 124 files / 722 tests, pass.
- После изменения: `pnpm format:check`, `pnpm lint` (0 errors / 12 прежних warnings), `pnpm typecheck` (6/6), `pnpm test` (125 files / 726 tests), `pnpm build` (2/2), `git diff --check` — pass. Сохраняются dependency build warnings DEP0155 / Zod annotation.
- Оба `DATABASE_URL` и `DATABASE_URL_TEST` указывают на отдельную `volleytime_qa_8101_post56`; browser DB `volleytime_qa_8101_selfcheck` не использовалась тестовым suite.
- Независимый task-review на `5227759..e3b8031`: spec compliance и task quality approved, без Critical/Important. Shared `loadError` для failed revoke отмечен отдельно; GET recovery не повторяет отзыв.
- Whole-branch review и exact-head CI / PR / main ещё ожидаются. Карточка пока `in_progress`.

## Chrome и реальные локальные GET

Предыдущий preview остановлен до build; новый built Nuxt запущен только после сборки на `http://127.0.0.1:3168`. Chrome CLI `fonts3119`, штатная owner-сессия из email OTP, свежие private contexts, только синтетическая browser DB. Cookies, OTP и credentials не сохраняются в отчёте.

`output/playwright/r06-error-retry.pwcode`: **45/45**, failures/pageerrors/mutations пусты. Это совместный read-only error/retry проход 8.10.3; к 8.10.6 относятся четыре `/m/orgs/1/invite` состояния 320/390 CSS px × light/dark. Управляемый GET503 не показывает empty/list; Enter на реальной кнопке повторяет запрос после снятия interception, настоящий локальный GET возвращает 200 и прежний empty корректно появляется после успеха. Кнопка **102,5625 × 44 CSS px**, document scrollWidth = clientWidth, все семь локальных Oswald/Golos faces loaded. PNG 320 light / 390 dark просмотрены: error с retry, без ложного empty, сохранены header/new-link/dock. Тёмная тема — явный `.dark`, не настоящий Telegram `themeChanged`.

Команда: `npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/r06-error-retry.pwcode`. Локальные ignored PNG: `r06-error-mini-invite-{320,390}-{light,dark}.png`; полный JSON — `r06-error-retry-report.json`. Предыдущий 41 pass / 4 RED остаётся историческим результатом до исправления, не текущим blocker.

Отдельный `8106-revoke-recovery.pwcode`: **4/4** 320/390 light/dark. Полный InviteLink GET-fixture сохраняет copy/share/revoke. Настоящий browser confirm: отмена не отправляет POST, подтверждение отправляет ровно один POST, который interception возвращает как 503 и не пропускает в API. Shared `loadError` скрывает старый список вместо ложного empty; retry Enter делает только GET и возвращает прежние три действия, не повторяет POST. Итого четыре полностью перехваченных POST, ноль server-side отзывов/созданий; это HTTP/UI fixture, не проверка настоящей доставки/отзыва. Reviewer minor-risk о reuse `loadError` проверен и принят как существующий desktop-паттерн восстановления.

## Локальный runtime smoke и границы

`pnpm smoke` на этом preview: health 200, точный `release=e3b8031c17c90384d3857dc69d3beb0d286e652b`, session 200, подписанный синтетический initData 200, authorized organizations 200, forged initData 401, cleanup удалил одну сессию локального smoke-user и отметил его inactive. Используется фиктивный локальный bot token, не настоящий Telegram. Webhook smoke пропущен: `WEBHOOK_SECRET_PATH` не задан.

Это не native 200%, экранный диктор, Telegram-host, VPS, production deploy, backup/restore, мониторинг или реальная группа. Ранее подтверждённые пользователем ручные пункты не запрашиваются повторно и не расширяются на новые экраны. Общая 8.10.3 / финальный R0.6 gate остаются отдельно открыты; `prod=67bbfe8` / v0.1.5 и VPS не менялись. Настоящий Telegram QA выполняется после controlled deploy полного кандидата в пустом пилоте.
