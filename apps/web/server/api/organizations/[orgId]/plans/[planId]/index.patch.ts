import { planService, requireCanManageContent } from '@volley-time/core'

/** Изменить план (своей организации). Task 5.13.19. */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const planId = Number(getRouterParam(event, 'planId'))
  const plan = await planService.getById(ctx, planId)
  if (plan.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }
  const updated = await planService.update(ctx, planId, await readBody(event))
  return { plan: updated }
})
