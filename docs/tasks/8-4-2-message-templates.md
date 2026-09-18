---
id: '8.4.2'
phase: '8'
epic: '8.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 8.8.'
roles:
  - BACK
depends_on:
  - '8.4.1'
estimated_hours: '1-2'
tags:
  - notifier
  - templates
  - localization
---

# Task 8.4.2: Шаблоны сообщений + рендеринг

## Цель

Каталог типов уведомлений + шаблоны сообщений (русский, HTML) с подстановкой данных и опциональными кнопками (открыть событие/оплату в Mini App).

## Контекст

Каждое уведомление (8.5) имеет тип и данные. Централизуем рендеринг в одном месте — как labels.ts (5.9.5), единый источник текстов. Шаблоны включают опциональную web_app кнопку (открыть нужный экран Mini App).

## Что должно быть сделано

1. **`apps/web/modules/notifier/templates.ts`:**

   ```ts
   export type NotificationType =
     | 'booking_confirmed'
     | 'booking_waitlisted'
     | 'waitlist_promoted'
     | 'payment_confirmed'
     | 'payment_rejected'
     | 'event_cancelled'
     | 'pending_payment_for_organizer'

   interface RenderedMessage {
     text: string
     keyboard?: { text: string; webAppUrl?: string; url?: string }[][]
   }

   function miniAppUrl(path: string): string {
     const base = useRuntimeConfig().public.miniAppBaseUrl
     return `${base}${path}`
   }

   function esc(s: string): string {
     return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   }

   export function renderMessage(type: NotificationType, p: Record<string, any>): RenderedMessage {
     switch (type) {
       case 'booking_confirmed':
         return {
           text: `✅ Вы записаны на <b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}`,
           keyboard: [
             [
               {
                 text: 'Открыть событие',
                 webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/events/${p.eventId}`),
               },
             ],
           ],
         }

       case 'booking_waitlisted':
         return {
           text: `⏳ Вы в листе ожидания на <b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}\n\nЕсли место освободится, вы автоматически попадёте в состав и получите уведомление.`,
           keyboard: [
             [
               {
                 text: 'Открыть событие',
                 webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/events/${p.eventId}`),
               },
             ],
           ],
         }

       case 'waitlist_promoted':
         return {
           text:
             `🎉 Освободилось место! Вы теперь в составе на <b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}` +
             (p.needsPayment ? `\n\n⚠️ Не забудьте оплатить участие.` : ''),
           keyboard: [
             [
               {
                 text: 'Открыть событие',
                 webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/events/${p.eventId}`),
               },
             ],
           ],
         }

       case 'payment_confirmed':
         return {
           text: `✅ Оплата подтверждена: <b>${esc(p.subject)}</b>\nСумма: ${p.amount}`,
         }

       case 'payment_rejected':
         return {
           text: `❌ Оплата отклонена: <b>${esc(p.subject)}</b>\n\nЗапись отменена. Обратитесь к организатору, если это ошибка.`,
         }

       case 'event_cancelled':
         return {
           text:
             `⛔️ Событие отменено: <b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}` +
             (p.refunded ? `\n\nОплата возвращена / занятие восстановлено на абонементе.` : ''),
         }

       case 'pending_payment_for_organizer':
         return {
           text: `💳 Новая запись ждёт оплаты\n<b>${esc(p.playerName)}</b> — ${esc(p.eventTitle)}\nСумма: ${p.amount} (${p.method})`,
           keyboard: [
             [{ text: 'Подтвердить оплату', webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/payments`) }],
           ],
         }

       default:
         return { text: 'Уведомление' }
     }
   }
   ```

2. **Хелперы форматирования** (дата для уведомлений) — переиспользовать формат из useFormatters или продублировать серверный вариант (composable недоступен на сервере):

   ```ts
   export function formatEventDateForNotify(iso: string): string {
     return new Date(iso).toLocaleString('ru-RU', {
       day: 'numeric',
       month: 'long',
       hour: '2-digit',
       minute: '2-digit',
     })
   }
   export function formatPriceForNotify(minor: number, currency: string): string {
     return minor === 0 ? 'Бесплатно' : `${(minor / 100).toFixed(2)} ${currency}`
   }
   ```

   Вызывающий код (8.5) форматирует данные перед передачей в payload, либо рендер делает это сам.

3. **Тесты:**
   ```ts
   test('booking_confirmed renders title and date with keyboard', () => {})
   test('waitlist_promoted includes payment warning when needsPayment', () => {})
   test('event_cancelled mentions refund when refunded', () => {})
   test('pending_payment_for_organizer has confirm keyboard', () => {})
   test('escapes HTML in user-provided titles', () => {})
   test('unknown type → fallback text', () => {})
   ```

## Критерии приёмки

- ✅ NotificationType enum со всеми типами (8.5 уведомления)
- ✅ renderMessage возвращает text (HTML) + опц keyboard
- ✅ booking_confirmed/waitlisted/promoted: текст + кнопка открыть событие
- ✅ waitlist_promoted: предупреждение об оплате если needsPayment
- ✅ payment_confirmed/rejected: суть + (rejected) пояснение
- ✅ event_cancelled: упоминание возврата если refunded
- ✅ pending_payment_for_organizer: кнопка «Подтвердить оплату» → /payments
- ✅ HTML-экранирование пользовательских данных (esc)
- ✅ Тесты рендеринга всех типов

## Подсказки

- **Централизация как labels.ts** — единый источник текстов. При изменении формулировки правим одно место.
- **web_app кнопки в уведомлениях** — клик ведёт прямо на нужный экран Mini App (событие, оплаты). Очень удобно (промоутнутый игрок сразу открывает событие).
- **esc обязателен** — eventTitle/playerName от пользователей, могут содержать <>&. HTML parse_mode требует экранирования.
- **Форматирование на сервере** — useFormatters это composable (клиент). Для notifier нужны серверные функции (продублировать формат).
- **needsPayment в promoted** — если промоутнули cash-бронь в pending_payment, напомнить про оплату.

## Не делать

- ❌ Не делать i18n (русский MVP, карты — основа для будущего)
- ❌ Не делать богатое форматирование (картинки, и т.д.) — текст + кнопка
- ❌ Не слать без экранирования пользовательских данных
