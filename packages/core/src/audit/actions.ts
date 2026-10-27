/** Каталог audit-действий (типизированные константы). */
export const AUDIT_ACTIONS = {
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_ARCHIVED: 'organization.archived',
  ORG_SETTINGS_UPDATED: 'organization.settings_updated',
  MEMBER_ADDED: 'member.added',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_BLOCKED: 'member.blocked',
  MEMBER_UNBLOCKED: 'member.unblocked',
  MEMBER_APPROVED: 'member.approved',
  MEMBER_REJECTED: 'member.rejected',
  MEMBER_REJOINED: 'member.rejoined',
  MEMBER_LEFT: 'member.left',
  MEMBER_LEVEL_CHANGED: 'member.level_changed',
  INVITE_CREATED: 'invite.created',
  INVITE_REDEEMED: 'invite.redeemed',
  INVITE_REVOKED: 'invite.revoked',
  // приглашения на событие (20.1.3)
  EVENT_INVITE_REQUEST_CREATED: 'event_invite_request.created',
  EVENT_INVITE_REQUEST_APPROVED: 'event_invite_request.approved',
  EVENT_INVITE_REQUEST_DECLINED: 'event_invite_request.declined',
  // игрок отозвал свой запрос (20.4.7)
  EVENT_INVITE_REQUEST_CANCELLED: 'event_invite_request.cancelled',
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',
  EVENT_CANCELLED: 'event.cancelled',
  EVENT_PRICING_SETTLED: 'event.pricing_settled',
  // фоновые задачи события (20.3.1): закрытие записи планировщиком, предложения мест из очереди
  EVENT_BOOKING_CLOSED: 'event.booking_closed',
  WAITLIST_OFFER_CREATED: 'waitlist_offer.created',
  WAITLIST_OFFER_ACCEPTED: 'waitlist_offer.accepted',
  WAITLIST_OFFER_EXPIRED: 'waitlist_offer.expired',
  // серии событий (20.2.2)
  SERIES_CREATED: 'event_series.created',
  SERIES_UPDATED: 'event_series.updated',
  SERIES_CANCELLED: 'event_series.cancelled',
  BOOKING_CREATED: 'booking.created',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_PROMOTED: 'booking.promoted',
  BOOKING_SEATS_CHANGED: 'booking.seats_changed',
  BOOKING_ATTENDANCE_MARKED: 'booking.attendance_marked',
  SUBSCRIPTION_PURCHASED: 'subscription.purchased',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',
  PLAN_ARCHIVED: 'plan.archived',
  VENUE_CREATED: 'venue.created',
  VENUE_UPDATED: 'venue.updated',
  VENUE_ARCHIVED: 'venue.archived',
  LEDGER_EXPENSE_ADDED: 'ledger.expense_added',
  LEDGER_INCOME_ADDED: 'ledger.income_added',
  // привязка Telegram-чата к группе (20.3.4); код и Telegram id в журнал не пишутся
  TELEGRAM_CHAT_CODE_ISSUED: 'telegram_chat.code_issued',
  TELEGRAM_CHAT_LINKED: 'telegram_chat.linked',
  TELEGRAM_CHAT_STATUS_CHANGED: 'telegram_chat.status_changed',
  TELEGRAM_CHAT_UNLINKED: 'telegram_chat.unlinked',
  TELEGRAM_CHAT_ANNOUNCED: 'telegram_chat.event_announced',
  // баланс событий (20.2.1); начисления и решения root пишет операторская команда (packages/db)
  EVENT_BALANCE_PURCHASE_REQUESTED: 'event_balance.purchase_requested',
  // сборы (21.2.4): жизненный цикл сбора и решения по взносам (платежам сбора)
  COLLECTION_CREATED: 'collection.created',
  COLLECTION_UPDATED: 'collection.updated',
  COLLECTION_COMPLETED: 'collection.completed',
  COLLECTION_CANCELLED: 'collection.cancelled',
  COLLECTION_CONTRIBUTION_CONFIRMED: 'collection.contribution_confirmed',
  COLLECTION_CONTRIBUTION_REJECTED: 'collection.contribution_rejected',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
export type AuditEntityType =
  | 'organization'
  | 'member'
  | 'invite'
  | 'event'
  | 'booking'
  | 'subscription'
  | 'plan'
  | 'venue'
  | 'payment'
  | 'ledger_entry'
  | 'event_balance_purchase_request'
  | 'event_invite_request'
  | 'event_series'
  | 'waitlist_offer'
  | 'telegram_chat'
  | 'collection'
