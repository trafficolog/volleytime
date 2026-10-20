type PaymentMethod = 'free' | 'cash' | 'transfer' | 'subscription'

const staleEventRejections = new Set([
  'booking.event_not_bookable',
  'booking.not_cancellable',
  'booking.deadline_passed',
  'booking.already_booked',
  'booking.method_not_allowed',
  // места или предложение изменились, пока экран был открыт (20.1.2, 20.3.1): перечитать событие
  'booking.not_enough_seats',
  'booking.not_open_yet',
  // приглашение истекло, использовано или отозвано, пока экран был открыт (20.4.7)
  'booking.invite_required',
  'invite.expired',
  'invite_request.not_pending',
  'invite_request.already_pending',
  'waitlist_offer.expired',
  'waitlist_offer.not_found',
  // событие удалено или принадлежит другой группе: сервер отвечает 404 (19.3.1)
  'event.not_found',
])

export function shouldRefreshPlayerEventAfterRejection(code: string | null | undefined): boolean {
  return code != null && staleEventRejections.has(code)
}

export interface BookingSeatsOptions {
  seats?: number
  /** Явное согласие игрока на частичную очередь; без него части «в очередь» нет (409). */
  allowWaitlist?: boolean
  /** Токен личной ссылки-приглашения на событие «по приглашению» (20.4.7). */
  inviteToken?: string
}

/** Тело POST …/bookings (схема BookInput, 20.1.2): без мест и согласия — как до 20.1.2. */
export function bookingPayload(
  method: PaymentMethod,
  subscriptionId?: number,
  options: BookingSeatsOptions = {},
) {
  const extra = {
    ...(options.seats !== undefined && options.seats > 1 ? { seats: options.seats } : {}),
    ...(options.allowWaitlist === true ? { allowWaitlist: true } : {}),
    ...(options.inviteToken ? { inviteToken: options.inviteToken } : {}),
  }
  if (method !== 'subscription') return { method, ...extra }
  if (!Number.isInteger(subscriptionId) || (subscriptionId ?? 0) <= 0) {
    throw new Error('Choose an active subscription before booking')
  }
  return { method, subscriptionId, ...extra }
}

export async function runPlayerEventAction<T>(
  request: () => Promise<T>,
  isCurrent: () => boolean,
  onSuccess: (value: T) => void | Promise<void>,
): Promise<{ kind: 'success' } | { kind: 'error'; error: unknown } | { kind: 'stale' }> {
  try {
    const value = await request()
    if (!isCurrent()) return { kind: 'stale' }
    await onSuccess(value)
    return isCurrent() ? { kind: 'success' } : { kind: 'stale' }
  } catch (error) {
    return isCurrent() ? { kind: 'error', error } : { kind: 'stale' }
  }
}
