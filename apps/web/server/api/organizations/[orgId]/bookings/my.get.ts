import { bookingService, requireOrgMember } from '@volley-time/core'
import { z } from 'zod'

const Query = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const { filter, limit, offset } = Query.parse(getQuery(event))
  const bookings = await bookingService.listMyBookings(
    ctx,
    event.context.organization!.id,
    filter,
    { limit, offset },
  )
  return { bookings, limit, offset }
})
