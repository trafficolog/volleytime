import { eventService, requireOrgMember, resolveTenant, TenantError } from '@volley-time/core'

/**
 * В какой организации событие — для маршрутизации Mini App по deeplink `event_<id>` (8.8.3).
 * Не-участнику организации события отдаёт 404 (id организации не раскрывается).
 */
export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const eventId = Number(getRouterParam(event, 'eventId'))
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid eventId' })
  }
  const ctx = { userId: user.id }
  let ev
  try {
    ev = await eventService.getById(ctx, eventId)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  try {
    const { member } = await resolveTenant(ctx, ev.organizationId)
    requireOrgMember(member)
  } catch (e) {
    if (e instanceof TenantError || (e as { code?: string })?.code?.startsWith('forbidden.')) {
      throw createError({ statusCode: 404, statusMessage: 'Event not found' })
    }
    throw e
  }
  return { orgId: ev.organizationId, eventId: ev.id }
})
