import { PaymentMethodCode, paymentMethodService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Изменить способ оплаты группы',
    description:
      '21.2.11: включение (enabled) и реквизиты перевода (bank, cardLast4 — ровно 4 цифры, ' +
      'recipient). Полный номер карты не принимается (422); у наличных реквизитов нет. ' +
      'Меняет только то, что игрок видит на экране оплаты: запись на событие и подтверждение ' +
      'платежей не затрагиваются. Изменение пишется в audit_log ' +
      '(organization.payment_method_updated) с автором. Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      {
        in: 'path',
        name: 'method',
        required: true,
        schema: { type: 'string', enum: ['cash', 'transfer'] },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              bank: { type: 'string', nullable: true, description: 'до 100 символов' },
              cardLast4: { type: 'string', nullable: true, description: 'ровно 4 цифры' },
              recipient: { type: 'string', nullable: true, description: 'до 100 символов' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ method } — обновлённый способ' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Группа или способ не найдены' },
      410: { description: 'Группа в архиве (organization.archived)' },
      422: { description: 'validation_failed или payment_method.invalid' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const code = PaymentMethodCode.safeParse(getRouterParam(event, 'method'))
  if (!code.success) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const body = await readBody(event)
  const method = await paymentMethodService.update(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    code.data,
    body ?? {},
  )
  return { method }
})
