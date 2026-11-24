import { ReportBreakdownQuery, reportsService, requireCanManageContent } from '@volley-time/core'

/**
 * Отчёт «В разрезе» (W-19, 30.3.4): игры, заполняемость, выручка и аренда по тренерам, залам или
 * сериям за период. Доступ как у отчётов кабинета: только manager своей группы (тренер денег
 * не видит); деньги берутся из тех же сумм, что касса.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const query = ReportBreakdownQuery.parse(getQuery(event))
  setResponseHeader(event, 'cache-control', 'no-store')
  return reportsService.getBreakdown(ctx, event.context.organization!.id, query)
})
