import { planService, requireCanManageContent } from '@volley-time/core'

/** Архивировать план (новые покупки недоступны, выданные абонементы действуют). Task 5.13.19. */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const planId = Number(getRouterParam(event, 'planId'))
  const plan = await planService.getById(ctx, planId)
  if (plan.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }
  return { plan: await planService.archive(ctx, planId) }
})
