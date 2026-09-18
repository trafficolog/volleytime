/** Каталог audit-действий (типизированные константы). */
export const AUDIT_ACTIONS = {
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_ARCHIVED: 'organization.archived',
  MEMBER_ADDED: 'member.added',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_BLOCKED: 'member.blocked',
  MEMBER_UNBLOCKED: 'member.unblocked',
  MEMBER_APPROVED: 'member.approved',
  MEMBER_REJECTED: 'member.rejected',
  MEMBER_REJOINED: 'member.rejoined',
  MEMBER_LEFT: 'member.left',
  INVITE_CREATED: 'invite.created',
  INVITE_REDEEMED: 'invite.redeemed',
  INVITE_REVOKED: 'invite.revoked',
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',
  EVENT_CANCELLED: 'event.cancelled',
  BOOKING_CREATED: 'booking.created',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_PROMOTED: 'booking.promoted',
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
