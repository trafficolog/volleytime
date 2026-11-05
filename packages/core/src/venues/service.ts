import { and, eq, eventSeries, events, sql, venues, type Venue } from '@volley-time/db'

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

  /** С `orgId` зал чужой группы «не найден» (21.2.13, IDOR); без него поиск по всей базе. */
  async getById(ctx: ServiceContext, venueId: number, orgId?: number): Promise<Venue> {
    const v = await getDb(ctx).query.venues.findFirst({
      where:
        orgId === undefined
          ? eq(venues.id, venueId)
          : and(eq(venues.id, venueId), eq(venues.organizationId, orgId)),
    })
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

  async update(
    ctx: ServiceContext,
    venueId: number,
    input: UpdateInput,
    orgId?: number,
  ): Promise<Venue> {
    const data = UpdateVenueInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, venueId, orgId)
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

  async archive(ctx: ServiceContext, venueId: number, orgId?: number): Promise<Venue> {
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, venueId, orgId)
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

  /**
   * «Удалить» зал (21.2.13): с событиями или серией — архив (события сохраняют зал и название),
   * без них — физическое удаление. Правило `ON DELETE SET NULL` у событий не задействуется.
   */
  async remove(
    ctx: ServiceContext,
    venueId: number,
    orgId: number,
  ): Promise<{ outcome: 'deleted' | 'archived'; venue: Venue }> {
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      // строка зала под блокировкой: проверка использования и удаление не разъезжаются
      const [existing] = await db
        .select()
        .from(venues)
        .where(and(eq(venues.id, venueId), eq(venues.organizationId, orgId)))
        .for('update')
      if (!existing) throw new VenueNotFoundError(venueId)

      const [inEvents] = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.venueId, venueId))
        .limit(1)
      const [inSeries] = inEvents
        ? []
        : await db
            .select({ id: eventSeries.id })
            .from(eventSeries)
            .where(
              and(
                eq(eventSeries.organizationId, orgId),
                sql`(${eventSeries.template} ->> 'venueId') = ${String(venueId)}`,
              ),
            )
            .limit(1)

      if (inEvents || inSeries) {
        if (existing.status === 'archived') return { outcome: 'archived' as const, venue: existing }
        return { outcome: 'archived' as const, venue: await this.archive(tx, venueId, orgId) }
      }

      await db.delete(venues).where(eq(venues.id, venueId))
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.VENUE_DELETED,
        entityType: 'venue',
        entityId: venueId,
        oldValue: { name: existing.name },
      })
      return { outcome: 'deleted' as const, venue: existing }
    })
  },
}
