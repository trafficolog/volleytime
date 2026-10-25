import {
  canManageContent,
  eventService,
  quoteSplitShare,
  readEventListMoney,
  readEventPricing,
  readPlayerPriceQuote,
  requireOrgMember,
} from '@volley-time/core'

/**
 * Список событий + заполненность, лист ожидания, моя бронь, площадка (5.13.17). Управляющему
 * дополнительно: `paymentTotals` (оплачено / ждёт оплаты) и `splitShareQuote` (цена места split при
 * текущем составе), 20.5.8; игроку денежные агрегаты группы не отдаются.
 */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const organizationId = event.context.organization!.id
  const isManager = canManageContent(event.context.member ?? null)
  const list = await eventService.list(ctx, organizationId, getQuery(event), {
    includeDrafts: isManager,
  })
  const stats = await eventService.statsFor(
    ctx,
    list.map((e) => e.id),
  )
  const totals = isManager ? await readEventListMoney(ctx, list) : null
  return {
    events: await Promise.all(
      list.map(async (e) => {
        const pricing = await readEventPricing(ctx, e.id)
        return {
          ...e,
          ...stats.get(e.id)!,
          pricing,
          ...(totals
            ? {
                paymentTotals: totals.get(e.id)!,
                splitShareQuote: quoteSplitShare(e, stats.get(e.id)!.taken),
              }
            : {}),
          // цена split игрока — единый расчёт GET …/price (20.4.6); управляющему и fixed — null
          priceQuote: await readPlayerPriceQuote(ctx, {
            organizationId,
            eventId: e.id,
            mode: pricing.mode,
            isManager,
          }),
        }
      }),
    ),
  }
})
