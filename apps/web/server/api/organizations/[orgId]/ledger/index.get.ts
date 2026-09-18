import { ledgerService, requireCanManageContent } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const query = getQuery(event)
  const [balance, entries] = await Promise.all([
    ledgerService.getBalance(ctx, orgId),
    ledgerService.listHistory(ctx, orgId, {
      type: query.type as 'income' | 'expense' | undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    }),
  ])
  return { balance, entries }
})
