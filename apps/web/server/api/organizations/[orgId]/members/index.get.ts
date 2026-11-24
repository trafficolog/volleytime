import {
  MemberRoleFilter,
  PlayersStatsQuery,
  canManageMembers,
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
  // фильтр по роли членства (30.1.1, P-18)
  role: MemberRoleFilter.optional(),
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const raw = getQuery(event)
  const { statuses, role } = Query.parse(raw)
  // заявки, заблокированные и вышедшие — только для управляющих (4.9.8)
  if (statuses.some((st) => st !== 'active')) requireCanManageMembers(event.context.member ?? null)
  const query = PlayersStatsQuery.parse(raw)
  // агрегаты игроков (21.2.20): посещаемость, абонемент и долг — только управляющим группы
  if (query.stats) requireCanManageContent(event.context.member ?? null)
  const orgId = event.context.organization!.id
  const listed = await memberService.listWithUsers(ctx, orgId, statuses, { role })
  // что ведут тренеры и организаторы (30.1.1, P-18) — только управляющим группы
  const leaders = listed.filter((m) => m.role !== 'player').map((m) => m.user.id)
  const leads = canManageMembers(event.context.member ?? null)
    ? await memberService.coachedEvents(ctx, orgId, leaders)
    : null
  const members = leads ? listed.map((m) => ({ ...m, leads: leads.get(m.user.id) ?? [] })) : listed
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
