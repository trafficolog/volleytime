import { LedgerHistoryQuery, ledgerService, requireCanManageContent } from '@volley-time/core'

/**
 * Касса группы: баланс, «ждёт оплаты», итоги периода и журнал. `balance` и `awaiting` — по всей
 * группе и не зависят от фильтров, они совпадают с карточкой события и Mini App. `period` — поступило
 * и списано за `from`/`to` (без периода — за всё время); тип и категория на него не влияют.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const orgId = event.context.organization!.id
  const query = LedgerHistoryQuery.parse(getQuery(event))
  const [balance, awaiting, period, entries] = await Promise.all([
    ledgerService.getBalance(ctx, orgId),
    ledgerService.getAwaiting(ctx, orgId),
    ledgerService.getPeriodTotals(ctx, orgId, { from: query.from, to: query.to }),
    ledgerService.listHistory(ctx, orgId, query),
  ])
  return { balance, awaiting, period, entries }
})
