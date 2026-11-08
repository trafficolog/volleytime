import {
  EXPORT_MAX_ROWS,
  buildEventsCsv,
  eventService,
  requireCanManageContent,
} from '@volley-time/core'

/**
 * CSV списка событий с теми же фильтрами, что и в кабинете (21.2.10): поиск, зал, период, статус.
 * Только manager, только события своей группы; дата, название, зал, места и статус — без сумм
 * оплат и данных игроков. Формулы в ячейках нейтрализуются; больше `EXPORT_MAX_ROWS` строк — 422.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const organization = event.context.organization!
  const rows = await eventService.listForExport(
    ctx,
    organization.id,
    getQuery(event),
    EXPORT_MAX_ROWS,
    { includeDrafts: true },
  )
  if (rows.length > EXPORT_MAX_ROWS) {
    throw createError({
      statusCode: 422,
      statusMessage: `В выгрузке больше ${EXPORT_MAX_ROWS} событий: сузьте период или фильтр`,
      data: { code: 'events.export_too_large' },
    })
  }
  const stats = await eventService.statsFor(
    ctx,
    rows.map((e) => e.id),
  )
  const csv = buildEventsCsv(
    rows.map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      status: e.status,
      capacity: e.capacity,
      taken: stats.get(e.id)?.taken ?? 0,
      place: stats.get(e.id)?.venue?.name ?? e.locationText,
    })),
    organization.defaultTimezone,
  )
  const stamp = new Date().toISOString().slice(0, 10)
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="events-${stamp}.csv"`)
  setResponseHeader(event, 'cache-control', 'no-store')
  return csv
})
