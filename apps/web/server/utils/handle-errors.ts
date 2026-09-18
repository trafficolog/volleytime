import {
  ForbiddenError,
  InviteError,
  MemberError,
  VenueError,
  EventError,
  PlanError,
  BookingError,
  SubscriptionError,
  PaymentError,
  OrganizationError,
  TenantError,
  CurrencyMismatchError,
} from '@volley-time/core'

/** HTTP-статусы для доменных error-кодов. */
const CODE_STATUS: Record<string, number> = {
  // organization
  'organization.not_found': 404,
  'organization.archived': 410,
  'organization.suspended': 403,
  'organization.slug_taken': 409,
  // member
  'member.already_exists': 409,
  'member.not_found': 404,
  'member.cannot_block_owner': 422,
  'member.cannot_change_owner_role': 422,
  'member.owner_cannot_leave': 422,
  'member.cannot_change_own_role': 422,
  'member.blocked': 403,
  'member.invalid_transition': 409,
  // invite
  'invite.not_found': 404,
  'invite.revoked': 410,
  'invite.expired': 410,
  'invite.uses_exhausted': 409,
  'venue.not_found': 404,
  'event.not_found': 404,
  'event.not_editable': 409,
  'event.venue_not_in_org': 422,
  'plan.not_found': 404,
  'plan.not_available': 409,
  'booking.already_booked': 409,
  'booking.event_not_bookable': 422,
  'booking.not_found': 404,
  'booking.attendance_too_early': 422,
  'booking.method_not_allowed': 422,
  'booking.not_cancellable': 409,
  'event.starts_in_past': 422,
  'event.capacity_below_taken': 422,
  'money.currency_mismatch': 422,
  'booking.deadline_passed': 422,
  'booking.cannot_cancel_others': 403,
  'subscription.not_found': 404,
  'subscription.no_active': 409,
  'subscription.pending_exists': 409,
  'subscription.not_pending': 409,
  'payment.not_found': 404,
  'payment.not_pending': 409,
  'payment.not_succeeded': 409,
  // forbidden
  'forbidden.manage_content': 403,
  'forbidden.manage_members': 403,
  'forbidden.owner_only': 403,
  'forbidden.invite_role': 403,
  'forbidden.moderate': 403,
  'forbidden.pending_approval': 403,
  'forbidden.not_member': 403,
}

/**
 * Преобразует доменную ошибку в HTTP-ошибку (createError).
 * Используется в catch API-обработчиков.
 */
export function handleServiceError(e: unknown): never {
  if (
    e instanceof OrganizationError ||
    e instanceof MemberError ||
    e instanceof InviteError ||
    e instanceof VenueError ||
    e instanceof EventError ||
    e instanceof PlanError ||
    e instanceof BookingError ||
    e instanceof SubscriptionError ||
    e instanceof PaymentError ||
    e instanceof ForbiddenError ||
    e instanceof CurrencyMismatchError
  ) {
    const status = CODE_STATUS[e.code] ?? 400
    throw createError({ statusCode: status, statusMessage: e.message, data: { code: e.code } })
  }
  if (e instanceof TenantError) {
    throw createError({
      statusCode: e.httpStatus,
      statusMessage: e.message,
      data: { code: e.code },
    })
  }
  // zod: 422 с кратким списком проблем, без дампа схемы/значений (Task 4.9.11)
  if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ZodError') {
    const issues = (
      (e as { issues?: { path: PropertyKey[]; message: string }[] }).issues ?? []
    ).map((i) => ({ path: i.path.map(String).join('.'), message: i.message }))
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { code: 'validation_failed', issues },
    })
  }
  // уже HTTP-ошибка (createError) — пробрасываем как есть
  if (e && typeof e === 'object' && 'statusCode' in e) throw e
  // неизвестная ошибка (SQL и т.п.): логируем на сервере, клиенту — без деталей
  console.error('[api] unexpected error', e)
  throw createError({
    statusCode: 500,
    statusMessage: 'Внутренняя ошибка',
    data: { code: 'internal_error' },
  })
}
