import { canManageContent, eventService, requireOrgMember } from '@volley-time/core'

/** Список событий + заполненность, лист ожидания, моя бронь, площадка (5.13.17). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const list = await eventService.list(ctx, event.context.organization!.id, getQuery(event), {
    includeDrafts: canManageContent(event.context.member ?? null),
  })
  const stats = await eventService.statsFor(
    ctx,
    list.map((e) => e.id),
  )
  return { events: list.map((e) => ({ ...e, ...stats.get(e.id)! })) }
})
