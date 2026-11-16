import {
  bookingService,
  canManageContent,
  readEventPriceForecast,
  readMyEventShare,
  readMySeatPayments,
  readPlayerPriceQuote,
  requireOrgMember,
} from '@volley-time/core'
import { z } from 'zod'

const Query = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const { filter, limit, offset } = Query.parse(getQuery(event))
  const bookings = await bookingService.listMyBookings(
    ctx,
    event.context.organization!.id,
    filter,
    { limit, offset },
  )
  // статус оплаты мест — только своих записей (21.1.8, D-14): счётчики без сумм и чужих платежей
  const seatPayments = await readMySeatPayments(
    ctx,
    event.context.organization!.id,
    bookings.map((b) => b.id),
  )
  return {
    bookings: await Promise.all(
      bookings.map(async (booking) => {
        return {
          ...booking,
          seatPayments: seatPayments.get(booking.id),
          // прогноз события и доля/статус своей записи (21.5.10, 21.5.9)
          priceForecast: await readEventPriceForecast(ctx, booking.eventId),
          myShare: await readMyEventShare(ctx, event.context.organization!.id, booking.eventId),
          // цена split — единый расчёт GET …/price (20.4.6)
          priceQuote: await readPlayerPriceQuote(ctx, {
            organizationId: event.context.organization!.id,
            eventId: booking.eventId,
            mode: booking.event.priceMode,
            isManager: canManageContent(event.context.member ?? null),
          }),
        }
      }),
    ),
    limit,
    offset,
  }
})
