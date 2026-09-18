import { inviteService } from '@volley-time/core'

/** Превью приглашения: контекст группы, причина недействительности, моё членство (4.9.17). */
export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(token)) return { status: 'not_found' as const }
  return inviteService.preview({ userId: user.id }, token)
})
