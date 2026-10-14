---
id: '19.3.1'
phase: '19'
epic: '19.3'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'Сделано (PR #113 и follow-up по ревью Opus): матрица прав docs/architecture/permissions-v3.md; IDOR-тест на все роуты /api/organizations/{orgId}/** с положительным контролем минимальной роли и снимком группы, audit_log и users (новый роут без строки падает); согласован статус записи на событие: отсутствующее и чужое событие оба дают 404 event.not_found (раньше чужое — 422), экран игрока обновляется; настраиваемый срок жизни initData; Telegram Login Widget за флагом TELEGRAM_LOGIN_WIDGET_ENABLED (по умолчанию выключен, 404 на любой запрос до разбора тела и конфигурации); первый вход новой Telegram-личности устойчив к гонке; гард root requireRootAdmin для /api/platform. Визуальная сверка 6-auth перенесена в 20.5.1 решением владельца 2026-10-14.'
ref_id: 'P-11'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, SECURITY]
depends_on: ['19.2.1']
supersedes: []
decisions: ['D-05']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-11-auth-roles.md'
  screens: ['6-auth']
tags: [reference-v3]
---

# Task 19.3.1: Авторизация и роли v3 (`P-11`)

## Цель

Безопасный вход и проверка прав.

## Контекст

- Спецификация референса: [P-11 · Авторизация и роли](../design/reference-v3/specs/01-platform/P-11-auth-roles.md); макет: 6 Авторизация.
- **Как есть (main `e68acf2`):** better-auth: email OTP для веба, Telegram initData (валидация, 3.9.10), роли участника owner/organizer/assistant/player, `users.isRootAdmin`, tenant middleware, API security tests (4.9.15).
- **Дельта до референса:** Матрица прав для новых ресурсов v3 (серии, баланс, сборы, уведомления, root), IDOR-тесты на каждый новый эндпоинт, срок жизни initData, способ входа в веб по D-05.
- Решения владельца (2026-10-12): [D-05](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-05) — вход в веб — email-код и Telegram Login Widget; «код из бота» отложен.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-07 → 22.1.2](22-1-2-audit-log.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Проверка подписи Telegram initData, срок жизни
2. Вход в веб (D-05): email-код (как сейчас) и Telegram Login Widget; «код из бота» не делать
3. Роли: игрок, организатор, админ группы, root
4. Проверка доступа на каждом эндпоинте
5. Данные и API: Middleware авторизации; Матрица прав по ролям.
6. ~~Сверить экраны с референсом через харнесс 19.0.2~~ — перенесено в [20.5.1](20-5-1-auth.md) решением владельца 2026-10-14: карточка не меняет UI.

## Включение в production

- `TELEGRAM_LOGIN_WIDGET_ENABLED` остаётся выключенным: эндпоинт `POST /api/auth/sign-in/telegram-widget` отвечает 404, поведение production не меняется.
- Включение требует действий владельца и отслеживается отдельной follow-up задачей, в этой карточке не делается:
  1. BotFather `/setdomain` — привязать production-домен к боту, иначе виджет Telegram не отрисуется;
  2. прокинуть `TELEGRAM_LOGIN_WIDGET_ENABLED`, `TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS` и при необходимости `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` в `docker-compose.prod.yml` и deploy workflow (секреты/vars), затем выкатка через **Promote to production**;
  3. кнопка виджета на экране входа — UI-карточка [20.5.1](20-5-1-auth.md). Виджет подключается **только через JS-callback** (`data-onauth`), который отправляет данные `POST /api/auth/sign-in/telegram-widget`; `data-auth-url` (редирект с данными в query string) не использовать — подписанные данные попадут в URL, логи и историю браузера;
  4. по желанию в 20.5.1: отклонять повторно использованный `hash` виджета в пределах срока жизни (защита от повтора перехваченных данных) — заметка, не требование этой карточки.
- Неверное значение этих переменных в production останавливает старт web (fail closed), в лог попадает только имя переменной.

## Критерии приёмки

- ✅ Подделанный initData отклоняется
- ✅ Организатор не видит данные чужой группы (тесты на IDOR)
- ~~Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important~~ — перенесено в 20.5.1 решением владельца 2026-10-14
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR (конкурентность: параллельный первый вход Mini App + Login Widget новой Telegram-личности → один пользователь, оба входа успешны)

## Подсказки

- Скриншоты: [6-auth](../design/reference-v3/screenshots/6-auth) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-auth.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
