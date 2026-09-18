import type { ServiceContext } from '@volley-time/core'
import type { H3Event } from 'h3'

/**
 * Собрать ServiceContext из аутентифицированного H3-события.
 * Предполагает, что tenant middleware уже заполнил context (userId/organization/member).
 */
export function createServiceContextFromEvent(event: H3Event): ServiceContext {
  const userId = event.context.userId
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return {
    userId,
    organization: event.context.organization,
    member: event.context.member,
  }
}
