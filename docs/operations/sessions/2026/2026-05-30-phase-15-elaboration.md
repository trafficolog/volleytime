---
date: 2026-05-30
duration_hours: 3
session_type: phase-elaboration
phase: '15'
goals:
  - 'Подвинуть Phase 15 перед 11 (порядок реализации), обновить roadmap'
  - 'Детально расписать Phase 15: Reminders & Automation'
outcomes:
  - 'ROADMAP обновлён: секция последовательности реализации (≠ нумерация)'
  - 'Phase 15 phase-card переписана + 8 эпиков + 16 задач (1749 строк)'
  - 'Завершает ЯДРО перед модулями 11+'
---

# Сессия 2026-05-30: Phase 15 (Reminders & Automation)

## Контекст и решение о порядке

Пользователь предложил поставить Phase 15 ПЕРЕД Phase 11 — чтобы сначала закрыть базовый функционал полностью, потом наращивать модули. Принято с поправкой: **НЕ переименовывать фазы физически** (номер = ID, на него завязаны 64 эпика, 165 задач, depends_on, кросс-ссылки — переименование рискованно и бесполезно). Порядок реализации ≠ нумерация.

**Обновлён ROADMAP** — добавлена секция «Последовательность реализации (≠ нумерация)»:

```
3 → 4 → 5 → 6 → 8 → 9 → 10 → 7 → 15 → 11 → 12 → 13 → 14 → 16 → 17 → 18
└────────── ЯДРО + MVP + бета ─────────┘ └ЯДРО┘ └──── МОДУЛИ ────┘
```

Логика: 15 (reminders/automation) работает внутри ядра (события, брони, waitlist), завершает базовый функционал. 11+ — отдельные домены сверху. Бонус: job runner (15) — инфраструктура для вебхуков/ретраев Phase 12-13.

## Утверждённые 9 решений (все по рекомендациям)

1. pg-boss (очередь на Postgres, без Redis)
2. Worker в bot-процессе
3. Reminders 24h + 2h, только confirmed
4. Auto-close за 2ч (Event→closed, новые записи нельзя; отмена — отдельный deadline Phase 5)
5. TTL pending ТОЛЬКО для online (Phase 12); cash/transfer НЕ трогаем (организатор подтверждает без спешки)
6. Waitlist confirm-flow заменяет авто-promotion (предложение+TTL 30мин+следующий)
7. Критичные уведомления через очередь с retry (закрывает fire-and-forget долг Phase 8)
8. Auto-finished через 30мин после endsAt
9. Вся фаза за раз

## Структура Phase 15 (8 эпиков, 16 задач)

| Эпик                       | Задач | Суть                                                                   |
| -------------------------- | ----: | ---------------------------------------------------------------------- |
| 15.1 Job runner            |     2 | pg-boss подключение + worker в bot + graceful stop                     |
| 15.2 Event lifecycle       |     2 | регистрация задач при create, отмена/перерегистрация при cancel/update |
| 15.3 Reminders             |     2 | 24h+2h handlers + idempotency (per-booking отметка)                    |
| 15.4 Auto-close/finish     |     2 | close за 2ч (в reminder_2h) + auto-finished                            |
| 15.5 Waitlist confirm-flow |     3 | offered-состояние + inline-confirm callback + TTL→следующий            |
| 15.6 TTL pending           |     1 | online-only механизм (cash защищён)                                    |
| 15.7 Notify queue          |     2 | notify.deliver + retry + sendReliable + перевод критичных              |
| 15.8 Tests                 |     2 | lifecycle/reminders/close + confirm-flow/TTL/notify (freeze time)      |

## Ключевые архитектурные решения

### pg-boss (без Redis)

Очередь в схеме pgboss той же БД (Phase 9). send из любого процесса (web ставит задачи), work только в bot (worker). Вынести обёртку в packages/jobs. Переживает рестарт, retry встроен.

### Bot = 3 роли

webhook (:8443) + internal notify (:3001) + pg-boss worker. Один процесс, graceful shutdown (stopBoss дожидается задач).

### Event job lifecycle

event_jobs таблица (event→jobId для отмены). create → schedule 24h/2h/finish (после коммита, задачи в прошлом не ставятся). cancel → cancelEventJobs. Двойная защита: отмена задач + проверка актуальности в handler.

### Waitlist confirm-flow (заменяет Phase 5 авто-promotion) — сложнейший эпик

Освободилось место → offered первому (резерв 30мин, capacity учитывает) → inline-кнопка → подтвердил (в состав по методу) / TTL истёк (следующий по FIFO). Анти-зацикливание (истёкший в конец очереди, не предлагается сразу снова). Снятие TTL при confirm (race-защита). Меняет promoteFromWaitlist (5.6.2) и waitlist_promoted→waitlist_offer (8.5.3).

### TTL pending — online-only (решение 5, тонкий момент)

cash/transfer подтверждает организатор вручную (часы) — TTL отменил бы наличные. Поэтому TTL ставится ТОЛЬКО для method=online (Phase 12). Двойная защита: не ставим для cash (регистрация) + handler проверяет method==online (выполнение). До Phase 12 механизм готов, но не активен (нет online-броней).

### Очередь уведомлений (закрывает долг Phase 8)

notify.deliver job с retry (3 попытки). sendReliable (очередь) для критичных: waitlist_offer (TTL-зависимость!), payment_confirmed/rejected, event_cancelled, credits_purchased. Некритичные (booking_confirmed, reminders) — прямой send. Dead-letter лог (не молча терять).

## Долги, закрытые Phase 15

- **Reminders** (отложены из Phase 8) — реализованы
- **Очередь с retry для уведомлений** (отложено из Phase 8) — fire-and-forget заменён на надёжную доставку для критичных
- **Авто-promotion вслепую** (Phase 5/8) — заменён на confirm-flow

## Метрики сессии

- Phase 15: 8 эпиков, 16 задач, 1749 строк
- ROADMAP обновлён (секция последовательности реализации)
- current-state обновлён (порядок реализации)
- Все задачи с frontmatter + 6 секций

## Что дальше

### Phase 15 завершена — ЯДРО полностью расписано

С Phase 15 базовый функционал закрыт целиком (события, брони, абонементы, платежи, монетизация, Telegram, deploy, бета, автоматизация). Дальше — модули сверху.

### Расписано детально: 9 фаз (3-10 + 7 + 15)

Эпиков 72, задач 181, сессий 12.

### Остаток (модули, по факту работающего продукта)

- Phase 11 Contributions (сборы)
- Phase 12-13 Online Payments (bePaid — активирует TTL pending из 15.6)
- Phase 14 Reports & Export
- Phase 16-17 Matches + Tournament (порт Level Volley)
- Phase 18 CRM Pro

Эти фазы разумнее детализировать по факту обратной связи беты — приоритеты сдвинутся. Самый ценный шаг — начать реализацию (агентная разработка на десктопе по расписанным карточкам).

### Статус треков

Трек A готов, Трек B пройден. Блокеры сняты. Весь критический путь + ядро расписаны.
