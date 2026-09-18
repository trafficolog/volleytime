import { inviteService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const token = getRouterParam(event, 'token')!
  const member = await inviteService.redeem({ userId: user.id }, token)
  return { member }
})
