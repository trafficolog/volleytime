---
id: '8.10.6'
phase: '8'
epic: '8.10'
status: done
sync_state: synced
last_reviewed: 2026-09-29
status_note: 'GET retry и failed-revoke review-fix прошли mounted RED→GREEN, пять gates (125 files/727 tests), Chrome 45/45 error/retry и 4/4 failed-revoke 320/390 light/dark, local smoke и независимый re-review без блокеров. PR #64 принят в main как c473de1: exact-head CI 36538108493 и main CI 36538310519 успешны, merge tree совпадает с head. Общий 8.10.3 и Telegram-host отдельно открыты; prod/VPS не менялись.'
review_ref: '8.10.3 / 2026-09-29 error-state QA'
priority: P2
roles: [FE, QA]
depends_on: ['8.10.2', '8.10.5']
estimated_hours: '1-2'
tags: [miniapp, invitations, resilience, review-fix]
---

# Task 8.10.6: Ошибка загрузки приглашений Mini App и повтор

## Цель

Отличать недоступный список приглашений от действительно пустого и дать организатору восстановить список без перезагрузки страницы или создания новой ссылки.

## Контекст

Пользователь 2026-09-29 подтвердил: Vue RED на 503/ложный empty → существующий `ErrorState` с GET-повтором → Chrome 320/390 light/dark → пять gates → отдельное review/PR. Это bounded изменение действующего экрана; дизайн, права и операции ссылок сохраняются.

В рамках 8.10.3 на `http://127.0.0.1:3168/m/orgs/1/invite` воспроизведён GET `/api/organizations/1/invites` → 503. Штатная owner-сессия получена через email OTP, используется отдельная синтетическая QA-БД. На 320/390 CSS px × light/dark во всех четырёх случаях видны alert «Временная QA-ошибка сервера» и «Активных ссылок нет», кнопка повтора отсутствует. POST не выполнялись.

Причина: `loadError` отображается отдельным `<p>`, а следующая ветка `loading → activeInvites.length === 0 → list` не учитывает ошибку. В desktop-версии используется отдельный `ErrorState` с `@retry="load"`. Это дефект клиентского отображения/восстановления, не утверждение об отказе production API.

## Что должно быть сделано

1. После согласования создать отдельную fix-ветку от принятого main. Не смешивать исправление с QA-веткой 8.10.3. Ветка `trafficolog/fix/8.10.6-miniapp-invite-load-retry` создана от `origin/main=c946142`; checkpoint 8.10.3 сохранён отдельно как `ab24ad9`.
2. Сначала mounted Vue RED: rejected GET показывает ошибку, не показывает empty/list и имеет рабочий retry.
3. Минимально разделить loading / error / loaded-empty / loaded-list существующим `ErrorState`, повтор использует `load()` и только GET.
4. Проверить error → retry/loading → success с пустым и непустым ответами, а также повторный отказ. Настоящий empty допустим только после успешного ответа.
5. Сохранить права, роли, clipboard/share/revoke/create, подтверждение отзыва, тексты и дизайн-токены остальных состояний.
6. Замечание финального review: отказ `POST revoke` не должен превращать ранее успешно загруженный список в ошибку `GET` и скрывать существующие copy/share/revoke. Разделить ошибку мутации и ошибку загрузки, сохранив ссылку и действия; повтор `GET` остаётся только для отказа чтения. Сначала добавить mounted RED на этот случай, затем минимальный GREEN.

## Критерии приёмки

- При GET 503 error, skeleton и empty/list взаимоисключаются; кнопка «Повторить» доступна.
- Retry делает GET той же организации; загрузка видна до ответа, ошибка очищается после успеха и возвращается при повторном отказе.
- Успешный `{ invites: [] }` показывает прежний empty; успешный непустой ответ показывает прежние действия ссылки.
- Vue regression tests RED → GREEN, Chrome 320/390 light/dark без overflow; повтор через клавиатуру и цель ≥44×44 CSS px.
- Browser recovery от управляемого 503 к настоящему локальному GET 200 отмечен отдельно от fixture-тестов и Telegram-host QA.
- После отказа отзыва уже загруженная ссылка и её действия видимы, ошибка отзыва озвучивается отдельно; новая кнопка GET-повтора не подменяет сообщение об отказе POST и не повторяет сам POST.
- Пять gates, независимое review и exact-head CI проходят до merge main; общий 8.10.3 остаётся отдельным gate.

## Подсказки

Принятие: [PR #64](https://github.com/trafficolog/volleytime/pull/64) смёржен в `main` как `c473de1ef8482a4f54a00b30ab79f6bd951e0333`; [CI PR 36538108493](https://github.com/trafficolog/volleytime/actions/runs/36538108493) на точном head `52d65a26a6008757637f7c3cf6d3612304d59181` и [main CI 36538310519](https://github.com/trafficolog/volleytime/actions/runs/36538310519) на merge прошли все три jobs. Деревья PR head и merge идентичны. Это закрывает только 8.10.6, не общий R0.6/production/Telegram.

[Отчёт 2026-09-29](../operations/qa/2026-09-29-miniapp-invite-load-retry.md): baseline 722, expected mounted RED4fail → GREEN4pass, финальный suite726; пять gates, Chrome и локальный smoke на точном implementation SHA. Настоящие Telegram/production/backup не заявляются.

- Поверхность: `apps/web/app/pages/m/orgs/[orgId]/invite.vue`.
- Working pattern: `apps/web/app/pages/app/orgs/[orgId]/invite.vue`, блок списка активных приглашений.
- RED evidence: `output/playwright/r06-error-mini-invite-{320,390}-{light,dark}.png`, `r06-error-retry-report.json` в QA-worktree; артефакты локальные ignored, не публичные данные.

## Не делать

- Не менять API/схему БД, бизнес-правила или общий auth; не создавать/отзывать реальные ссылки ради проверки.
- Не менять main/prod/VPS до принятия задачи и соответствующих release gates; не выдавать HTTP fixture за настоящий Telegram.
