import {
  EXPORT_MAX_ROWS,
  LedgerFilterQuery,
  buildLedgerCsv,
  ledgerService,
  requireCanManageContent,
} from '@volley-time/core'

/**
 * CSV журнала кассы с теми же фильтрами, что и в кабинете (21.2.3). Только manager; формулы в
 * ячейках нейтрализуются, время — в часовом поясе группы. Слишком большая выборка — 422.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const organization = event.context.organization!
  const filters = LedgerFilterQuery.parse(getQuery(event))
  const entries = await ledgerService.listForExport(ctx, organization.id, filters)
  if (entries.length > EXPORT_MAX_ROWS) {
    throw createError({
      statusCode: 422,
      statusMessage: `В выгрузке больше ${EXPORT_MAX_ROWS} записей: сузьте период или фильтр`,
      data: { code: 'ledger.export_too_large' },
    })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="cashbox-${stamp}.csv"`)
  setResponseHeader(event, 'cache-control', 'no-store')
  return buildLedgerCsv(entries, organization.defaultTimezone)
})
