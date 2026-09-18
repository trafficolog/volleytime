---
date: 2026-05-28
duration_hours: 4
session_type: phase-elaboration
phase: '5'
scope: backend
goals:
  - 'Расписать backend-ядро Phase 5: Events + Bookings + Subscriptions'
  - 'Эпики 5.1-5.8 (backend) детально, 5.9-5.12 (UI/tests) скелетно'
  - 'Перенести проверенную логику Python-прототипа с упрощениями'
outcomes:
  - 'Phase 5 phase-card переписана под модель capacity+waitlist (отказ от main/rotation)'
  - '12 эпиков: 8 backend детально, 4 UI/tests скелетно'
  - '26 backend-задач полного формата (3362 строки)'
  - 'Atomic-паттерны: advisory lock (capacity), atomic consume (subscriptions)'
---

# Сессия 2026-05-28: backend-ядро Phase 5

## Контекст

Phase 5 — крупнейшая фаза (50-70ч), ядро функциональности. Решение 17: разбить на backend (эта сессия) + UI (следующая). Backend — самое сложное и важное (портирование логики прототипа).

## Утверждённые 17 решений

Ключевые упрощения относительно прототипа и DOMAIN.md:

1. Event types: training + open_game идентичны, tournament/custom в enum но не используются
2. Только одиночные события (recurring — Phase 15)
   3-4. **Отказ от main/rotation слотов** — ротация это организационный момент внутри игры по ходу розыгрыша очков, не категория записи. Единый capacity + waitlist
3. Booking методы: subscription consume + pending_payment (cash/transfer — Phase 6, online — Phase 12)
4. Методы оплаты — технические коды на backend, русские названия статусов в UI
5. pending_payment занимает слот сразу
6. Subscription plans per-org, могут быть бесплатными (госорганизации)
7. Atomic consume: UPDATE SET used=used+1 WHERE used<total RETURNING
8. FIFO по expires_at (раньше истекающий первым)
9. Plan: total_sessions + опциональный validity_days + price
10. Subscription pending → active при оплате (Phase 6); в dev autoActivate
11. Waitlist promotion synchronous без уведомлений
12. Cancellation deadline настраивается per-event
13. Concurrency: advisory lock + unique constraint
14. Venue: location_text + опциональный venue_id
15. Backend сейчас, UI отдельно

## Структура Phase 5

### Backend эпики (детально, 26 задач)

| Эпик                      | Задач | Суть                                                                      |
| ------------------------- | ----: | ------------------------------------------------------------------------- |
| 5.1 Venues                |     2 | площадки (опционально)                                                    |
| 5.2 Events                |     4 | schema, service, listing с computed counts, API                           |
| 5.3 Bookings core         |     5 | schema, allocation, statuses, attendance, **concurrency (advisory lock)** |
| 5.4 Subscription plans    |     2 | schema+service, API                                                       |
| 5.5 Subscriptions         |     4 | schema, create/activate, **atomic consume+FIFO**, restore+expiry          |
| 5.6 Cancellation+waitlist |     3 | cancel+restore+deadline, promotion, edge tests                            |
| 5.7 API endpoints         |     3 | booking endpoints, subscription endpoints, error/permission integration   |
| 5.8 Backend tests         |     3 | flow tests, cancellation tests, concurrency tests                         |

### UI/tests эпики (скелетно — следующая сессия)

| Эпик                   | Суть                                |
| ---------------------- | ----------------------------------- |
| 5.9 UI player          | список событий, запись, мои записи  |
| 5.10 UI admin          | создание событий, планы, attendance |
| 5.11 UI subscriptions  | покупка, мои абонементы             |
| 5.12 Integration tests | full lifecycle, UI smoke            |

## Ключевые архитектурные паттерны

### Capacity + waitlist (упрощение от прототипа)

Event хранит только capacity (не main/rotation). Booking allocation: confirmed_count < capacity → confirmed, иначе waitlisted. Counts вычисляются по COUNT bookings (не хранятся в event — избегаем рассинхрона).

### Concurrency-safe allocation (5.3.5)

pg_advisory_xact_lock(eventId) сериализует booking-операции per-event. Без него count-then-insert race → over-booking. Lock transaction-scoped, авто-освобождение. Booking на разные события параллельны.

### Atomic consume + FIFO (5.5.3)

Прямой перенос из прототипа: UPDATE SET used=used+1 WHERE used<total RETURNING. Возвращает null при гонке/исчерпании. FIFO: findConsumable сортирует по expiresAt ASC NULLS LAST, retry loop по candidates.

### Waitlist + subscription nuance

Waitlisted booking НЕ списывает сессию. Списание при promotion (когда реально попал в состав). Если при промоушене сессия исчерпана → pending_payment (не теряем игрока).

### Cancellation + restore + promotion (5.6)

Транзакция: deadline check (admin bypass) → restore session (если был) → cancel → promote first waitlisted. Всё атомарно.

### Booking methods как технические коды

backend: subscription/cash/transfer/online/free. UI переводит статусы на русский. cash/transfer pending_payment в Phase 5, confirm — Phase 6.

## Точки расширения для будущих фаз

- **Phase 6 (Payments):** subscription.activate вызывается при payment confirm (убрать autoActivate). Booking pending_payment → confirmed при оплате. Mass refund при отмене события.
- **Phase 12 (Online):** booking method=online через bePaid.
- **Phase 15 (Reminders):** TTL-отмена pending_payment, TTL-подтверждение promotion, scheduled expiry job, recurring events.
- **Phase 8 (Bot):** уведомления о записи/отмене/промоушене.

## Метрики сессии

- Phase 5 phase-card переписана (capacity+waitlist модель)
- 12 эпиков (8 backend + 4 скелет)
- 26 backend task cards, 3362 строки, ~129 строк/задача
- Все с корректным frontmatter + 6 секций
- 2 критичных concurrency-узла детально проработаны (5.3.5, 5.5.3)

## Что дальше

### Следующая сессия — UI Phase 5

Эпики 5.9-5.12: список событий, страница события с записью, мои записи/абонементы, admin создание событий/планов, покупка абонементов. На основе референсов volleytime.trafficolog.ru.

### После Phase 5 — Phase 6 (Manual Payments + Ledger)

Подключит payment confirm, активацию subscriptions по оплате, mass refund.

### Параллельные треки

- Трек A: юридическое (МНС/ФНС)
- Трек B: Python-прототип в реальной группе
