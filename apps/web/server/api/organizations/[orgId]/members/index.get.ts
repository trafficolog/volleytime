import {
  PlayersStatsQuery,
  memberService,
  playerStatsService,
  requireCanManageContent,
  requireCanManageMembers,
  requireOrgMember,
} from '@volley-time/core'
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
  const raw = getQuery(event)
  const { statuses } = Query.parse(raw)
  // заявки, заблокированные и вышедшие — только для управляющих (4.9.8)
  if (statuses.some((st) => st !== 'active')) requireCanManageMembers(event.context.member ?? null)
  const query = PlayersStatsQuery.parse(raw)
  // агрегаты игроков (21.2.20): посещаемость, абонемент и долг — только управляющим группы
  if (query.stats) requireCanManageContent(event.context.member ?? null)
  const orgId = event.context.organization!.id
  const members = await memberService.listWithUsers(ctx, orgId, statuses)
  if (!query.stats) return { members }

  const result = await playerStatsService.getForUsers(
    ctx,
    orgId,
    members.map((m) => m.user.id),
    { dates: query.from && query.to ? { from: query.from, to: query.to } : undefined },
  )
  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    members: members.map((m) => ({ ...m, stats: result.byUser.get(m.user.id)! })),
    statsPeriod: result.period,
  }
})
