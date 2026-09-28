---
id: '6.10.1'
phase: '6'
epic: '6.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'API history and desktop payments/cashbox implemented; final review fixes and local five gates pass. Focused rereview and CI pass; user-supplied 200% screenshots cover payments and cashbox overview, while form zoom and screen-reader/manual QA remain. Acceptance is not complete.'
roles: [BE, FE, QA]
depends_on: ['5.15.1']
estimated_hours: '12-16'
tags: [web, organizer, finance, mvp, redesign]
---

# Task 6.10.1: Desktop-оплаты и касса v2

## Цель

Довести финансовые экраны desktop-организатора до `screens-web.jsx` / `screens-web-forms.jsx` в пределах MVP.

## Контекст

Shell поставляет 5.15.1. Денежные переходы уже есть в API и Mini App; desktop должен использовать те же правила. [Согласованный дизайн](../superpowers/specs/2026-09-27-organizer-desktop-finance-v2-design.md) уточняет отдельные пункты меню и полную историю платежей. В текущей схеме `cancelled` не содержит причины: этот статус отображается как «Отменён», включая отклонённые платежи, без ложной атрибуции.

## Что должно быть сделано

1. Добавить в desktop-shell отдельные пункты «Оплаты» и «Касса» с рабочими маршрутами для owner/organizer.
2. Добавить отдельный manager-only API полной постраничной истории платежей `pending`/`succeeded`/`cancelled`/`refunded`, не меняя контракт существующего списка ожидающих; не раскрывать приватные поля и данные иной организации.
3. На desktop показать ожидающие оплаты с индивидуальными подтверждением/отклонением через существующий API и историю со статусным фильтром/пагинацией. После мутаций перечитывать серверное состояние.
4. Показать действительный баланс по валютам, доходы/расходы, последние операции и действующие формы ручных append-only операций кассы.
5. TDD для денежного API/действий, прав, ошибок, гонок, пагинации и состояния после обновления; визуальный и функциональный browser smoke на 1280/1440 px, узком окне и 200% zoom.

## Критерии приёмки

- Все действия завершаются через реальные API без дублирования финансовой бизнес-логики в UI.
- История включает все четыре статуса, включая отменённые/отклонённые, с устойчивой сортировкой `createdAt DESC, id DESC`, фильтром и продолжением без повторов на границах страниц. Неверные параметры дают 400, чужая группа и роль без права не получают данные.
- Статус `cancelled` подписан «Отменён»; причина/дата отмены не выдумываются. Удалённый связанный объект не скрывает платёж.
- Статус, сумма в minor units, валюта и способ согласованы с Mini App; разные валюты не складываются. Ошибки и состояния доступа видны и доступны.
- Действия выполняются по одному; после успеха и конфликта состояние обновляется с сервера, повторное нажатие не создаёт дубликатов. Кассовый журнал остаётся append-only.
- Пять gates с PostgreSQL, соответствующий financial smoke, независимое review и применимый browser QA зелёные до merge задачи в `main`.

## Подсказки

- При расхождении референса с политикой денег приоритет у SDD Phase 6.

## Находки review 2026-09-27

- Финальное review 2026-09-28: список события кассы не должен навсегда ограничиваться 30 старейшими. Через существующие `filter=upcoming|past`, `limit=30`, `offset` дать ближайшие/последние события и явное продолжение к более старым/дальним, сохранив own-org/lifecycle guards. RED: более 30 событий, выбор и запись операции с событием за первой страницей → GREEN.
- Финальное review 2026-09-28: даты оплат требуют подтверждённой зоны текущей организации; при задержке/ошибке загрузки не показывать fallback Europe/Minsk как фактическую зону, показать состояние/повтор. RED с America/New_York и `2026-09-28T00:30:00Z`, ошибкой и retry → GREEN.
- Финальное review 2026-09-28: добавить фокусируемость заголовка кассы (`tabindex="-1"`) для существующего shell handoff; проверить клавиатурный фокус после перехода.

- Review кассы 2026-09-28: форма форматирует дату через fallback timezone до загрузки зоны организации, а сохранение интерпретирует введённое через уже обновлённую зону. До инициализации/отправки формы нужна подтверждённая зона текущей организации; сбой её получения не должен молча отправлять время в fallback. RED с задержанной загрузкой отличающейся зоны → GREEN, повторное review и gates.

- Self-review кассы: нулевые баланс/доход/расход должны отображаться денежной суммой с валютой, а не «Бесплатно». Проверить RED/GREEN в браузере. Изолировать очистку новых history fixtures после интеграционных тестов, чтобы последующие auth tests не падали на FK организации.

