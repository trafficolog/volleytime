import { and, asc, eq, scheduleSlots, sql, venues, type ScheduleSlot } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { assertVenueInOrg } from '../events/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import { ScheduleSlotLimitError, ScheduleSlotNotFoundError } from './errors'
import {
  CreateScheduleSlotInput,
  SCHEDULE_SLOTS_MAX,
  UpdateScheduleSlotInput,
  type ScheduleSlotView,
} from './schemas'

const viewColumns = {
  id: scheduleSlots.id,
  weekday: scheduleSlots.weekday,
  startTime: scheduleSlots.startTime,
  durationMinutes: scheduleSlots.durationMinutes,
  title: scheduleSlots.title,
  type: scheduleSlots.type,
  capacity: scheduleSlots.capacity,
  venueId: scheduleSlots.venueId,
  venueName: venues.name,
  venueStatus: venues.status,
}

function toView(row: {
  id: number
  weekday: number
  startTime: string
  durationMinutes: number
  title: string
  type: string
  capacity: number
  venueId: number | null
  venueName: string | null
  venueStatus: string | null
}): ScheduleSlotView {
  return {
    id: row.id,
    weekday: row.weekday,
    startTime: row.startTime,
    durationMinutes: row.durationMinutes,
    title: row.title,
    type: row.type as ScheduleSlotView['type'],
    capacity: row.capacity,
    venueId: row.venueId,
    venueName: row.venueName,
    venueArchived: row.venueStatus === 'archived',
  }
}

/**
 * Шаблоны слотов расписания группы (21.2.12). Слот только хранит значения, которыми форма
 * создания события и серии заполняет поля; событий и списаний баланса сервис не создаёт.
 * Все операции ограничены группой: чужой слот «не найден» (IDOR). Зал слота — активный зал той же
 * группы; архивный зал выбрать нельзя (`event.venue_archived`), но слот, уже указывающий на
 * позднее архивированный зал, остаётся правимым, пока зал в запросе не меняется.
 */
export const scheduleSlotService = {
  async list(ctx: ServiceContext, orgId: number): Promise<ScheduleSlotView[]> {
    const rows = await getDb(ctx)
      .select(viewColumns)
      .from(scheduleSlots)
      .leftJoin(venues, eq(venues.id, scheduleSlots.venueId))
      .where(eq(scheduleSlots.organizationId, orgId))
      .orderBy(asc(scheduleSlots.weekday), asc(scheduleSlots.startTime), asc(scheduleSlots.id))
    return rows.map(toView)
  },

  async getById(ctx: ServiceContext, orgId: number, slotId: number): Promise<ScheduleSlotView> {
    const [row] = await getDb(ctx)
      .select(viewColumns)
      .from(scheduleSlots)
      .leftJoin(venues, eq(venues.id, scheduleSlots.venueId))
      .where(and(eq(scheduleSlots.id, slotId), eq(scheduleSlots.organizationId, orgId)))
    if (!row) throw new ScheduleSlotNotFoundError(slotId)
    return toView(row)
  },

  async create(ctx: ServiceContext, orgId: number, input: unknown): Promise<ScheduleSlotView> {
    const data = CreateScheduleSlotInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      // потолок проверяется под замком группы: параллельные добавления его не превысят
      await db.execute(sql`SELECT pg_advisory_xact_lock(2112, ${orgId})`)
      const [{ total } = { total: 0 }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(scheduleSlots)
        .where(eq(scheduleSlots.organizationId, orgId))
      if (total >= SCHEDULE_SLOTS_MAX) throw new ScheduleSlotLimitError(SCHEDULE_SLOTS_MAX)
      if (data.venueId !== null) await assertVenueInOrg(db, data.venueId, orgId)

      const [slot] = await db
        .insert(scheduleSlots)
        .values({ ...data, organizationId: orgId })
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SCHEDULE_SLOT_CREATED,
        entityType: 'schedule_slot',
        entityId: slot!.id,
        newValue: auditValue(slot!),
      })
      return this.getById(tx, orgId, slot!.id)
    })
  },

  async update(
    ctx: ServiceContext,
    orgId: number,
    slotId: number,
    input: unknown,
  ): Promise<ScheduleSlotView> {
    const data = UpdateScheduleSlotInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [existing] = await db
        .select()
        .from(scheduleSlots)
        .where(and(eq(scheduleSlots.id, slotId), eq(scheduleSlots.organizationId, orgId)))
        .for('update')
      if (!existing) throw new ScheduleSlotNotFoundError(slotId)

      // зал проверяется, только если запрос его меняет: прежний (позже архивный) зал не мешает правке
      if (data.venueId != null && data.venueId !== existing.venueId) {
        await assertVenueInOrg(db, data.venueId, orgId)
      }
      if (Object.keys(data).length === 0) return this.getById(tx, orgId, slotId)

      const [updated] = await db
        .update(scheduleSlots)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(scheduleSlots.id, slotId))
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SCHEDULE_SLOT_UPDATED,
        entityType: 'schedule_slot',
        entityId: slotId,
        oldValue: auditValue(existing),
        newValue: auditValue(updated!),
      })
      return this.getById(tx, orgId, slotId)
    })
  },

  async remove(ctx: ServiceContext, orgId: number, slotId: number): Promise<void> {
    await inTransaction(ctx, async (tx) => {
      const [deleted] = await getDb(tx)
        .delete(scheduleSlots)
        .where(and(eq(scheduleSlots.id, slotId), eq(scheduleSlots.organizationId, orgId)))
        .returning()
      if (!deleted) throw new ScheduleSlotNotFoundError(slotId)
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.SCHEDULE_SLOT_DELETED,
        entityType: 'schedule_slot',
        entityId: slotId,
        oldValue: auditValue(deleted),
      })
    })
  },
}

function auditValue(slot: ScheduleSlot) {
  return {
    weekday: slot.weekday,
    startTime: slot.startTime,
    durationMinutes: slot.durationMinutes,
    title: slot.title,
    type: slot.type,
    venueId: slot.venueId,
    capacity: slot.capacity,
  }
}
