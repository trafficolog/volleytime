---
id: '5.4.1'
phase: '5'
epic: '5.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
  - DB
depends_on:
  - '4.5.2'
estimated_hours: '1-2'
tags:
  - drizzle
  - schema
  - subscription-plans
---

# Task 5.4.1: Schema subscription_plans + Service

## Цель

Таблица `subscription_plans` (шаблоны абонементов, per-org) + SubscriptionPlanService с CRUD.

## Контекст

Plan — шаблон, на основе которого создаётся Subscription (5.5). Решение 11: total_sessions (обяз) + validity_days (опц, null=бессрочно) + price (может быть 0).

## Что должно быть сделано

1. **`packages/db/src/schema/subscription-plans.ts`:**

   ```ts
   import {
     pgTable,
     serial,
     integer,
     text,
     timestamp,
     pgEnum,
     varchar,
     boolean,
     index,
   } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'

   export const planStatusEnum = pgEnum('plan_status', ['active', 'archived'])

   export const subscriptionPlans = pgTable(
     'subscription_plans',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       name: text('name').notNull(),
       description: text('description'),
       totalSessions: integer('total_sessions').notNull(),
       validityDays: integer('validity_days'), // null = бессрочно
       price: integer('price').notNull().default(0), // мин. единицы, 0 = бесплатно
       currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
       status: planStatusEnum('status').notNull().default('active'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgIdx: index('subscription_plans_org_idx').on(t.organizationId),
     }),
   )

   export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect
   export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert
   ```

2. **Schema index + relations + миграция.**

3. **Модуль `apps/web/modules/subscription-plans/`:**

   ```ts
   // schemas.ts
   export const CreatePlanInput = z.object({
     name: z.string().min(2).max(120),
     description: z.string().max(500).optional(),
     totalSessions: z.number().int().positive().max(1000),
     validityDays: z.number().int().positive().max(3650).nullable().optional(),
     price: z.number().int().min(0),
     currency: z.string().length(3).default('BYN'),
   })
   export const UpdatePlanInput = CreatePlanInput.partial()
   ```

4. **`errors.ts`:** PlanError, PlanNotFoundError (`plan.not_found`).

5. **`service.ts`:** create, list (active only), getById, update, archive. Стандартный CRUD-паттерн (как venues 5.1.1).
   ```ts
   export const subscriptionPlanService = {
     async create(ctx, orgId, input) {
       const parsed = CreatePlanInput.parse(input)
       return planRepository.create(getDb(ctx), {
         organizationId: orgId,
         ...parsed,
         validityDays: parsed.validityDays ?? null,
       })
     },
     async list(ctx, orgId) {
       return planRepository.listByOrg(getDb(ctx), orgId)
     },
     async getById(ctx, id) {
       /* + PlanNotFoundError */
     },
     async update(ctx, id, input) {
       /* archived plan можно редактировать? нет — проверка */
     },
     async archive(ctx, id) {
       return planRepository.update(getDb(ctx), id, { status: 'archived' })
     },
   }
   ```

## Критерии приёмки

- ✅ Таблица создана, FK на org cascade
- ✅ totalSessions NOT NULL, validityDays nullable, price default 0
- ✅ CRUD работает, list возвращает только active
- ✅ Бесплатный план (price=0) создаётся
- ✅ archive — soft-delete
- ✅ Существующие subscriptions на archived plan продолжают работать (проверяется в 5.5)
- ✅ Smoke-тест

## Подсказки

- **validityDays на уровне plan** определяет, на сколько дней активируется subscription. Расчёт expires_at — при активации (5.5.2), не при создании плана.
- **Бесплатные планы:** госорганизация со своим залом может дать «абонемент» с price=0 — платформа как организационный инструмент.
- **price в минимальных единицах** — как в events (5.2.1).

## Не делать

- ❌ Не делать unlimited (session-based только)
- ❌ Не делать promo/discount — Phase 14+
- ❌ Не делать tiered pricing
