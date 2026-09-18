---
id: '5.1.1'
phase: '5'
epic: '5.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
  - DB
depends_on:
  - '4.5.2'
estimated_hours: '1-2'
tags:
  - drizzle
  - schema
  - venues
---

# Task 5.1.1: Schema venues + VenueService

## Цель

Создать таблицу `venues` (площадки, scoped by organization) и VenueService с CRUD.

## Контекст

Venue — опциональная сущность. Event может ссылаться на venue_id или иметь только location_text. Организатор с постоянным залом создаёт venue раз и переиспользует.

## Что должно быть сделано

1. **`packages/db/src/schema/venues.ts`:**

   ```ts
   import { pgTable, serial, integer, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
   import { organizations } from './organizations'

   export const venueStatusEnum = pgEnum('venue_status', ['active', 'archived'])

   export const venues = pgTable(
     'venues',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       name: text('name').notNull(),
       address: text('address'),
       capacityHint: integer('capacity_hint'), // подсказка вместимости, не enforced
       notes: text('notes'),
       status: venueStatusEnum('status').notNull().default('active'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgIdx: index('venues_org_idx').on(t.organizationId),
     }),
   )

   export type Venue = typeof venues.$inferSelect
   export type NewVenue = typeof venues.$inferInsert
   ```

2. **Обновить `schema/index.ts`** и **`relations.ts`:**

   ```ts
   export * from './venues'

   // relations.ts
   export const venuesRelations = relations(venues, ({ one }) => ({
     organization: one(organizations, {
       fields: [venues.organizationId],
       references: [organizations.id],
     }),
   }))
   ```

3. **Миграция:**

   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

4. **Модуль `apps/web/modules/venues/`:**

   ```
   venues/
   ├── service.ts
   ├── repository.ts
   ├── schemas.ts
   ├── errors.ts
   └── index.ts
   ```

5. **`schemas.ts`:**

   ```ts
   import { z } from 'zod'

   export const CreateVenueInput = z.object({
     name: z.string().min(2).max(120),
     address: z.string().max(300).optional(),
     capacityHint: z.number().int().positive().max(1000).optional(),
     notes: z.string().max(1000).optional(),
   })
   export type CreateVenueInput = z.infer<typeof CreateVenueInput>

   export const UpdateVenueInput = CreateVenueInput.partial()
   export type UpdateVenueInput = z.infer<typeof UpdateVenueInput>
   ```

6. **`errors.ts`:**

   ```ts
   export class VenueError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'VenueError'
     }
   }
   export class VenueNotFoundError extends VenueError {
     constructor(id: number | string) {
       super('venue.not_found', `Venue ${id} not found`)
     }
   }
   ```

7. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import { venues, type Venue, type NewVenue } from '@volley-time/db'
   import { eq, and, ne } from 'drizzle-orm'

   export const venueRepository = {
     async create(db: DB, data: NewVenue): Promise<Venue> {
       const [v] = await db.insert(venues).values(data).returning()
       if (!v) throw new Error('Failed to create venue')
       return v
     },
     async getById(db: DB, id: number): Promise<Venue | null> {
       return (await db.query.venues.findFirst({ where: eq(venues.id, id) })) ?? null
     },
     async listByOrg(db: DB, orgId: number): Promise<Venue[]> {
       return db.query.venues.findMany({
         where: and(eq(venues.organizationId, orgId), ne(venues.status, 'archived')),
         orderBy: (v, { asc }) => [asc(v.name)],
       })
     },
     async update(db: DB, id: number, data: Partial<NewVenue>): Promise<Venue> {
       const [v] = await db
         .update(venues)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(venues.id, id))
         .returning()
       if (!v) throw new Error(`Venue ${id} not found`)
       return v
     },
   }
   ```

8. **`service.ts`:**

   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { venueRepository } from './repository'
   import { CreateVenueInput, UpdateVenueInput } from './schemas'
   import { VenueNotFoundError } from './errors'

   export const venueService = {
     async create(ctx: ServiceContext, orgId: number, input: CreateVenueInput) {
       const parsed = CreateVenueInput.parse(input)
       return venueRepository.create(getDb(ctx), { organizationId: orgId, ...parsed })
     },
     async list(ctx: ServiceContext, orgId: number) {
       return venueRepository.listByOrg(getDb(ctx), orgId)
     },
     async getById(ctx: ServiceContext, id: number) {
       const v = await venueRepository.getById(getDb(ctx), id)
       if (!v) throw new VenueNotFoundError(id)
       return v
     },
     async update(ctx: ServiceContext, id: number, input: UpdateVenueInput) {
       const parsed = UpdateVenueInput.parse(input)
       await this.getById(ctx, id)
       return venueRepository.update(getDb(ctx), id, parsed)
     },
     async archive(ctx: ServiceContext, id: number) {
       await this.getById(ctx, id)
       return venueRepository.update(getDb(ctx), id, { status: 'archived' })
     },
   }
   ```

9. **`index.ts`** — публичный экспорт.

## Критерии приёмки

- ✅ Таблица venues создана, FK на organizations с cascade
- ✅ VenueService CRUD работает
- ✅ listByOrg возвращает только active, отсортированные по name
- ✅ archive — soft-delete (status archived), скрыт из list
- ✅ Zod-валидация (name 2-120 символов)
- ✅ Venue с историей событий не удаляется физически
- ✅ Smoke-тест: create → list → archive

## Подсказки

- **capacityHint** — это подсказка, не enforced. Реальная вместимость события задаётся в event.capacity (5.2). Venue только напоминает «в этом зале обычно 16 человек».
- **Cross-org проверка venue_id при создании event** — будет в EventService (5.2.2): venue должен принадлежать той же org.

## Не делать

- ❌ Не делать геолокацию/карты — Phase 14+
- ❌ Не делать проверку конфликтов расписания venue — Phase 15+
- ❌ Не делать фото — Phase 14+
