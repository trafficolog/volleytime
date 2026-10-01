---
id: '5.16.2'
phase: '5'
epic: '5.16'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'UI реализован; 35 mounted и 12 реальных PostgreSQL API-to-form сценариев, пять gates зелёные. IAB 320/390/1280 light/dark и реальные create/PATCH проверены; native confirm блокирует браузер, settlement/error-retry и native 200% QA ожидают продолжения контроллером. Независимое review, CI и merge ещё не выполнены.'
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

## Не делать

Не добавлять mock calculation, split в недоступную capability, per-event настройку глобальных абонементов, multi-seat, QR, auto-close или редактор ledger.
