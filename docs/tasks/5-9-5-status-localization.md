---
id: '5.9.5'
phase: '5'
epic: '5.9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - FE
depends_on:
  - '5.9.4'
estimated_hours: '1'
tags:
  - ui
  - localization
  - refactor
---

# Task 5.9.5: Статусы/локализация + shared utilities

## Цель

Вынести разбросанные по компонентам label-функции (статусы, типы, ошибки) в единый shared-модуль. Убрать дублирование между 5.9.2/5.9.3/5.9.4.

## Контекст

В предыдущих задачах label-функции (bookingStatusLabel, typeLabel, translateError) дублировались. Решение 5/6: коды на backend, русский в UI. Централизуем переводы в одном месте — единый источник правды.

## Что должно быть сделано

1. **`apps/web/utils/labels.ts`** — все переводы:

   ```ts
   // Booking statuses
   export const BOOKING_STATUS_LABELS: Record<string, string> = {
     pending_payment: 'Ждёт оплаты',
     confirmed: 'Записан',
     waitlisted: 'Лист ожидания',
     attended: 'Посетил',
     no_show: 'Пропуск',
     cancelled: 'Отменено',
   }

   export const BOOKING_STATUS_BADGE: Record<string, string> = {
     confirmed: 'bg-green-100 text-green-700',
     waitlisted: 'bg-orange-100 text-orange-700',
     pending_payment: 'bg-yellow-100 text-yellow-700',
     attended: 'bg-blue-100 text-blue-700',
     no_show: 'bg-gray-100 text-gray-600',
     cancelled: 'bg-gray-100 text-gray-500',
   }

   export const EVENT_TYPE_LABELS: Record<string, string> = {
     training: 'Тренировка',
     open_game: 'Открытая игра',
     tournament_match: 'Матч',
     custom: 'Событие',
   }

   export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
     pending: 'Ожидает активации',
     active: 'Активен',
     exhausted: 'Использован',
     expired: 'Истёк',
     cancelled: 'Отменён',
   }

   // Error code → user message (русский)
   export const ERROR_MESSAGES: Record<string, string> = {
     'booking.already_booked': 'Вы уже записаны на это событие',
     'booking.event_not_bookable': 'Запись на это событие недоступна',
     'booking.deadline_passed': 'Срок отмены прошёл',
     'booking.cannot_cancel_others': 'Нельзя отменить чужую запись',
     'booking.no_active_subscription': 'Нет активного абонемента со свободными занятиями',
     'subscription.no_active': 'Нет активного абонемента',
     'subscription.plan_not_available': 'Этот план недоступен',
     'event.not_found': 'Событие не найдено',
     'event.capacity_below_confirmed': 'Нельзя уменьшить вместимость ниже числа записанных',
     'permission.cannot_manage_content': 'Недостаточно прав',
   }

   export function label(map: Record<string, string>, key: string): string {
     return map[key] ?? key
   }

   export function errorMessage(code?: string, fallback = 'Что-то пошло не так'): string {
     return (code && ERROR_MESSAGES[code]) || fallback
   }

   // Плюрализация русских существительных
   export function plural(n: number, forms: [string, string, string]): string {
     const mod10 = n % 10,
       mod100 = n % 100
     if (mod10 === 1 && mod100 !== 11) return forms[0]
     if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
     return forms[2]
   }
   // использование: plural(n, ['занятие', 'занятия', 'занятий'])
   ```

2. **Composable-обёртка `apps/web/composables/useLabels.ts`** (для удобства в template):

   ```ts
   import {
     BOOKING_STATUS_LABELS,
     BOOKING_STATUS_BADGE,
     EVENT_TYPE_LABELS,
     SUBSCRIPTION_STATUS_LABELS,
     label,
     errorMessage,
     plural,
   } from '~/utils/labels'

   export function useLabels() {
     return {
       bookingStatus: (s: string) => label(BOOKING_STATUS_LABELS, s),
       bookingBadge: (s: string) => BOOKING_STATUS_BADGE[s] ?? 'bg-gray-100 text-gray-600',
       eventType: (t: string) => label(EVENT_TYPE_LABELS, t),
       subscriptionStatus: (s: string) => label(SUBSCRIPTION_STATUS_LABELS, s),
       errorMessage,
       plural,
     }
   }
   ```

3. **Рефакторинг 5.9.2, 5.9.3, 5.9.4** — заменить локальные функции на useLabels:

   ```ts
   // было: function bookingStatusLabel(s) { return {...}[s] }
   // стало:
   const { bookingStatus, bookingBadge, eventType, errorMessage, plural } = useLabels()
   ```

   Удалить дублирующиеся локальные определения.

4. **Sessions plural** — заменить локальный pluralSessions в BookingSheet (5.9.3):
   ```ts
   plural(n, ['занятие', 'занятия', 'занятий'])
   ```

## Критерии приёмки

- ✅ Все label-карты в одном `utils/labels.ts`
- ✅ useLabels composable для template
- ✅ 5.9.2/5.9.3/5.9.4 рефакторены — нет дублирующихся label-функций
- ✅ errorMessage(code) переводит коды ошибок backend
- ✅ plural() корректно склоняет (1 занятие, 2 занятия, 5 занятий)
- ✅ Единый источник правды для переводов

## Подсказки

- **Зачем централизовать:** при добавлении статуса/ошибки правим одно место. Phase 8 (bot) может переиспользовать те же карты.
- **errorMessage fallback** — если код неизвестен, показываем generic, не сырой код.
- **i18n позже:** сейчас хардкод русский. Если понадобится мультиязык (Phase 14+) — эти карты станут основой i18n-словаря.

## Не делать

- ❌ Не подключать i18n-библиотеку (vue-i18n) — Phase 14+ если понадобится
- ❌ Не переводить admin-технические поля (они для организатора)
- ❌ Не делать локали кроме русского
