---
id: '6.10.1'
phase: '6'
epic: '6.10'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-28
status_note: 'API history, desktop payments/cashbox implemented; local five gates and financial smoke pass. Independent whole-branch review, CI and actual 200% zoom/manual QA remain; acceptance is not complete.'
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

- Self-review кассы: нулевые баланс/доход/расход должны отображаться денежной суммой с валютой, а не «Бесплатно». Проверить RED/GREEN в браузере. Изолировать очистку новых history fixtures после интеграционных тестов, чтобы последующие auth tests не падали на FK организации.

- Desktop payments использует `useOrgTimezone`: запоздалый ответ группы A сейчас может записаться под текущим ID группы B. В рамках критерия изоляции состояния добавить RED-тест A→B, захватывать ID запроса для записи кэша, затем GREEN и повторное review.
- Сообщение конфликта оплаты не должно утверждать «Списки обновлены» до успешного завершения повторной загрузки; убрать ложное подтверждение обновления и проверить сбой reload.

## Локальная проверка 2026-09-28

- Cashbox helper RED отсутствующего модуля → GREEN 15/15; browser RED нулевых сумм «Бесплатно» → GREEN «0,00 BYN» через денежный formatter.
- Пять gates зелёные: format:check; lint (0 errors, 21 baseline warnings); typecheck (6/6); test с PostgreSQL (101 files, 563 tests); build (2/2). Task 1 history core/HTTP + financial smoke: 3 files, 18 tests.
- Real local API/browser: manual income125/expense25minor → balance100; timezone conversion; duplicate submit1POST; foreign event404; assistant read/write403; cashbox/payments401/404/503+retry; cashbox1280/1440/390; delayed org-param GET and mutation navigation on both pages, no stale destination state. Nuxt changes page instance on org-param transition; literal same-instance browser reuse is not asserted.
- Открыто: independent whole-branch review, PR/CI/merge; actual browser200%zoom (CLI shortcuts не меняют zoom), screen-reader QA и own-event dropdown selection. Telegram-host/production/VPS/backup/monitoring/real-group validation не проводились. Статус остаётся in_progress.

## Не делать

- Не добавлять онлайн-оплату, массовые действия, split/credits, reports, CSV-экспорт, новую операцию возврата, редактирование/удаление журнала и фиктивные показатели. Задача сама по себе не разрешает продвижение `prod`.
