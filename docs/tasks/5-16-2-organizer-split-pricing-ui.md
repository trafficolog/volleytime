---
id: '5.16.2'
phase: '5'
epic: '5.16'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'SDD подготовлена; пользовательские financial rules ждут review, UI не реализован.'
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
2. Edit уважает server pricing locks и status; mode/target нельзя менять после запрещённой границы. Прежние реальные поля, deadline и публикация сохраняются.
3. Manage в Mini App/desktop: прогноз, target/count, кнопка ручного «Закрыть запись и распределить» с подтверждением; после success — snapshot и фактический статус поступлений.
4. Guard полного live route/unmount до POST и после response, блокировка повторного действия, error/retry; суммы разных валют не объединяются.
5. Pending без paymentId отображается как «сумма после закрытия»; финансовая очередь показывает только существующие payments. Decline/remove не вызывает нового распределения.

## Критерии приёмки

- RED→GREEN mounted tests переключают режим и проверяют соответствующий body, amount validation, lock при edit, valid cancel/confirm диалога и stale route.
- Browser Mini App320/390 и desktop1280 light/dark: рабочее сохранение, загрузка, error, keyboard/focus, читаемый прогноз/итог и отсутствие horizontal overflow.
- Пять gates и отдельное review; реальный Telegram сохраняется как отдельная post-deploy проверка.

## Подсказки

Общая EventForm используется обеими поверхностями; новые native radio сохраняют semantic groups и 20px branded controls. Проверять шапку/filters при pending, уже исправленные в 8.10.8.

## Не делать

Не добавлять mock calculation, split в недоступную capability, per-event настройку глобальных абонементов, multi-seat, QR, auto-close или редактор ledger.
