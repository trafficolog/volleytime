---
date: 2026-05-28
duration_hours: 3
session_type: phase-elaboration
phase: '5'
scope: ui
goals:
  - 'Расписать UI Phase 5: эпики 5.9-5.12 из скелетов в детальные задачи'
  - 'Mini App player flow, admin flow, subscriptions, integration tests'
outcomes:
  - '12 UI/test задач полного формата (5.9.x, 5.10.x, 5.11.x, 5.12.x)'
  - 'Phase 5 полностью расписана: 38 задач (26 backend + 12 UI/tests)'
  - 'Shared utilities: useFormatters, labels.ts (централизация переводов)'
---

# Сессия 2026-05-28 (вечер): UI Phase 5

## Контекст

Backend Phase 5 (5.1-5.8) расписан в предыдущей сессии. Эта — UI поверх готового API: эпики 5.9-5.12 из скелетов в детальные задачи.

## Утверждённые 6 UI-решений

1. Booking method через sheet с радио-выбором, дефолт абонемент (если есть сессии)
2. Заполнено → явная кнопка «Встать в лист ожидания» (orange)
3. Индикатор «8/12 мест» + прогресс-бар + badge
4. Mini App полный (основной), Web — только админские страницы (создание с десктопа); player web переиспользует компоненты
5. Всё за раз (5.9-5.12)
6. Attendance через чекбоксы/тогглы + кнопка «Сохранить» (bulk)

## Структура UI Phase 5 (12 задач)

### Epic 5.9 — UI player (5 задач)

- 5.9.1 useEvents + список событий + EventCapacityBar (числа+прогресс+badge)
- 5.9.2 страница события + статус игрока + BookingActionButton
- 5.9.3 booking flow (BookingSheet с выбором метода, дефолт абонемент)
- 5.9.4 мои записи + отмена
- 5.9.5 централизация переводов (labels.ts, useLabels, plural)

### Epic 5.10 — UI admin (3 задачи)

- 5.10.1 EventForm (Mini App + Web, venue select/текст, price major/minor) + venues management
- 5.10.2 управление subscription plans
- 5.10.3 список записей + bulk attendance (тогглы Был/Не был)

### Epic 5.11 — UI subscriptions (2 задачи)

- 5.11.1 player-view планов + получение абонемента (autoActivate)
- 5.11.2 мои абонементы (остаток с прогрессом, срок, «скоро истекает»)

### Epic 5.12 — integration tests (2 задачи)

- 5.12.1 full lifecycle acceptance test (через сервисы, UI-порядок действий)
- 5.12.2 UI smoke (EventCapacityBar, labels) + регрессия

## Ключевые UI-паттерны

### Переиспользование Phase 4 паттернов

Composables через useState/ref, Mini App layout (`name="miniapp"`, layout: false), blue primary + orange accent, sheets снизу (fixed inset-0 bg-black/50, rounded-t-2xl), confirm для деструктивных, табы для фильтров, sticky bottom action bars.

### Shared utilities (новое в Phase 5)

- **useFormatters:** formatPrice (0→«Бесплатно», иначе X.XX BYN), даты/время на русском
- **labels.ts:** централизованные переводы (BOOKING_STATUS_LABELS, EVENT_TYPE_LABELS, SUBSCRIPTION_STATUS_LABELS, ERROR_MESSAGES, plural). Единый источник правды, переиспользуется (Phase 8 bot тоже сможет)
- **useLabels:** composable-обёртка для template

### price major/minor конверсия

UI вводит/показывает в рублях (15.00), backend хранит в минимальных единицах (1500). Конверсия в формах (×100 при save, /100 при load).

### Переиспользуемые компоненты

- EventCapacityBar — список, страница события, admin
- BookingSheet — выбор метода, дефолт абонемент, select при нескольких
- EventForm — create/edit, Mini App + Web (один компонент)

### Локализация по кодам

Решение 5/6: backend возвращает технические коды (booking.already_booked, method=subscription), UI переводит через errorMessage(code) / labels. Готовность к мультиязыку (Phase 14+).

## Composables Phase 5

| Composable           | Назначение                                     |
| -------------------- | ---------------------------------------------- |
| useEvents            | список/детали/создание событий                 |
| useBookings          | book, cancel, listMy, listForEvent, attendance |
| useSubscriptions     | fetchMy, acquire                               |
| useSubscriptionPlans | CRUD планов (admin + player view)              |
| useVenues            | CRUD площадок                                  |
| useFormatters        | цена, даты                                     |
| useLabels            | переводы статусов                              |

## Точки для будущих фаз

- **Phase 6:** UI подтверждения оплаты (pending_payment → confirmed), активация абонементов. В UI уже есть пометки «подтверждение — в следующем обновлении».
- **Phase 8 (bot):** уведомления о записи/промоушене, переиспользование labels.ts.
- **Phase 9:** E2E браузерные тесты (BookingSheet, EventForm interactive).

## Метрики сессии

- 12 UI/test задач, полный формат
- Phase 5 итого: 38 задач (26 backend + 12 UI)
- Все с frontmatter + 6 секций
- Эпики 5.9-5.12 из скелетов → детальные

## Что дальше

### Phase 5 завершена (планирование)

Полностью расписана. Можно реализовывать: backend (5.1-5.8) → UI (5.9-5.12).

### Следующая фаза планирования — Phase 6 (Manual Payments + Ledger)

- Payment confirm (cash/transfer): pending_payment → confirmed
- Активация subscriptions по оплате (убрать autoActivate, вызвать activate в payment confirm)
- Ledger (двойная запись финансов организации)
- Mass refund при отмене события

### Параллельные треки

- Трек A: юридическое (МНС/ФНС)
- Трек B: Python-прототип в реальной группе для UX-валидации
