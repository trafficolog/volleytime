---
id: '3.11.8'
phase: '3'
epic: '3.11'
status: todo
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'Minor final-review observation reproduced in Chrome: session API 503 logs a FetchError through the mounted hook; anonymous CTA remains usable. Separate R0.6 resilience task before final release gate.'
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

Воспроизведение сохранено в `scripts/qa/landing-session-error.pwcode`; browser `pageerror` недостаточен для проверки, следует читать console error или Vue errorHandler.

## Не делать

- Не менять auth API, cookie, OTP, права или политику безопасности.
- Не добавлять retries, глобальное подавление ошибок, новый UI, метрики или зависимости ради этого fallback.
- Не считать локальный fixture подтверждением production/Telegram QA.
