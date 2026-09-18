import { organizationService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const organizations = await organizationService.listForUser({ userId: user.id })
  return { organizations }
})
