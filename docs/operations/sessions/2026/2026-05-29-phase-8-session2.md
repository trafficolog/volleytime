---
date: 2026-05-29
duration_hours: 2.5
session_type: phase-elaboration
phase: '8'
scope: notifier-notifications-polish-tests
goals:
  - 'Завершить Phase 8: NotifierService + уведомления + UX полировка + tests/QA'
  - 'Эпики 8.4-8.7 из скелетов в детальные задачи'
outcomes:
  - '9 задач полного формата (8.4-8.7)'
  - 'Phase 8 расписана ЦЕЛИКОМ: 17 задач (foundation 8 + notifier/polish 9)'
  - 'MVP-фаза завершена в планировании'
---

# Сессия 2026-05-29 (Phase 8 session 2): notifier + уведомления + полировка + tests

## Контекст

Вторая сессия Phase 8 (MVP). Сессия 1 расписала foundation (auth, WebApp SDK, bot). Эта — notifier + все уведомления + полировка + tests/QA. Завершает Phase 8.

## Структура (9 задач, эпики 8.4-8.7)

### Epic 8.4 — NotifierService (2 задачи)

- 8.4.1 NotifierService + internal transport (web→bot HTTP, secret защита, fire-and-forget)
- 8.4.2 шаблоны сообщений (NotificationType enum, renderMessage, web_app кнопки, HTML esc)

### Epic 8.5 — Уведомления (3 задачи)

- 8.5.1 паттерн post-commit notify (collect-then-notify) + booking confirmed/waitlisted
- 8.5.2 payment confirmed/rejected игроку + pending→организаторам (listManagers)
- 8.5.3 waitlist promotion (КРИТИЧНО) + event cancelled (mass, дедуп)

### Epic 8.6 — UX полировка (2 задачи)

- 8.6.1 SkeletonList/ErrorState/EmptyState + useAsyncResource
- 8.6.2 useOnline (offline баннер) + performance (< 2 сек открытие, профилирование)

### Epic 8.7 — Tests + QA (2 задачи)

- 8.7.1 initData integration + notifier автотесты
- 8.7.2 manual QA чеклист (организатор+игрок, iOS+Android) + MVP-критерий

## Ключевые архитектурные решения

### Транспорт web→bot (8.4.1)

web и bot — раздельные процессы (важно для Phase 9 deploy). grammY живёт в боте. Транспорт: web шлёт internal HTTP боту (POST /internal/notify, защита x-internal-secret), бот отправляет через grammY. Таймаут 5 сек.

### Post-commit notify паттерн (8.5.1) — КРИТИЧНО

Нельзя слать notifier внутри db.transaction (медленный/упавший telegram заблокирует/откатит бизнес-операцию). Паттерн collect-then-notify: сервис возвращает { result, notifications }, endpoint шлёт после коммита. dispatchNotifications fire-and-forget (Promise.allSettled).

Изменены сигнатуры: bookingService.book → { booking, notifications }, cancel → { booking, promoted, notifications }, eventService.cancel → { event, notifications }, paymentService.confirm/cancel → { payment, notifications }.

### Уведомления (все из решения 6)

- booking_confirmed / booking_waitlisted → игроку
- waitlist_promoted → игроку (САМОЕ ЦЕННОЕ: без него waitlist бесполезен, игрок не следит вручную)
- payment_confirmed / payment_rejected → игроку
- pending_payment_for_organizer → owner+organizer (listManagers)
- event_cancelled → всем участникам (дедуп по userId, refunded флаг)

web_app кнопки в уведомлениях открывают нужный экран Mini App (промоутнутый игрок сразу видит событие).

### UX полировка (8.6)

SkeletonList (вместо спиннеров), ErrorState с retry (не белый экран при сбое сети), EmptyState унификация. useOnline offline-баннер. Performance: профилирование, lazy-load, цель открытие < 2 сек на 4G.

### Tests + QA (8.7)

Автотесты: initData integration (security), notifier (рендеринг, fire-and-forget, transport mock, secret). Manual QA: полный сценарий организатор+игрок в реальном Telegram (iOS+Android+desktop+браузер fallback), light/dark, Telegram-specific (initData/MainButton/deeplinks/уведомления/haptics).

MVP-критерий (гейт перед Phase 9): соло-разработчик проводит неделю тренировок своей группы только через Mini App, без прототипа/Excel. Это одновременно QA и Трек B (UX-валидация).

## Метрики сессии

- 9 задач (8.4-8.7), 2250 строк всего Phase 8
- Phase 8 итого: 17 задач (foundation 8 + session 2: 9)
- Все с frontmatter + 6 секций
- Эпики 8.4-8.7 из скелетов → детальные

## Что дальше

### Phase 8 завершена (планирование) — MVP-фаза готова

Реализация: foundation (8.1-8.3) → notifier (8.4) → уведомления (8.5) → полировка (8.6) → tests/QA (8.7). После прохождения MVP-критерия — готовый продукт.

### Следующая фаза — развилка

- **Phase 9 (Production Deploy):** webhook режим бота, HTTPS, VPS (Selectel/Timeweb Москва), домен. Логичный следующий шаг к реальному запуску.
- **Phase 7 (Event Credits):** платформенная монетизация. Блокируется Треком A (юридическое).

Рекомендация: Phase 9 (deploy) → реальный запуск MVP в группе → потом Phase 7 когда Трек A созреет.

### Параллельные треки (НЕ двигались 8 сессий — критично!)

- **Трек A (юридическое):** регистрация ИП/НПД. Блокирует Phase 7, 12-13. Чем дальше — критичнее.
- **Трек B (Python-прототип / или сразу MVP):** запуск в реальной группе. MVP-критерий 8.7.2 = по сути Трек B на новом стеке.
