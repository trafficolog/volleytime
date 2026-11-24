import {
  EXPORT_MAX_ROWS,
  buildPurchaseRequestsCsv,
  platformPurchaseRequestsService,
} from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

/**
 * CSV платежей организаций за период `from`/`to` (подтверждённые заявки по дате решения, 22.2.3,
 * D-07). Только root, no-store; формулы в ячейках нейтрализуются, контактов организатора нет.
 * Больше EXPORT_MAX_ROWS строк — 422.
 */
export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.balance)
  setResponseHeader(event, 'cache-control', 'no-store')
  const rows = forPlatformRole(
    user,
    await platformPurchaseRequestsService.exportRows({ userId: user.id }, getQuery(event)),
  )
  if (rows.length > EXPORT_MAX_ROWS) {
    throw createError({
      statusCode: 422,
      statusMessage: `В выгрузке больше ${EXPORT_MAX_ROWS} записей: сузьте период`,
      data: { code: 'purchase_request.export_too_large' },
    })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'content-disposition',
    `attachment; filename="organization-payments-${stamp}.csv"`,
  )
  return buildPurchaseRequestsCsv(rows)
})
