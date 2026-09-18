import { organizationService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const org = await organizationService.create({ userId: user.id }, body)
  return { organization: org }
})
