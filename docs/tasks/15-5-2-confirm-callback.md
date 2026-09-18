---
id: '15.5.2'
phase: '15'
epic: '15.5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.5.1'
  - '8.3.1'
estimated_hours: '1-2'
tags:
  - waitlist
  - confirm-flow
  - bot
---

# Task 15.5.2: Inline-confirm callback (bot) + переход в состав

## Цель

Inline-кнопка «Подтверждаю участие» в уведомлении-предложении. Bot callback: при подтверждении → offered переходит в состав (confirmed / pending_payment по методу). Снятие TTL-задачи.

## Контекст

Решение 6: игрок жмёт кнопку в Telegram → попадает в состав. Bot обрабатывает callback_query. Учитывает метод оплаты (как обычная booking: subscription/free → confirmed, cash → pending_payment).

## Что должно быть сделано

1. **Inline-кнопка в уведомлении waitlist_offer (15.5.1 / templates 8.4.2):**

   ```ts
   case 'waitlist_offer':
     return {
       text: `🎉 Освободилось место!\n<b>${esc(p.eventTitle)}</b>\n\n` +
             `Подтвердите участие в течение ${p.expiresMinutes} мин, иначе место уйдёт следующему.`,
       keyboard: [[
         { text: '✅ Подтверждаю участие', callbackData: `wl_confirm:${p.bookingId}` },
       ]],
     }
   ```

   (notifier поддержка callbackData кнопок — расширить transport 8.4.1 если только webApp/url были)

2. **Bot callback handler `apps/bot/src/handlers/waitlist-confirm.ts`:**

   ```ts
   import { Composer } from 'grammy'

   const composer = new Composer<BotContext>()

   composer.callbackQuery(/^wl_confirm:(\d+)$/, async (ctx) => {
     const bookingId = Number(ctx.match[1])
     try {
       const result = await bookingService.confirmWaitlistOffer(serviceCtx(ctx), bookingId)
       if (result.status === 'expired') {
         await ctx.answerCallbackQuery({
           text: 'Предложение истекло, место уже предложено другому.',
         })
       } else {
         await ctx.answerCallbackQuery({
           text:
             result.status === 'pending_payment'
               ? 'Вы в составе! Не забудьте оплатить участие.'
               : 'Вы в составе!',
         })
       }
       await ctx.editMessageReplyMarkup() // убрать кнопку
     } catch (e) {
       await ctx.answerCallbackQuery({ text: 'Ошибка. Попробуйте открыть приложение.' })
     }
   })

   export default composer
   ```

3. **confirmWaitlistOffer (bookingService):**

   ```ts
   async confirmWaitlistOffer(ctx, bookingId: number) {
     return await db.transaction(async (tx) => {
       const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
       if (!booking) throw new BookingError('booking_not_found', ...)
       // актуальность: offer ещё активен?
       if (booking.status !== 'offered') {
         return { status: 'expired' }  // TTL истёк / уже обработано
       }
       if (booking.offerExpiresAt && booking.offerExpiresAt < new Date()) {
         return { status: 'expired' }
       }

       // перевод в состав по методу (как обычная booking)
       const newStatus = (booking.method === 'subscription' || booking.method === 'free' || isPaid)
         ? 'confirmed' : 'pending_payment'
       await tx.update(bookings).set({
         status: newStatus, offerExpiresAt: null,
         confirmedAt: newStatus === 'confirmed' ? new Date() : null,
         updatedAt: new Date(),
       }).where(eq(bookings.id, bookingId))

       // снять TTL-задачу (offer подтверждён)
       await cancelWaitlistOfferTtl(booking.eventId, bookingId)

       // если cash/subscription — создать payment / consume session (как book)
       // ... интеграция с payment (6.3) / subscription consume (5.5) ...

       return { status: newStatus }
     })
   }
   ```

4. **Снятие TTL** — подтверждённый offer не должен истечь (cancelWaitlistOfferTtl).

5. **Edge: TTL истёк между показом и нажатием** — booking уже не offered (TTL handler перевёл дальше) → «истекло». Idempotent.

6. **Тесты:**
   ```ts
   test('confirm offer → confirmed (subscription/free)', async () => {})
   test('confirm offer cash → pending_payment + payment created', async () => {})
   test('confirm expired offer → expired status', async () => {})
   test('confirm cancels TTL job', async () => {})
   test('double confirm → idempotent (second sees not offered)', async () => {})
   ```

## Критерии приёмки

- ✅ Inline-кнопка «Подтверждаю» в waitlist_offer
- ✅ Bot callback wl_confirm:<bookingId>
- ✅ confirmWaitlistOffer: offered → confirmed/pending_payment по методу
- ✅ Payment/subscription интеграция (как обычная booking)
- ✅ TTL-задача снимается при подтверждении
- ✅ Истёкший offer → «expired» (idempotent)
- ✅ Кнопка убирается после нажатия
- ✅ Тесты

## Подсказки

- **callbackData кнопки** — bot обрабатывает нажатие (callback_query), в отличие от webApp/url кнопок. Расширить notifier transport (8.4.1) поддержкой callbackData если не было.
- **Метод определяет статус** — как обычная booking (5.3.2): subscription/free/оплачено → confirmed, cash → pending_payment. Переиспользовать логику.
- **Снять TTL при confirm** — иначе TTL handler (15.5.3) сработает и переведёт место следующему, хотя игрок подтвердил. Race — снимаем задачу.
- **Idempotency** — двойное нажатие / нажатие после истечения → проверка status==offered. Не offered → expired.

## Не делать

- ❌ Не переводить в состав если offer истёк
- ❌ Не забыть снять TTL при confirm (race с TTL handler)
- ❌ Не дублировать payment/session при двойном нажатии
