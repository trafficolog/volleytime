---
id: '3.11.9'
phase: '3'
epic: '3.11'
status: done
sync_state: synced
last_reviewed: 2026-09-29
status_note: 'Принята в main через PR #61, merge b4c9630: RED → GREEN, пять gates, Chrome matrix, независимые task/whole-branch review без новых замечаний и CI 36523981993 success на 67ef8c6. Дерево merge идентично проверенному head; prod/VPS не менялись.'
roles: [FE, QA]
depends_on: ['3.11.7', '3.11.3', '5.15.1', '6.10.1']
estimated_hours: '1-2'
tags: [fonts, visual-fidelity, review-fix, mvp]
---

# Task 3.11.9: Локальная шрифтовая пара на всех MVP-маршрутах

## Цель

Сохранить Oswald/Golos из утверждённых референсов на прямом входе в авторизацию и desktop, независимо от доступности внешнего Google Fonts.

## Контекст / доказательства

При общей Chrome QA built preview `3168` от main `060ecdf` запрос Google CSS заблокирован управляемой browser fixture. Прямые `/app/orgs/1` и `/auth/login` дают `document.fonts=[]`; computed font-family всё ещё содержит Oswald, но реально отрисован fallback. После снятия блокировки на desktop Google CSS приходит и обе семьи loaded: дефект зависит от доставки шрифта, а не от токенов или API.

В `nuxt.config.ts` внешняя stylesheet глобальна. `landing-fonts.css` с семью уже лицензированными файлами подключается только из landing и двух Mini App layouts. Auth и desktop её не получают. Первые 44 desktop geometry cases 8.10.3 проходят, но не являются подтверждением визуальной точности шрифтов; их надо повторить после исправления.

## Что должно быть сделано

1. Сначала browser RED на реальной собранной странице: прямые auth/desktop с заблокированными Google CSS/gstatic должны иметь loaded Oswald 700 и Golos Text 400/700 для кириллицы; нынешний runtime не проходит. Mini App и landing — контрольные рабочие пути.
2. Подключить существующую `landing-fonts.css` глобально средствами Nuxt, убрать прежние route/layout imports и внешнее font stylesheet/preconnect. Не менять бинарники, лицензии, веса, CSS-токены, дизайн, SDK Telegram и API. Существующие TTF сохраняются; оптимизация форматов — не scope исправления.
3. Устаревшее token-test ожидание Google URL привести к новому контракту; browser проверка фактического FontFaceSet — главный regression test, не одно source-string assertion.
4. Повторить прямые входы (без предварительного посещения landing), кириллицу, auth states, desktop 1280/1440 + 320/390/720 reflow, Mini App light/dark и landing; сохранить screenshots и результат загрузки. Пять gates, independent review, CI точного SHA перед task PR merge в main.

## Критерии приёмки

- RED падает на отсутствии реально загруженных шрифтов auth/desktop; GREEN проверяет loaded faces и успешный local font delivery при недоступном Google.
- Нет зависимости шрифтов от порядка посещения маршрутов, внешних font requests или синтетического начертания нужных весов.
- Шрифтовая пара, цвета, размеры, рабочие поля и MVP-ограничения не изменены; reflow и действия не регрессируют.
- Пять gates, scoped review и точный CI пройдены; доказательства и общий release scope синхронизированы.

## План / проверка

[Scoped implementation plan](../superpowers/plans/2026-09-28-global-local-reference-fonts.md). План утверждён пользователем 2026-09-29; исполнение subagent-driven. Диагностика не является GREEN и не даёт права объявить R0.6 готовым.

## Не делать

- Не вводить новые шрифты, зависимости, формат-конвертер, preload каждого веса или общую оптимизацию ресурсов.
- Не менять auth/session, Telegram SDK, серверные операции или настройки организации.
- Не публиковать частичный R0.6 на prod/VPS и не выдавать Chrome за реальный Telegram-host QA.

## Локальное исполнение 2026-09-29

[QA evidence](../operations/qa/2026-09-29-global-local-reference-fonts.md): реальный browser RED на отсутствии FontFaceSet auth/desktop, тот же GREEN 4/4 с семью local 200/loaded faces и кириллицей; owner 103/103 (48 Mini App light/dark + 55 desktop, включая 320), auth 15/15 на 320/390/720, landing 5/5 и scoped organizer controls. Пять gates: format pass, lint 0 errors / 12 baseline warnings, typecheck 6/6, PostgreSQL tests 124 files / 722 tests, build 2/2. Семь бинарников/лицензии, токены, auth/API/SDK неизменны.

Независимые task review и whole-branch review не нашли Critical/Important или новых Minor. Controller повторил browser regression 4/4 и PostgreSQL suite 124/722 на отдельной test DB (53,60 s) на `67ef8c6`. [CI 36523981993](https://github.com/trafficolog/volleytime/actions/runs/36523981993) прошёл все три job на точном head `67ef8c6beeb0e92d9761be009ebe97d00776dae8`. [PR #61](https://github.com/trafficolog/volleytime/pull/61) смёржен как `b4c9630f14d04782d916d00af3fe51f9166507fd`; полное дерево merge идентично проверенному head. Task `done`; общая 8.10.3 и post-deploy Telegram-host acceptance не закрываются, prod/VPS не менялись.
