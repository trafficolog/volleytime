import { and, eq, venues, type Venue } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import { VenueNotFoundError } from './errors'
import {
  CreateVenueInput,
  UpdateVenueInput,
  type CreateVenueInput as CreateInput,
  type UpdateVenueInput as UpdateInput,
} from './schemas'

export const venueService = {
  async create(ctx: ServiceContext, input: CreateInput): Promise<Venue> {
    const data = CreateVenueInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const [venue] = await getDb(tx)
        .insert(venues)
        .values({
          organizationId: data.organizationId,
          name: data.name,
          address: data.address ?? null,
          capacityHint: data.capacityHint ?? null,
          notes: data.notes ?? null,
        })
        .returning()
      await auditService.record(tx, {
        organizationId: venue!.organizationId,
        action: AUDIT_ACTIONS.VENUE_CREATED,
        entityType: 'venue',
        entityId: venue!.id,
        newValue: { name: venue!.name },
      })
      return venue!
    })
  },

  async getById(ctx: ServiceContext, venueId: number): Promise<Venue> {
    const v = await getDb(ctx).query.venues.findFirst({ where: eq(venues.id, venueId) })
    if (!v) throw new VenueNotFoundError(venueId)
    return v
  },

  async listByOrg(ctx: ServiceContext, orgId: number, includeArchived = false): Promise<Venue[]> {
    const db = getDb(ctx)
    const where = includeArchived
      ? eq(venues.organizationId, orgId)
      : and(eq(venues.organizationId, orgId), eq(venues.status, 'active'))
    return db.query.venues.findMany({
      where,
      orderBy: (v, { asc }) => [asc(v.name)],
    })
  },

  async update(ctx: ServiceContext, venueId: number, input: UpdateInput): Promise<Venue> {
    const data = UpdateVenueInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, venueId)
      const [updated] = await getDb(tx)
        .update(venues)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(venues.id, venueId))
        .returning()
      await auditService.record(tx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.VENUE_UPDATED,
        entityType: 'venue',
        entityId: venueId,
        newValue: data,
      })
      return updated!
    })
  },

  async archive(ctx: ServiceContext, venueId: number): Promise<Venue> {
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, venueId)
      const [archived] = await getDb(tx)
        .update(venues)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(venues.id, venueId))
        .returning()
      await auditService.record(tx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.VENUE_ARCHIVED,
        entityType: 'venue',
        entityId: venueId,
      })
      return archived!
    })
  },
}
