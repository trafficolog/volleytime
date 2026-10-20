import { canManageContent, requireOrgMember, searchService } from '@volley-time/core'
import { z } from 'zod'

const Query = z.object({ q: z.string().max(200).default('') })

/** Поиск кабинета (20.5.2, P-13): игроки, события, платежи группы в пределах роли. */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const { q } = Query.parse(getQuery(event))
  return searchService.search(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    { isManager: canManageContent(event.context.member ?? null) },
    q,
  )
})
