import { ReportPeriodQuery, reportsService, requireCanManageContent } from '@volley-time/core'

/**
 * Отчёты кабинета (W-10, 21.2.7): деньги, заполняемость и посещаемость за период. Только
 * manager своей группы; период — даты группы `from`/`to` включительно, границы строятся в её
 * часовом поясе. Деньги берутся из тех же сумм, что касса и обзор.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const period = ReportPeriodQuery.parse(getQuery(event))
  setResponseHeader(event, 'cache-control', 'no-store')
  return reportsService.getManagerReport(ctx, event.context.organization!.id, period)
})
