import { organizationDeletionService, organizationService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const ctx = { userId: user.id }
  // удалённые группы (21.2.17) в общий список не входят; владелец видит свои отдельно — чтобы
  // восстановить их в окне
  const [organizations, deletedOrganizations] = await Promise.all([
    organizationService.listForUser(ctx),
    organizationDeletionService.listDeletedForOwner(ctx),
  ])
  return { organizations, deletedOrganizations }
})
