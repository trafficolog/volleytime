import { memberService, requireCanManageMembers, requireOrgMember } from '@volley-time/core'
import { z } from 'zod'

const MEMBER_STATUSES = ['pending', 'active', 'guest', 'blocked', 'left', 'rejected'] as const

const Query = z.object({
  statuses: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : ['active']))
    .pipe(z.array(z.enum(MEMBER_STATUSES)).min(1)),
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const { statuses } = Query.parse(getQuery(event))
  // заявки, заблокированные и вышедшие — только для управляющих (4.9.8)
  if (statuses.some((st) => st !== 'active')) requireCanManageMembers(event.context.member ?? null)
  const members = await memberService.listWithUsers(ctx, event.context.organization!.id, statuses)
  return { members }
})
