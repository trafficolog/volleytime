---
date: 2026-05-29
duration_hours: 3
session_type: phase-elaboration
phase: '6'
goals:
  - 'Расписать Phase 6: Manual Payments + Ledger'
  - 'Замкнуть финансовые заглушки Phase 5 (pending_payment, autoActivate)'
  - 'Payment (polymorphic) + Ledger + mass refund'
outcomes:
  - 'Phase 6 phase-card переписана под решения (уведомления → Phase 8)'
  - '7 эпиков, 18 задач полного формата (2341 строка)'
  - 'Финансовый контур: Payment confirm как single source of truth'
---

# Сессия 2026-05-29: Phase 6 (Manual Payments + Ledger)

## Контекст

После Phase 5 booking cash/transfer создавал pending_payment без Payment-записи, платный subscription активировался autoActivate-заглушкой. Phase 6 замыкает финансовый контур.

## Утверждённые 12 решений

1. Payment polymorphic (booking_id ИЛИ subscription_id, ровно одно)
2. Lifecycle pending → succeeded / cancelled / refunded, русские названия в UI
3. Confirm: owner + organizer
4. Confirm атомарно; если booking уже не pending_payment → payment succeeded, booking не трогаем (деньги получены)
5. LedgerEntry: type + amount + category + nullable refs + description
6. Категории enum + description (payment_income, rent, equipment, refund, salary, other)
7. Баланс через SUM (не денормализуется)
8. Mass refund при отмене события автоматический
9. Игрок-отмена оплаченной брони: booking cancelled, ledger не трогаем, возврат — ручное решение через кассу
10. autoActivate только для бесплатных планов (price=0); платные → через payment confirm
11. Уведомления отложены на Phase 8 (bot ещё нет) — убран эпик уведомлений
12. Вся фаза за раз

## Структура Phase 6 (18 задач)

| Эпик                    | Задач | Суть                                                                                   |
| ----------------------- | ----: | -------------------------------------------------------------------------------------- |
| 6.1 Payment service     |     4 | schema (polymorphic), create, **confirm (single source of truth)**, cancel/refund      |
| 6.2 Ledger service      |     3 | schema, createEntry+balance (SUM), history+addExpense, API                             |
| 6.3 Payment integration |     2 | booking→payment (cash/transfer), subscription→payment (платные, отказ от autoActivate) |
| 6.4 Mass refund         |     2 | eventService.cancel расширение (restore+refund+cancel), тесты                          |
| 6.5 UI payments         |     2 | usePayments + список pending, confirm/reject + dashboard badge                         |
| 6.6 UI касса            |     2 | useLedger + баланс/история, expense sheet + категории                                  |
| 6.7 Tests               |     3 | payment, ledger+integration, mass refund                                               |

## Ключевые архитектурные решения

### Payment polymorphic

Одна таблица покрывает booking-оплату и subscription-покупку. Nullable booking_id/subscription_id, ровно одно заполнено (CHECK + валидация). Единый confirm flow.

### Confirm как single source of truth (из прототипа)

paymentService.confirm атомарно: Payment→succeeded + side effect (booking→confirmed / subscription→active через activate) + LedgerEntry income. Решение 4: если booking к моменту confirm не pending_payment (отменился) — payment всё равно succeeded (деньги физически получены), booking не трогаем.

### Append-only финансы

Payment succeeded не редактируется — refund это переход succeeded→refunded + корректирующая ledger expense. LedgerEntry никогда не меняется, баланс через SUM(income)−SUM(expense). Из DOMAIN.

### Замыкание заглушек Phase 5

- cash/transfer booking → создаёт Payment(pending), связывает booking.payment_id (6.3.1)
- платный subscription → Payment(pending), без autoActivate; price=0 → autoActivate сохраняется (6.3.2)
- eventService.cancel → реальный mass refund (6.4.1, была заглушка в 5.2.2)
- promoteFromWaitlist cash → создаёт Payment при промоушене

### Mass refund (решение 8)

Отмена события: для каждой брони — restore сессии (subscription), refund (succeeded payment → ledger expense), cancel (pending payment). Promotion НЕ триггерится (событие целиком отменяется). Net ledger по событию = 0.

### Ledger простой, трассируемый

type + category(enum) + amount + nullable payment_id/event_id + description. Не двойная запись (overkill). addExpense только expense-категории (income/refund автоматические).

## Категории ledger

- **income:** payment_income (оплата игрока)
- **expense:** rent (аренда), equipment (инвентарь), refund (возврат), salary (тренеру), other

## UI паттерны (переиспользование Phase 5)

- usePayments, useLedger composables через ref
- formatPrice (minor→major), labels.ts расширен LEDGER_CATEGORY_LABELS
- Sheets снизу (expense form), dashboard плитки с badge (pending count)
- Только owner/organizer (canManageContent)
- Русские названия статусов/методов/категорий

## Точки для будущих фаз

- **Phase 8 (bot):** уведомления (pending created, confirmed/rejected) — отложены сюда
- **Phase 12 (online):** payment method=online через bePaid, confirm автоматический по webhook
- **Phase 14 (reports):** финансовые отчёты, экспорт ledger, налоговая аналитика

## Метрики сессии

- Phase 6: 7 эпиков, 18 задач, 2341 строка
- Все с frontmatter + 6 секций
- Финансовая логика с акцентом на append-only и атомарность

## Что дальше

### Phase 6 завершена (планирование)

Финансовый контур расписан. Реализация: backend (6.1-6.4) → UI (6.5-6.6) → tests (6.7).

### Следующая фаза — Phase 7 (Event Credits)

Платформенная монетизация: организаторы платят платформе за проведение событий (event credits). ВАЖНО: блокируется Треком A (юридическое — нужна регистрация ИП/НПД для приёма платежей платформой).

### Критическое напоминание — параллельные треки НЕ двигались

- **Трек A (юридическое):** регистрация ИП/НПД, обращение в МНС/ФНС. **Блокирует Phase 7, 12-13.** Чем дальше, тем критичнее.
- **Трек B (Python-прототип):** запуск в реальной группе для UX-валидации. Можно прямо сейчас.
