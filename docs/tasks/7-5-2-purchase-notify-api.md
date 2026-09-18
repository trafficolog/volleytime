---
id: '7.5.2'
phase: '7'
epic: '7.5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.5.1'
  - '8.4.1'
estimated_hours: '1-2'
tags:
  - credits
  - purchase
  - api
  - notifier
---

# Task 7.5.2: Уведомление root-админу + API endpoints

## Цель

API endpoints для заявок (создать — организатор; список/confirm/reject — root). Уведомление root-админу о новой заявке (через notifier/служебный канал).

## Контекст

Решение 5: root-admin получает уведомление о заявке, согласует оплату, подтверждает. Переиспользует notifier transport (8.4.1) для уведомления в служебный канал.

## Что должно быть сделано

1. **API организатора** `server/api/organizations/[orgId]/credits/purchase.post.ts`:

   ```ts
   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member) // организатор
     const ctx = createServiceContextFromEvent(event)
     const { quantity } = await readBody(event)
     const req = await purchaseService.createRequest(ctx, event.context.organization!.id, quantity)

     // уведомить root-админа (после создания, fire-and-forget)
     notifyAdminNewPurchaseRequest(req) // через служебный канал

     return { request: req }
   })
   ```

2. **Уведомление root-админу** — в служебный канал (как feedback 10.2.1):

   ```ts
   async function notifyAdminNewPurchaseRequest(req) {
     const message =
       `💰 <b>Заявка на покупку credits</b>\n` +
       `Организация: ${req.organizationId}\n` +
       `Количество: ${req.quantity}\n` +
       `Сумма: ${formatPriceForNotify(req.priceAmount, 'BYN')}\n` +
       `Заявка #${req.id}\n\n` +
       `Подтвердить после получения оплаты в админ-панели.`
     // через bot internal transport (8.4.1) в ADMIN_CHAT_ID
     await sendToServiceChannel({ chatId: config.adminChatId, text: message })
   }
   ```

3. **API root-admin** (super-admin guard 10.3.1):

   ```
   GET  /api/admin/purchase-requests          → listPending
   POST /api/admin/purchase-requests/:id/confirm
   POST /api/admin/purchase-requests/:id/reject  { reason? }
   ```

   ```ts
   // confirm endpoint
   export default defineEventHandler(async (event) => {
     await requireSuperAdmin(event) // 10.3.1
     const ctx = createServiceContextFromEvent(event)
     const id = Number(getRouterParam(event, 'id'))
     const req = await purchaseService.confirmRequest(ctx, id)
     // уведомить организатора (credits начислены)
     notifierService.send(req.requestedByUserId, 'credits_purchased', {
       quantity: req.quantity,
     })
     return { request: req }
   })
   ```

4. **Уведомление организатору при подтверждении** — credits_purchased (добавить в notifier templates 8.4.2):

   ```ts
   case 'credits_purchased':
     return { text: `✅ Начислено ${p.quantity} credits. Можно создавать события.` }
   ```

5. **error codes** в handle-errors: request_not_found (404), request_not_pending (409), invalid_quantity (422).

6. **Тесты:**
   ```ts
   test('organizer creates purchase request via API', async () => {})
   test('admin notified on new request', async () => {})
   test('super-admin confirms → credits granted + organizer notified', async () => {})
   test('non-admin cannot confirm', async () => {})
   ```

## Критерии приёмки

- ✅ Организатор: POST purchase (создать заявку, только canManageContent)
- ✅ Уведомление root-админу в служебный канал (новая заявка)
- ✅ Root-admin: list/confirm/reject (super-admin guard)
- ✅ confirm → grant credits + уведомление организатору (credits_purchased)
- ✅ Не-admin → 403 на admin endpoints
- ✅ Error codes (not_found, not_pending)
- ✅ Тесты

## Подсказки

- **Уведомление root-админу** — переиспускает служебный канал (как feedback 10.2.1). ADMIN_CHAT_ID env. Ты сразу видишь заявку в Telegram.
- **Уведомление организатору при confirm** — credits_purchased через notifier (8.4). Организатор узнаёт что credits начислены, может создавать события.
- **super-admin guard** (10.3.1 requireSuperAdmin) на admin endpoints. Расширяется в 7.7.
- **Поток:** организатор заявка → ты видишь в Telegram → согласуете оплату (перевод) → confirm в админке → credits + организатор уведомлён.

## Не делать

- ❌ Не делать online-оплату (Phase 12)
- ❌ Не давать confirm не-админам
- ❌ Не начислять до confirm
