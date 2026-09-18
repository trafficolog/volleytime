import { inviteService } from '@volley-time/core'

/**
 * Превью приглашения для бота (Task 8.8.10): без сессии, по внутреннему секрету.
 * Отдаёт только то, что бот печатает в чат — без списка участников.
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(token)) return { status: 'not_found' as const }
  // userId 0 — «аноним»: myMembership всегда null
  const preview = await inviteService.preview({ userId: 0 }, token)
  return {
    status: preview.status,
    organizationName: preview.organization?.name ?? null,
    membersCount: preview.organization?.membersCount ?? 0,
    inviterName: preview.inviter?.name ?? preview.inviter?.telegramUsername ?? null,
  }
})
