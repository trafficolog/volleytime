import { LedgerHistoryQuery, ledgerService, requireCanManageContent } from '@volley-time/core'

/**
 * Касса группы: баланс, «ждёт оплаты» и журнал. Суммы (`balance`, `awaiting`) всегда по всей
 * группе и не зависят от фильтров журнала — они совпадают с карточкой события и Mini App.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const query = LedgerHistoryQuery.parse(getQuery(event))
  const [balance, awaiting, entries] = await Promise.all([
    ledgerService.getBalance(ctx, orgId),
    ledgerService.getAwaiting(ctx, orgId),
    ledgerService.listHistory(ctx, orgId, query),
  ])
  return { balance, awaiting, entries }
})
