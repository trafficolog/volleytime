import { requireOrgMember, subscriptionService } from '@volley-time/core'
import { z } from 'zod'

const Body = z.object({
  planId: z.number().int().positive(),
  method: z.enum(['cash', 'transfer']).default('cash'),
})

/** Покупка абонемента: платный план → pending + платёж, бесплатный → active (5.13.1). */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const { planId, method } = Body.parse(await readBody(event))
  const { subscription, paymentId } = await subscriptionService.purchase(
    ctx,
    event.context.organization!.id,
    planId,
    { method },
  )
  return { subscription, paymentId }
})
