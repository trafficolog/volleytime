---
id: '4.1.2'
phase: '4'
epic: '4.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '4.1.1'
  - '4.2.1'
estimated_hours: '2'
tags:
  - service
  - organizations
  - modulith
---

# Task 4.1.2: OrganizationService (create, list, update, archive)

## Цель

Создать модуль `apps/web/modules/organizations/` с сервисом для CRUD операций. Включает: создание (транзакционное с auto-creation owner member), список для user, обновление настроек, archive.

## Контекст

Сервис — основной API для работы с organizations. Используется в API endpoints (4.1.3) и в других модулях.

`create` — транзакционная операция: создаёт organization + первого member со ролью owner в одной транзакции. Если что-то падает — оба роллбекаются.

## Что должно быть сделано

1. **Структура модуля:**

   ```
   apps/web/modules/organizations/
   ├── service.ts
   ├── repository.ts
   ├── schemas.ts        # Zod-validation
   ├── errors.ts
   └── index.ts
   ```

2. **`schemas.ts`** — Zod-схемы:

   ```ts
   import { z } from 'zod'

   export const CreateOrganizationInput = z.object({
     name: z.string().min(2).max(100),
     slug: z
       .string()
       .min(2)
       .max(64)
       .regex(/^[a-z0-9-]+$/)
       .optional(),
     description: z.string().max(500).optional(),
     city: z.string().max(100).optional(),
     defaultMemberStatus: z.enum(['active', 'pending']).optional(),
   })
   export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInput>

   export const UpdateOrganizationInput = z.object({
     name: z.string().min(2).max(100).optional(),
     description: z.string().max(500).nullable().optional(),
     city: z.string().max(100).nullable().optional(),
     defaultMemberStatus: z.enum(['active', 'pending']).optional(),
     defaultCurrency: z.string().length(3).optional(),
     defaultTimezone: z.string().max(64).optional(),
   })
   export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>
   ```

3. **`errors.ts`:**

   ```ts
   export class OrganizationError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'OrganizationError'
     }
   }

   export class OrganizationNotFoundError extends OrganizationError {
     constructor(orgId: number | string) {
       super('organization.not_found', `Organization ${orgId} not found`)
     }
   }

   export class OrganizationArchivedError extends OrganizationError {
     constructor() {
       super('organization.archived', 'Organization is archived')
     }
   }

   export class SlugTakenError extends OrganizationError {
     constructor(slug: string) {
       super('organization.slug_taken', `Slug "${slug}" is already taken`)
     }
   }
   ```

4. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import { organizations, type Organization, type NewOrganization } from '@volley-time/db'
   import { eq, and, ne } from 'drizzle-orm'

   export const organizationRepository = {
     async create(db: DB, data: NewOrganization): Promise<Organization> {
       const [org] = await db.insert(organizations).values(data).returning()
       if (!org) throw new Error('Failed to create organization')
       return org
     },

     async getById(db: DB, id: number): Promise<Organization | null> {
       const org = await db.query.organizations.findFirst({
         where: eq(organizations.id, id),
       })
       return org ?? null
     },

     async getBySlug(db: DB, slug: string): Promise<Organization | null> {
       const org = await db.query.organizations.findFirst({
         where: eq(organizations.slug, slug),
       })
       return org ?? null
     },

     async listByOwner(db: DB, userId: number): Promise<Organization[]> {
       return db.query.organizations.findMany({
         where: and(eq(organizations.ownerUserId, userId), ne(organizations.status, 'archived')),
         orderBy: (o, { desc }) => [desc(o.createdAt)],
       })
     },

     async update(db: DB, id: number, data: Partial<NewOrganization>): Promise<Organization> {
       const [org] = await db
         .update(organizations)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(organizations.id, id))
         .returning()
       if (!org) throw new Error(`Organization ${id} not found`)
       return org
     },
   }
   ```

5. **`service.ts`:**

   ```ts
   import { db as defaultDb } from '@volley-time/db'
   import { organizationRepository } from './repository'
   import { generateUniqueSlug } from './slug' // см. 4.1.4
   import { CreateOrganizationInput, UpdateOrganizationInput } from './schemas'
   import { OrganizationNotFoundError, OrganizationArchivedError } from './errors'
   import { memberService } from '../members/service' // см. 4.2.2

   export interface ServiceContext {
     userId: number
     db?: typeof defaultDb
   }

   export const organizationService = {
     /**
      * Create organization + auto-create owner member.
      * Transactional: both records or none.
      */
     async create(ctx: ServiceContext, input: CreateOrganizationInput) {
       const parsed = CreateOrganizationInput.parse(input)
       const db = ctx.db ?? defaultDb

       return await db.transaction(async (tx) => {
         // Generate or validate slug
         const slug = parsed.slug ?? (await generateUniqueSlug(tx, parsed.name))

         // Create org
         const org = await organizationRepository.create(tx, {
           slug,
           name: parsed.name,
           description: parsed.description,
           city: parsed.city,
           ownerUserId: ctx.userId,
           defaultMemberStatus: parsed.defaultMemberStatus ?? 'active',
         })

         // Auto-create owner member (через memberService)
         await memberService.addMember(
           { userId: ctx.userId, db: tx },
           {
             organizationId: org.id,
             userId: ctx.userId,
             role: 'owner',
             status: 'active',
           },
         )

         return org
       })
     },

     async listForUser(ctx: ServiceContext): Promise<Organization[]> {
       const db = ctx.db ?? defaultDb
       // Joins через memberService — все org, где user активный member
       return memberService.listOrgsForUser(ctx)
     },

     async getById(ctx: ServiceContext, orgId: number) {
       const db = ctx.db ?? defaultDb
       const org = await organizationRepository.getById(db, orgId)
       if (!org) throw new OrganizationNotFoundError(orgId)
       return org
     },

     async updateSettings(ctx: ServiceContext, orgId: number, input: UpdateOrganizationInput) {
       const parsed = UpdateOrganizationInput.parse(input)
       const db = ctx.db ?? defaultDb
       const org = await this.getById(ctx, orgId)
       if (org.status === 'archived') throw new OrganizationArchivedError()
       return organizationRepository.update(db, orgId, parsed)
     },

     async archive(ctx: ServiceContext, orgId: number) {
       const db = ctx.db ?? defaultDb
       const org = await this.getById(ctx, orgId)
       if (org.status === 'archived') return org // idempotent
       return organizationRepository.update(db, orgId, { status: 'archived' })
     },
   }
   ```

6. **`index.ts`** — публичный API:
   ```ts
   export { organizationService } from './service'
   export type { CreateOrganizationInput, UpdateOrganizationInput } from './schemas'
   export {
     OrganizationError,
     OrganizationNotFoundError,
     OrganizationArchivedError,
     SlugTakenError,
   } from './errors'
   ```

## Критерии приёмки

- ✅ `organizationService.create(ctx, input)` создаёт organization + owner OrganizationMember в одной транзакции
- ✅ При rollback transactionа — никаких partial данных в БД
- ✅ `listForUser` возвращает только active организации user'а
- ✅ Archived организации скрыты из list, но доступны через `getById` (для history)
- ✅ Zod-валидация работает: невалидный input выбрасывает ошибку с понятным message
- ✅ `slug` уникальный — если пытаемся создать с занятым slug, выбрасывается `SlugTakenError`
- ✅ Если slug не указан — auto-generates через `generateUniqueSlug` (см. 4.1.4)
- ✅ TypeScript типы строгие (никаких `any`)

## Подсказки

- **Транзакции в Drizzle:** `db.transaction(async (tx) => { ... })`. Внутри tx — все queries атомарны. Передавай `tx` в repository functions.
- **Importing memberService from another module** — это normal pattern в modulith (через public service interface). Но осторожно с circular deps: `members` не должен импортировать `organizations`.
- **`ServiceContext`** — паттерн из MODULITH_ARCHITECTURE.md. Каждая service-функция принимает context с userId и optional db (для transactions).
- **Permissions check** — здесь не делаем! Это responsibility middleware (4.5) + permissions module (4.3). Service просто выполняет логику предполагая что вызывающий уже проверил права.

## Не делать

- ❌ Не делать permission checks внутри service — отдельный модуль 4.3
- ❌ Не делать аудит-логгинг здесь — это в Phase 4.6 wrap'ит сервис снаружи
- ❌ Не делать notifications — Phase 8
- ❌ Не валидировать business rules типа «у user'а уже есть 100 org» — Phase 7+
- ❌ Не использовать ORM transactions без понимания async pitfalls — все await'ы внутри tx обязательны