- Desktop payments использует `useOrgTimezone`: запоздалый ответ группы A сейчас может записаться под текущим ID группы B. В рамках критерия изоляции состояния добавить RED-тест A→B, захватывать ID запроса для записи кэша, затем GREEN и повторное review.
- Сообщение конфликта оплаты не должно утверждать «Списки обновлены» до успешного завершения повторной загрузки; убрать ложное подтверждение обновления и проверить сбой reload.

## Локальная проверка 2026-09-28

- Cashbox helper RED отсутствующего модуля → GREEN 15/15; browser RED нулевых сумм «Бесплатно» → GREEN «0,00 BYN» через денежный formatter.
- Пять gates зелёные: format:check; lint (0 errors, 21 baseline warnings); typecheck (6/6); test с PostgreSQL (101 files, 563 tests); build (2/2). Task 1 history core/HTTP + financial smoke: 3 files, 18 tests.
- Real local API/browser: manual income125/expense25minor → balance100; timezone conversion; duplicate submit1POST; foreign event404; assistant read/write403; cashbox/payments401/404/503+retry; cashbox1280/1440/390; delayed org-param GET and mutation navigation on both pages, no stale destination state. Nuxt changes page instance on org-param transition; literal same-instance browser reuse is not asserted.
- Correction timezone: browser RED подтвердил сдвиг7часов при delayed New York response; касса теперь ждёт подтверждённую зону и сохраняет её вместе с формой. GREEN: delayed differing zone, failed load + native retry и route leave while loading; scoped unit17/17. Повторные пять gates зелёные, полный suite101files/565tests; shared timezone consumers не менялись.
- После финального fix wave и scoped re-review открыт draft [PR #51](https://github.com/trafficolog/volleytime/pull/51); GitHub CI [run 36403840538](https://github.com/trafficolog/volleytime/actions/runs/36403840538) на `5096229` прошёл quality, PostgreSQL tests и build. Открыто: actual browser 200% zoom (CLI/IAB shortcuts не меняют измеренный масштаб), screen-reader/manual QA и merge. Own-event dropdown проверен real API: selected event12 совпадает с записью кассы, foreign event13 не предлагается. Telegram-host/production/VPS/backup/monitoring/real-group validation не проводились. Статус остаётся in_progress.
- Финальный fix wave review: browser RED подтвердил недоступность `upcoming35` после первых 30 старейших событий, неверный `28 сент.` для New York после metadata 503 и отсутствие фокуса на `h1` кассы. GREEN: переключение upcoming/past и `offset=30` позволило записать операции, связанные с 35-м событием в каждом периоде; задержка/503 зоны скрывают даты до подтверждения, retry показывает `27 сент.`; клавиатурный переход фокусирует `h1`. Дополнительно проверены filter/race/reset, continuation 503/retry, foreign-event 404, 1280/1440/390 px и очистка QA fixtures. После fix wave все пять локальных gates: format:check, lint (0 errors, 21 baseline warnings), typecheck (6/6), PostgreSQL test (102 files / 570 tests), build (2/2), exit 0. Focused rereview подтвердил все три исправления, новых Critical/Important нет. Actual 200% zoom, screen-reader/manual QA, merge и внешний QA остаются открытыми; статус in_progress.
- Пользователь предоставил скриншоты Chrome/Edge при заявленном zoom 200%: на «Оплатах» видны обе ожидающие заявки, обе индивидуальные операции, фильтр истории и «Показать ещё» после длинной страницы; на «Кассе» видны оба действия, три нулевые суммы с валютой, фильтр и пустой журнал. На присланных изображениях нет явного горизонтального обрезания или недоступного контроля. Это подтверждает только видимую часть двух экранов, не поведение форм при zoom, фактические действия, клавиатуру или screen reader. Повторяющееся «Назначение недоступно» относится к синтетическим записям QA без связанного события/плана. Остальные manual QA и merge открыты; статус in_progress.
- Дополнительная локальная проверка в IAB при узком окне: переход «Оплаты» → «Касса» фокусирует `h1`; «Добавить доход» раскрывает форму, где категория, сумма, сегменты даты/времени, период, событие, описание, «Отменить» и «Записать операцию» проходят естественным Tab-порядком и имеют имена в accessibility tree. Низ формы и обе кнопки доступны вертикальной прокруткой; отмена с клавиатуры закрыла форму без записи. Это не проверка с реальным экранным диктором и не actual browser zoom 200% для формы.

## Не делать

- Не добавлять онлайн-оплату, массовые действия, split/credits, reports, CSV-экспорт, новую операцию возврата, редактирование/удаление журнала и фиктивные показатели. Задача сама по себе не разрешает продвижение `prod`.
