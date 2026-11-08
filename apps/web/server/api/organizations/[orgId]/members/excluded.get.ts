import { listExcludedMembers, requireCanManageMembers } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Исключённые игроки группы',
    description:
      'Только владелец и организатор. Участники в статусе left, которых исключил управляющий ' +
      '(последняя запись аудита о выходе — member.excluded); вышедшие добровольно не включаются. ' +
      'Каждая запись: excludedAt, excludedBy (исполнитель) и reason из журнала. Заблокированные ' +
      'после исключения имеют статус blocked и в список не входят.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ members: ExcludedMember[] }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Нет права управлять участниками (forbidden.manage_members)' },
    },
  },
})

/** Вкладка «Исключённые» (21.2.24): org-scope → право управлять участниками → список по аудиту. */
export default defineApiHandler(async (event) => {
  requireCanManageMembers(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const members = await listExcludedMembers(ctx, event.context.organization!.id)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { members }
})
