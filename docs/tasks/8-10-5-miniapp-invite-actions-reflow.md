---
id: '8.10.5'
phase: '8'
epic: '8.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'Согласованный фикс прошёл browser RED/GREEN (12 сочетаний), пять gates и scoped review. Ожидает PR/CI/merge в main; production не менялся.'
review_ref: '8.10.2 / 8.10.3 · post-main visual QA'
priority: P2
roles: [FE, QA]
depends_on: ['3.11.2']
estimated_hours: '1-2'
tags: [miniapp, invitations, reflow, review-fix]
---

# Task 8.10.5: Адаптивные действия приглашения Mini App

## Цель

Сохранить доступность копирования, отправки и отзыва приглашения на узком экране без горизонтальной прокрутки.

## Контекст

Пользователь утвердил 2026-09-28 перенос действий при недостатке места и цель отзыва 44×44 px без изменения цветов, подписей или бизнес-поведения. Ветка `trafficolog/fix/8.10.5-invite-actions-reflow` основана на `main` (`19d373c`); файл приглашений совпадает с просмотренной organizer-веткой.

GitHub task: [issue #52](https://github.com/trafficolog/volleytime/issues/52).

Edge production-preview `d3df334`, `/m/orgs/30/invite`, viewport 320 px: scrollbar оставляет 305 CSS px, `scrollWidth` равен 308. Кнопка «Отозвать ссылку» заканчивается на 307,64 px, ширина 34 px. Причина — непереносимая flex-строка двух текстовых кнопок и icon-only отзыва. Временный DOM-probe с одним `flex-wrap: wrap` вернул 305/305; после reload снова 308/305. Продуктовый код не изменён. Снимок: локальный `output/playwright/miniapp-r06-20260928/invite-320-light.png`.

## Что должно быть сделано

1. В отдельной fix-ветке разрешить адаптивный перенос действий, не скрывая их и не меняя тексты/цветовые токены.
2. Обеспечить отзыву touch-цель не меньше 44×44 CSS px.
3. Сохранить текущие clipboard/share/revoke API, права и подтверждение отзыва.
4. Сначала воспроизводимый browser RED геометрии, затем минимальное CSS-исправление и GREEN.

## Критерии приёмки

- На 320/390 px и при доступной ширине документа 160 CSS px, light/dark, нет overflow; все кнопки внутри контейнера/viewport.
- Проверены «Копировать» и «Скопировано», клавиатура, доступное имя отзыва и цель 44×44 px.
- На обычных 320/390 CSS px текстовые подписи не дробятся на строки; в узком 160 px reflow действия переносятся отдельными кнопками, а не сжимаются в колонки по нескольку букв.
- Regression test использует реальный Vue DOM; внешняя отправка и destructive POST ради геометрии не выполняются.
- Пять gates проходят с локальной PostgreSQL; scoped review не содержит блокирующих замечаний.
- Результат включён в 8.10.3; локальные тесты не выданы за Telegram-host/production acceptance.

## Подсказки

- Поверхность: `apps/web/app/pages/m/orgs/[orgId]/invite.vue`, строка действий активной ссылки.
- Не скрывать overflow всей страницы: это замаскирует недоступную кнопку.

## Свидетельства проверки 2026-09-28

- RED исходного кода: все 12 сочетаний выявили ширину отзыва 34 px; на узких размерах также overflow. Первая правка `flex-1` убрала overflow, но оставила текстовые кнопки шириной 50,25 px на client width 160 и высотой до 119 px. Уточнённый тест читаемости дал второй RED: 8 сочетаний 320/160 не прошли.
- GREEN: `flex-wrap` и `flex: 1 1 128px` переносят целые действия; отзыв имеет минимум 44 px ширины и унаследованную высоту 44 px. `scripts/qa/miniapp-invite-actions-reflow.pwcode` прошёл **12/12** на production build локального `3144`: client width 320/390/160 × light/dark × «Копировать»/«Скопировано»; `scrollWidth === clientWidth`, кнопки внутри карточки/viewport. На 320/390 текстовые кнопки имеют высоту 44 px, на 160 — ширину 107,5 и высоту 49 px, отзыв во всех случаях 44×44.
- Клавиатура: Enter вызывает реальный обработчик копирования; Tab переходит copy → share → revoke. Только clipboard write заглушён, чтобы не менять пользовательский буфер; внешние share/revoke не активируются. Это не проверка доставки clipboard/Telegram или destructive API.
- Пять gates на итоговом CSS: format — pass; lint — 0 errors / 21 baseline warnings; typecheck — 6/6; PostgreSQL tests — **103 files / 571 tests**; build — **2/2**, web пересобран, bot cached. Тестовая БД `volleytime_qa_8105_tests_20260928` отделена от browser fixtures `volleytime_qa_task1_20260926`.
- Независимое scoped review итогового diff относительно `19d373c`: Critical/Important нет; подписи, токены, права, обработчики и подтверждение отзыва сохранены. Минорное ограничение: тест измеряет прямоугольники кнопок, не Range текста/SVG. Финальные PNG 320/160 light/dark просмотрены отдельно: подписи и иконки действий читаемы. Нижняя навигация при client width 160 остаётся за рамками этого локального фикса; узкий resize не подтверждает native 200% zoom всего приложения.
- Артефакты в organizer worktree: `output/playwright/miniapp-r06-20260928/invite-fixed-{320,160}-{light,dark}.png`. Результат перенесён в 8.10.3. Реальный Telegram-host, production, backup/restore и полный R0.6 acceptance не утверждаются.

Повтор browser-проверки: открыть локальный `/m/orgs/<id>/invite` с действующей QA-сессией и активной ссылкой, затем выполнить `playwright-cli -s=<session> run-code --filename=scripts/qa/miniapp-invite-actions-reflow.pwcode`. Script допускает только localhost/127.0.0.1 с портом, использует реальный Vue/API и требует fixture с активной ссылкой; CI unit/integration suite не запускает браузер автоматически.

## Не делать

- Не отправлять сообщение в настоящий Telegram-чат, не отзывать реальные ссылки, не менять бренд или бизнес-правила.
