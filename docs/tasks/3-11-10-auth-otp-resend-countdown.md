---
id: '3.11.10'
phase: '3'
epic: '3.11'
status: done
sync_state: synced
last_reviewed: 2026-09-29
status_note: 'Принята PR #66 в main=99cae3a; RED 4 fail → GREEN 14/14, пять gates (125 файлов/731 тест), native Chrome 200% 1:00→0:59, local health/session smoke, независимый re-review, CI exact-head и main прошли; merge tree равен head. Production не менялся.'
review_ref: '8.10.3 · Chrome 200% auth code state'
priority: P2
roles: [FE, QA]
depends_on: ['3.11.3']
estimated_hours: '1-2'
tags: [auth, otp, ui, review-fix]
---

# Task 3.11.10: Корректный формат таймера повторной отправки OTP

## Цель

Убрать невозможное время `0:60` на экране ввода email-кода без изменения отправки, срока действия кода или политики повторного запроса.

## Контекст

В локальном Chrome при штатном page zoom 200% после успешного запроса тестового OTP экран `/auth/login` сразу показывает «Повтор через 0:60». Причина в `resendLabel`: текущие 60 секунд форматируются постоянным префиксом `0:`. На следующем тике `0:59` уже допустимо. Это найдено в сквозном QA R0.6 / 8.10.3 на отдельной QA-ветке; отчёт с остальными экранами войдёт в её собственный PR. Сервер и production не затронуты.

## Что должно быть сделано

1. Написать RED-тест для значения 60 секунд, а также пограничных 59, 1 и 0.
2. Выводить оставшееся время как минуты:две цифры секунд (`1:00`, `0:59`, `0:01`, `0:00`). Оставить текущее фактическое ожидание 60 секунд и существующий UX после нуля.
3. Повторить локальный визуальный проход состояния ввода кода при native Chrome zoom 200%, не выводя OTP в документацию.

## Критерии приёмки

- RED на `60 → 1:00`, GREEN на всех границах; UI пользуется проверенным форматтером.
- При настоящем локальном запросе QA-кода сразу отображается «Повтор через 1:00», затем `0:59`; resend не включается раньше установленного интервала.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` и независимый review проходят; GitHub PR/CI принимают точный head до закрытия задачи.

## Подсказки

В `apps/web/app/pages/auth/login.vue` старт `resendIn = 60` уже корректен. Исправление ограничено форматированием подписи; существующие тесты `apps/web/app/utils/auth-flow.test.ts` подходят для чистой функции без таймеров в unit-тесте.

### Проверка 2026-09-29

- [PR #66](https://github.com/trafficolog/volleytime/pull/66) закрывает issue #65, head `14a90cde7db4c7ecd5a99355f0622349a0b6d2c2`, merge `99cae3abceeb27705adde46f45143597fa6fd1b2`. [CI head 36542875997](https://github.com/trafficolog/volleytime/actions/runs/36542875997) и [CI main 36543085212](https://github.com/trafficolog/volleytime/actions/runs/36543085212) завершились success во всех трёх jobs. Полное дерево head/merge одинаково: `6bd2c630a67a2ebee7fd2b9a359353d6d7502eb1`. Общий R0.6 gate и Telegram QA не закрываются этой отдельной задачей.

- После SDD commit `5f76fc2` четыре RED-кейса (`60`, `59`, `1`, `0`) упали из-за отсутствующего форматтера. Минимальная реализация дала 14/14 в `auth-flow.test.ts`; стартовое значение, интервал, запросы OTP и сервер не менялись.
- Все пять gates на ветке: `format:check` success; `lint` 0 errors/12 существовавших warnings; `typecheck` 6/6; `test` 125 файлов/731 тест; `build` 2/2. Независимый scoped review и focused re-review не нашли Critical/Important; исправлена замеченная в карточке ссылка на ещё не смёрженный QA-отчёт.
- Built preview `http://127.0.0.1:3167/` на отдельной локальной QA-БД: настоящий тестовый запрос OTP, штатный Chrome page zoom **200%** (`zoomLevel=2`, `devicePixelRatio=2`, CSS viewport 712×402), сразу «Повтор через 1:00», затем `0:59`, ширина документа 704 ≤ 712. Просмотрен низ экрана с resend; код не сохранялся в отчёте. `pnpm smoke` прошёл health и auth/get-session; Telegram/webhook намеренно не проверялись этим task smoke.

## Не делать

- Не менять длину паузы, TTL OTP, API/Better Auth или содержание писем.
- Не выводить реальные коды и session cookies в отчёты.
- Не объявлять локальный Chrome проверкой Telegram WebView или production.
