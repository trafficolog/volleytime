import { canManageContent, paymentMethodService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Способы оплаты группы',
    description:
      '21.2.11. Владелец и организатор получают оба способа (cash, transfer) с признаком enabled и ' +
      'реквизитами перевода (банк, последние 4 цифры карты, получатель); остальные участники — ' +
      'только включённые. Полный номер карты не хранится и не отдаётся. Способ без записи включён.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ methods: [{ method: "cash" | "transfer", enabled, bank, cardLast4, recipient }] }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: { description: 'Группа не найдена (organization.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const member = event.context.member ?? null
  requireOrgMember(member)
  const methods = await paymentMethodService.list(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    { manager: canManageContent(member) },
  )
  return { methods }
})
