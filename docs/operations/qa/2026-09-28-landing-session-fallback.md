# Landing 3.11.8 — fallback ошибки сессии

## Проверенное изменение

Task-ветка `trafficolog/fix/3.11.8-landing-session-fallback` от main `c2556be53281fe94b252bde3b2ddb1d278e8d043`. Публичный лендинг подтверждает сессию только после успешного GET. При отказе сохраняется login redirect; прежний клиентский user не считается подтверждённым. Общий useAuth, API, cookie, OTP, права и внешний вид не менялись.

SDD-карточка существовала до кода; mounted RED на реальном page/useAuth: 2/5 ожидаемых отказа (Vue error handler и неверный authenticated CTA со старым user), 3 контроля pass. После минимального исправления 5/5 pass; вместе с canonical auth и landing utilities — 3 files / 13 tests. Test-only alias `/logo.png` разрешает настоящий public asset вне Nuxt; первоначальная ошибка разрешения harness не засчитывается как продуктовый RED.

## Итоговые gates

- `pnpm format:check`: pass.
- `pnpm lint`: 0 errors / 12 baseline warnings вне новой landing-проверки.
- `pnpm typecheck`: 6/6 pass.
- `pnpm test`: 124 files / 722 tests pass; DATABASE_URL и DATABASE_URL_TEST — отдельная PostgreSQL `volleytime_qa_8101_post56`.
- `pnpm build`: 2/2 pass, web собран заново.
- Независимое read-only review: Critical/Important/Minor нет; reviewer повторил 2 files / 10 landing/auth tests и diff check.

## Chrome

Отдельный CLI profile `landing318`, свежий built preview `http://127.0.0.1:3168/`, fixture DB `volleytime_qa_8101_selfcheck` отдельно от integration suite.

`npx --yes --package @playwright/cli playwright-cli -s=landing318 run-code --filename scripts/qa/landing-session-error.pwcode`:

- 503 fixture использована двумя GET; HTTP errors в network ожидаемы.
- `errors=[]`, `appErrors=[]`: нет pageerror или application FetchError/Unhandled/Uncaught в console.
- CTA `/auth/login?redirect=%2Fm%2Forgs%2Fcreate` сохранён.
- FAQ Enter и реальный client-side переход к login с этим redirect прошли.

Регрессия `scripts/qa/landing-post-main.pwcode` прошла 320/390/768/1280/1440 CSS px, anonymous/authenticated fixture CTA, MVP-ссылки, якоря, FAQ, загруженные Oswald/Golos Text, reduced-motion/resume/teardown и no-JS SSR/FAQ. Просмотрены полные PNG `output/playwright/landing43-post-main-{320,1440}.png`.

Preview, запущенный во время build, один раз вернул missing-module 500 из перезаписываемого output; он остановлен и не учитывается. Вся указанная Chrome QA выполнена после завершения сборки и нового запуска сервера.

## Границы

[CI 36476869854](https://github.com/trafficolog/volleytime/actions/runs/36476869854) прошёл все три job на точном head `3595b7fc6c44a833c18e2cd6f78313fee3116c89`. [PR #59](https://github.com/trafficolog/volleytime/pull/59) принят в main как `07fb8af280263eccba4d9da12e714cc3f3416f69`; полное дерево merge идентично head (`fd2cae636e1d55253c2e7d2061d5ab67222e95c4`). Task 3.11.8 done.

Общая 8.10.3, prod/VPS, backup/deploy и настоящий Telegram-host/two-account QA не закрыты. Пользовательские native 200% и фоновая вкладка stop/resume уже записаны в отчёте 3.11.4 и не запрашиваются повторно. Ограничение исходного оранжевого по контрасту не объявляется исправленным.
