import { requireOrgMember, subscriptionService } from '@volley-time/core'

/** Мои абонементы: план, неоплаченный платёж, история списаний (5.13.20). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const subscriptions = await subscriptionService.listMineDetailed(
    ctx,
    event.context.organization!.id,
  )
  return { subscriptions }
})
