---
id: '7.7.1'
phase: '7'
epic: '7.7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - FE
depends_on:
  - '7.5.2'
  - '10.3.1'
estimated_hours: '1-2'
tags:
  - credits
  - admin
  - super-admin
---

# Task 7.7.1: Grant credits + confirm/reject заявок (super-admin)

## Цель

Расширить super-admin (10.3): ручной grant credits организации, список заявок на покупку, подтверждение/отклонение.

## Контекст

Решение 7: root-admin = расширенный super-admin. Phase 10.3 дал обзор беты. Phase 7 добавляет управление credits.

## Что должно быть сделано

1. **Admin grant endpoint** `server/api/admin/credits/grant.post.ts`:

   ```ts
   export default defineEventHandler(async (event) => {
     await requireSuperAdmin(event) // 10.3.1
     const ctx = createServiceContextFromEvent(event)
     const { organizationId, quantity, note } = await readBody(event)
     await creditService.addTransaction(ctx, {
       organizationId,
       type: 'admin_grant',
       amount: quantity,
       note: note ?? 'Ручное начисление администратором',
     })
     return { ok: true }
   })
   ```

2. **Заявки endpoints** (из 7.5.2, под super-admin):

   ```
   GET  /api/admin/purchase-requests        → listPending (+ опц история)
   POST /api/admin/purchase-requests/:id/confirm
   POST /api/admin/purchase-requests/:id/reject
   ```

3. **Super-admin UI** (расширить страницу 10.3.1) — секция credits:

   ```vue
   <!-- Заявки на покупку (pending): орг, количество, сумма, [Подтвердить] [Отклонить] -->
   <!-- Ручной grant: выбрать орг, количество, note, [Начислить] -->
   ```

4. **Подтверждение заявки** → grant + уведомление организатору (7.5.2 уже реализует confirmRequest + notify).

5. **Тесты:**
   ```ts
   test('super-admin grants credits (admin_grant)', async () => {})
   test('super-admin confirms purchase request → grant', async () => {})
   test('super-admin rejects request → no grant', async () => {})
   test('non-admin cannot grant/confirm', async () => {})
   ```

## Критерии приёмки

- ✅ Admin grant: ручное начисление (admin_grant tx, с note)
- ✅ Список заявок pending (super-admin)
- ✅ Подтверждение → grant + уведомление организатору
- ✅ Отклонение → rejected
- ✅ UI секция credits в super-admin
- ✅ Только super-admin (10.3.1)
- ✅ Тесты

## Подсказки

- **Расширяем 10.3.1 страницу** — не новый слой. Секция credits рядом с обзором беты.
- **admin_grant для особых случаев** — компенсация, бонус, тест. Отдельно от purchase (через заявку).
- **confirm переиспускает purchaseService.confirmRequest (7.5.1)** — логика там, endpoint тонкий.

## Не делать

- ❌ Не плодить admin-слой (расширяем 10.3)
- ❌ Не давать grant организаторам
