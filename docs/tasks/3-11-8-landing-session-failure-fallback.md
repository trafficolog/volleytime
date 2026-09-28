---
id: '3.11.8'
phase: '3'
epic: '3.11'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'Локальный RED→GREEN, пять gates (124 files / 722 tests), Chrome 503/CTA/FAQ и regression smoke прошли; независимое review без замечаний. До exact-head CI и merge отдельного PR задача in_progress; prod/VPS не меняются.'
roles: [FE, QA]
depends_on: ['3.11.4']
estimated_hours: '1-2'
priority: P2
review_ref: '3.11.4-final-integration-minor-session-failure'
tags: [landing, review-fix, resilience]
---

# Task 3.11.8: Управляемый fallback лендинга при ошибке сессии

## Цель

При недоступности API сессии публичный лендинг остаётся работоспособным без необработанного отказа async mounted-hook. Не менять дизайн или серверную авторизацию.

## Контекст / доказательство

Финальное review интегрированной 3.11.4 обнаружило в `apps/web/app/pages/index.vue` вызов `await fetchSession()` в `try/finally` без обработки ошибки. Chrome на локальной сборке `http://127.0.0.1:3142/` при ответе 503 из `/api/auth/get-session` сохранил CTA `/auth/login?redirect=%2Fm%2Forgs%2Fcreate`, но консоль получила `FetchError` из mounted-hook. Событий `pageerror` не было: Vue перехватил исключение и записал ошибку. Это не падение страницы и не блокер интеграции лендинга в main, но отдельная обязательная resilience-проверка перед итоговым R0.6 gate.

## Что должно быть сделано

1. В отдельной task-ветке добавить детерминированный mounted RED-тест: отказ fetchSession не уходит в Vue error handler, неизвестная сессия использует anonymous CTA и не отправляет данные в сторонние сервисы.
2. Минимально обработать ошибку в публичном лендинге; не подавлять ошибки глобально в useAuth и не считать старую локальную сессию подтверждённой при отказе API.
3. Проверить успешную сессию и anonymous/null ответ, рабочие ссылки/FAQ после ошибки, пять gates и scoped review.

## Критерии приёмки

- RED → GREEN mounted-тест подтверждает отсутствие необработанного hook rejection и корректный anonymous fallback на отказе API.
- Успешная сессия сохраняет прямой CTA создания группы, неизвестная/ошибочная — явный login redirect.
- Chrome fixture 503 не показывает application FetchError из mounted-hook; сам HTTP 503 в browser network допустим.
- Пять gates, независимое review и CI точного head пройдены; задача проводится отдельным PR.

## Подсказки

### План проверки 2026-09-28

Причина: `useAuth.fetchSession()` намеренно сохраняет прежнего пользователя и пробрасывает transient-ошибку; лендинг в `finally` ошибочно помечает сессию известной при любом результате. Не менять общий composable. В mounted-тесте использовать настоящий useAuth и подменить только внешний `$fetch`: проверить отказ с пустым/сохранённым user, pending-состояние, успешный user и подтверждённый null. Минимальный фикс оставляет локальный флаг неизвестной сессии на ошибке и выставляет его только после успешного GET. Затем полный PostgreSQL suite, остальные четыре gates, Chrome fixture 503/переход/FAQ и независимое scoped review; отдельный PR/CI/main без изменения prod.

Воспроизведение сохранено в `scripts/qa/landing-session-error.pwcode`; browser `pageerror` недостаточен для проверки, следует читать console error или Vue errorHandler.

Первый запуск mounted harness остановился до тестов: Vite вне Nuxt не разрешает абсолютный public URL `/logo.png`. Test-only alias на реальный public asset допустим для запуска настоящего компонента; runtime-код/изображение не меняются. Это ошибка harness, не RED по продукту.

Mounted RED: 2/5 тестов упали по ожидаемым причинам — `errors` содержит `Error: session unavailable`, а CTA при сохранённом user после отказа API стал `/m/orgs/create` вместо login redirect. Три контрольных pending/success/null сценария прошли. Код лендинга до этого результата не менялся.

### Локальная приёмка 2026-09-28

Минимальный фикс выставляет `sessionKnown` только после успешного GET и оставляет false при отказе. Общий `useAuth`, его сохранение прежнего user на transient failure, auth API и дизайн не менялись. Mounted landing + canonical auth + landing utilities: 3 files / 13 tests pass; независимый reviewer повторил landing/auth 2 files / 10 tests и `git diff --check`, замечаний Critical/Important/Minor нет.

Итоговые пять gates: format pass, lint 0 errors / 12 baseline warnings вне нового теста, typecheck 6/6, PostgreSQL suite 124 files / 722 tests pass, build 2/2. Оба DB URL тестов указывают на отдельную `volleytime_qa_8101_post56`, не на browser fixture DB.

Свежий built preview `http://127.0.0.1:3168/`, Chrome CLI profile `landing318`: `scripts/qa/landing-session-error.pwcode` подтвердил 503 fixture (2 GET), `errors=[]`, `appErrors=[]`, anonymous href, FAQ Enter и переход к login с redirect создания группы. HTTP network 503 ожидаем. Первый preview-запуск во время перезаписи build output получил технический missing-module 500 и не засчитывается: сервер перезапущен после успешного build, затем QA повторена.

`scripts/qa/landing-post-main.pwcode` повторно прошёл 320/390/768/1280/1440 CSS px, session success/null CTA, якорь/FAQ, локальные шрифты, reduced motion/resume/teardown, no-JS SSR/FAQ. Снимки 320/1440 просмотрены. Ранее подтверждённые пользователем native 200% и настоящее background stop/resume не запрашивались заново. Это локальный Chrome QA, не Telegram-host или production delivery. Детали: [отчёт 3.11.8](../operations/qa/2026-09-28-landing-session-fallback.md).

## Не делать

- Не менять auth API, cookie, OTP, права или политику безопасности.
- Не добавлять retries, глобальное подавление ошибок, новый UI, метрики или зависимости ради этого fallback.
- Не считать локальный fixture подтверждением production/Telegram QA.
