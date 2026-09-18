import { paymentService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const paymentId = Number(getRouterParam(event, 'paymentId'))
  const payment = await paymentService.getById(ctx, paymentId)
  if (payment.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }
  const cancelled = await withNotifications((notifications) =>
    paymentService.cancel({ ...ctx, notifications }, paymentId, {
      orgId: event.context.organization!.id,
    }),
  )
  return { payment: cancelled }
})
