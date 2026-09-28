import { paymentService, requireCanManageContent } from '@volley-time/core'

import {
  encodePaymentHistoryCursor,
  parsePaymentHistoryQuery,
} from '../../../../utils/payment-history-query'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  let query: ReturnType<typeof parsePaymentHistoryQuery>
  try {
    query = parsePaymentHistoryQuery(getQuery(event))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payment history query' })
  }
  const result = await paymentService.listHistory(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    query,
  )
  return {
    payments: result.payments,
    nextCursor: result.nextCursor ? encodePaymentHistoryCursor(result.nextCursor) : null,
  }
})
