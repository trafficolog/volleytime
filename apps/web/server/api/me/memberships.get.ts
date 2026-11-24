import { memberModes, memberRoles, organizationService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Мои членства, роли и режимы',
    description:
      '30.1.1 (P-18): по каждой группе, где я действующий участник, — роли (роль членства и ' +
      '`player`), флаг «Принимает оплату» и режимы Mini App: owner и organizer — play и manage, ' +
      'coach — play и coach, игрок — только play. Заявки, архивные и удалённые группы не входят. ' +
      'Для шторки групп (M-04) и переключателя режима (M-25).',
    responses: {
      200: {
        description:
          '{ memberships: [{ organizationId, organizationName, organizationSlug, role, roles, ' +
          'canAcceptPayment, modes }] }',
      },
      401: { description: 'Нет сессии' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  const organizations = await organizationService.listForUser({ userId: user.id })
  return {
    memberships: organizations
      .filter((o) => o.membershipStatus === 'active')
      .map((o) => {
        const member = { role: o.membershipRole }
        return {
          organizationId: o.id,
          organizationName: o.name,
          organizationSlug: o.slug,
          role: o.membershipRole,
          roles: memberRoles(member),
          canAcceptPayment: o.membershipRole === 'coach' && o.membershipCanAcceptPayment,
          modes: memberModes(member),
        }
      }),
  }
})
