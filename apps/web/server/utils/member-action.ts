import { memberService, requireCanModerate, type ServiceContext } from '@volley-time/core'
import type { H3Event } from 'h3'

type Action = 'approve' | 'reject' | 'block' | 'unblock'

/** Общий хендлер модерации участника: org-scope → права по цели → переход статуса (4.9.8). */
export async function moderateMember(event: H3Event, action: Action) {
  const ctx: ServiceContext = createServiceContextFromEvent(event)
  const memberId = Number(getRouterParam(event, 'memberId'))
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid memberId' })
  }
  const target = await memberService.getById(ctx, memberId)
  if (target.organizationId !== event.context.organization!.id) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  requireCanModerate(event.context.member ?? null, target)
  const member = await memberService[action](ctx, memberId)
  return { member }
}
