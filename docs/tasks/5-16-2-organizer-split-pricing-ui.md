---
id: '5.16.2'
phase: '5'
epic: '5.16'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-02
status_note: 'UI реализован; I1/I2 исправлены RED→GREEN, независимый re-review cad35c35 PASS. Свежие пять gates PASS147files/1075tests; исходные timeout и форматирование QA helper сохранены в отчёте. Chrome local QA и отдельный acceptance supplement PASS; evidence docs/operations/qa/2026-10-02-organizer-split-chrome.md. Exact-head CI и merge открыты. M1 consequence copy сохраняется для итогового triage; production/Telegram не закрыты.'
roles: [FE, QA]
depends_on: ['6.11.1', '8.11.1']
tags: [mvp, split, miniapp, desktop, organizer]
---

# Task 5.16.2: выбор режима и распределение организатором

## Цель

Организатор создаёт и закрывает split-событие в Mini App и desktop в композиции референсов.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md), references/screens-organizer.jsx и screens-web-forms.jsx/screens-web.jsx. User-confirmed blue-shadow removal и distinct gray-card fields сохраняются.

## Что должно быть сделано

1. EventForm: доступный выбор fixed/split, условная цена/общая сумма, валюта организации, прогноз по вместимости, предупреждение об абонементах. Хранить отдельно несохранённые значения двух режимов.
2. Оба Mini App/desktop edit parents передают в EventForm manager-only GET `pricingPermissions: { canChangePriceMode:boolean; canChangeTargetAmount:boolean; canSettle:boolean }` из 6.11.1. Mode/target следуют server permission, не вычисляются из participantCount; cancelled-only/waitlist-only history также блокирует mode. Прежние реальные поля, deadline и публикация сохраняются; capability отдельно ограничивает создание/переход в split.
3. Manage в Mini App/desktop: прогноз, target/count, кнопка ручного «Закрыть запись и распределить» с подтверждением и server canSettle; после success — snapshot и фактический статус поступлений. Сервер повторно проверяет mutation под lock.
4. Guard полного live route/unmount до POST и после response, блокировка повторного действия, error/retry; суммы разных валют не объединяются.
5. Pending без paymentId отображается как «сумма после закрытия»; финансовая очередь показывает только существующие payments. Decline/remove не вызывает нового распределения.

## Критерии приёмки

- RED→GREEN mounted tests переключают режим и проверяют соответствующий body, amount validation, lock при edit, valid cancel/confirm диалога и stale route.
- API-to-form evidence: реальные manager GET ответы cancelled-only/waitlist-only при taken=0 передаются через оба edit parents в EventForm и блокируют mode; target/settle следуют своим разрешениям. Проверен server refusal после устаревшего GET; только hand-written mounted fixtures недостаточны.
- Browser Mini App320/390 и desktop1280 light/dark: рабочее сохранение, загрузка, error, keyboard/focus, читаемый прогноз/итог и отсутствие horizontal overflow.
- Пять gates и отдельное review; реальный Telegram сохраняется как отдельная post-deploy проверка.

## Подсказки

Общая EventForm используется обеими поверхностями; новые native radio сохраняют semantic groups и 20px branded controls. Проверять шапку/filters при pending, уже исправленные в 8.10.8.

## Review defects / fix round 1 (2026-10-01)

- I1: после временной ошибки page-local organization GET desktop edit «Повторить» должен обновить organization и event, показать pending и восстановить реальную форму.
- I2: query/hash navigation без unmount не должна навсегда оставлять settlement busy в Mini/desktop. Отмена и поздний POST должны снять только своё busy, не отправить stale POST и не применить stale response; после возврата на исходный URL действие снова доступно. Full-route/lifecycle/duplicate guards сохраняются.
- M1: copy отклонения split payment про продвижение waitlist отложен контроллером до итогового whole-branch triage; не входит в этот fix round.

## Локальный QA launcher — блокер 2026-10-02

Ручной helper `output/task4-qa-manual-start.ps1` падает на `Set-Acl` с требованием `SeSecurityPrivilege` до запуска Node. Исправление ограничено QA helper; продуктовый код, БД и production не меняются. Критерии smoke: повторное применение приватных прав к уже защищённому каталогу и файлу обычным пользовательским токеном, разрешены только текущий пользователь и SYSTEM; без записи SACL/owner/group, elevation или ослабления защиты. Проверить приватное наследование нового лога, чтение/запись, синтаксис и fail-closed до Node при ошибке ACL. Сохранить guards HEAD/build hash, loopback и точной QA-БД; нативная browser acceptance этим smoke не закрывается.

## Chrome QA checkpoint 2026-10-02

Пользовательская авторизация восстановлена. Реальные native cancel/confirm desktop/Mini и API settlement120/3,100/3, отказ409 пустому составу проверены контроллером. Visual matrix320/390/1280 light/dark сохранена и просмотрена; dark — token simulation. Actual Chrome200% reflow640/DPR2 без overflow проверен, desktop screenshot capture ещё требует завершения. Отчёт `.superpowers/sdd/2026-10-01-event-split-pricing/task-4-chrome-qa-20261002.md` фиксирует пределы evidence. Допроверки Chrome формы/focus/loading/retry и CI/PR/merge открыты; задача не done.

## Итог локальной Chrome QA 2026-10-02

[Фактический отчёт](../operations/qa/2026-10-02-organizer-split-chrome.md) дополняет предыдущий checkpoint: real PATCH/validation, keyboard320/390/1280, desktop error→loading→real GET retry и native200% compositor frame просмотрены. Дополнительные Mini320/390 PATCH200 сохранены как raw CLI-result; Mini edit retry не заявляется (существующий ErrorState имеет retry=false). Прежние обрезанные200% PNG не являются acceptance evidence. Native zoom возвращён100%; сеть разблокирована. Независимый local acceptance supplement PASS, Minor D1 release rollup исправлен. Свежие gates/CI/merge остаются открытыми; статус in_progress.

## Не делать

Не добавлять mock calculation, split в недоступную capability, per-event настройку глобальных абонементов, multi-seat, QR, auto-close или редактор ledger.
