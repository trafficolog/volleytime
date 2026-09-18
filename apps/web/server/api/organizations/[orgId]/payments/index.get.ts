import { paymentService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const payments = await paymentService.listPending(ctx, event.context.organization!.id)
  return { payments }
})
