/** Каталог audit-действий (типизированные константы). */
export const AUDIT_ACTIONS = {
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_ARCHIVED: 'organization.archived',
  ORG_SETTINGS_UPDATED: 'organization.settings_updated',
  // переключатели уведомлений группы (21.2.14)
  ORG_NOTIFICATIONS_UPDATED: 'organization.notifications_updated',
  // страница группы (24.1.1, D-24): только имена изменённых полей, тексты в журнал не пишутся
  ORG_GROUP_PAGE_UPDATED: 'organization.group_page_updated',
  // способы оплаты группы (21.2.11): включение и реквизиты перевода; полный номер карты не пишется
  ORG_PAYMENT_METHOD_UPDATED: 'organization.payment_method_updated',
  // логотип и короткая ссылка группы (21.2.16); байты логотипа в журнал не пишутся
  ORG_LOGO_UPDATED: 'organization.logo_updated',
  ORG_LOGO_REMOVED: 'organization.logo_removed',
  ORG_SHORT_LINK_UPDATED: 'organization.short_link_updated',
  // мягкое удаление и восстановление группы (21.2.17, D-15); деньги группы не меняются
  ORG_DELETED: 'organization.deleted',
  ORG_RESTORED: 'organization.restored',
  // передача владения (21.2.17, D-15); токен ссылки в журнал не пишется
  OWNERSHIP_TRANSFER_STARTED: 'ownership_transfer.started',
  OWNERSHIP_TRANSFER_CANCELLED: 'ownership_transfer.cancelled',
  OWNERSHIP_TRANSFER_ACCEPTED: 'ownership_transfer.accepted',
  OWNERSHIP_TRANSFER_EXPIRED: 'ownership_transfer.expired',
  // итог отправки ссылки получателю ботом (21.4.7): только статус и причина, ссылки и токена нет
  OWNERSHIP_TRANSFER_BOT_DELIVERY: 'ownership_transfer.bot_delivery',
  // итог доставки ботом сообщений об исходе (21.4.20): адресат задан действием (owner — `fromUserId`,
  // получатель — `toUserId` передачи), в записи только `{ status, reason }`
  OWNERSHIP_TRANSFER_BOT_DELIVERY_ACCEPTED_OWNER: 'ownership_transfer.bot_delivery.accepted_owner',
  OWNERSHIP_TRANSFER_BOT_DELIVERY_CANCELLED_OWNER:
    'ownership_transfer.bot_delivery.cancelled_owner',
  OWNERSHIP_TRANSFER_BOT_DELIVERY_CANCELLED_RECIPIENT:
    'ownership_transfer.bot_delivery.cancelled_recipient',
  OWNERSHIP_TRANSFER_BOT_DELIVERY_EXPIRED_OWNER: 'ownership_transfer.bot_delivery.expired_owner',
  OWNERSHIP_TRANSFER_BOT_DELIVERY_EXPIRED_RECIPIENT:
    'ownership_transfer.bot_delivery.expired_recipient',
  // платформенная блокировка пользователя root-администратором (22.1.4): в журнале только
  // состояние `isActive`, без личных данных
  USER_BLOCKED: 'user.blocked',
  USER_UNBLOCKED: 'user.unblocked',
  MEMBER_ADDED: 'member.added',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_BLOCKED: 'member.blocked',
  MEMBER_UNBLOCKED: 'member.unblocked',
  MEMBER_APPROVED: 'member.approved',
  MEMBER_REJECTED: 'member.rejected',
  MEMBER_REJOINED: 'member.rejoined',
  MEMBER_LEFT: 'member.left',
  // исключение из группы без блокировки (21.2.21): статус `left`, повторное вступление по приглашению
  MEMBER_EXCLUDED: 'member.excluded',
  MEMBER_LEVEL_CHANGED: 'member.level_changed',
  MEMBER_POSITION_CHANGED: 'member.position_changed',
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
  VENUE_DELETED: 'venue.deleted',
  // шаблоны слотов расписания группы (21.2.12)
  SCHEDULE_SLOT_CREATED: 'schedule_slot.created',
  SCHEDULE_SLOT_UPDATED: 'schedule_slot.updated',
  SCHEDULE_SLOT_DELETED: 'schedule_slot.deleted',
  LEDGER_EXPENSE_ADDED: 'ledger.expense_added',
  LEDGER_INCOME_ADDED: 'ledger.income_added',
  // привязка Telegram-чата к группе (20.3.4); код и Telegram id в журнал не пишутся
  TELEGRAM_CHAT_CODE_ISSUED: 'telegram_chat.code_issued',
  TELEGRAM_CHAT_LINKED: 'telegram_chat.linked',
  TELEGRAM_CHAT_STATUS_CHANGED: 'telegram_chat.status_changed',
  TELEGRAM_CHAT_UNLINKED: 'telegram_chat.unlinked',
  TELEGRAM_CHAT_ANNOUNCED: 'telegram_chat.event_announced',
  TELEGRAM_CHAT_TEST_SENT: 'telegram_chat.test_sent',
  // баланс событий (20.2.1); начисления и решения root пишет операторская команда (packages/db)
  EVENT_BALANCE_PURCHASE_REQUESTED: 'event_balance.purchase_requested',
  // решение root по заявке (22.2.3): пишет общая логика packages/db (Root Admin и операторская команда)
  EVENT_BALANCE_PURCHASE_APPROVED: 'event_balance.purchase_approved',
  EVENT_BALANCE_PURCHASE_REJECTED: 'event_balance.purchase_rejected',
  // начисление баланса событий root вручную (22.2.2, R-03; то же действие пишет операторская команда)
  EVENT_BALANCE_GRANTED: 'event_balance.granted',
  // каталог пакетов баланса событий, Root Admin (22.2.1); запись платформенная, organization_id = NULL
  EVENT_BALANCE_PACKAGE_CREATED: 'event_balance_package.created',
  EVENT_BALANCE_PACKAGE_UPDATED: 'event_balance_package.updated',
  EVENT_BALANCE_PACKAGE_VISIBILITY_CHANGED: 'event_balance_package.visibility_changed',
  EVENT_BALANCE_PACKAGE_ARCHIVED: 'event_balance_package.archived',
  // безлимит событий группы, Root Admin (22.3.1); organization_id — группа
  EVENT_BALANCE_UNLIMITED_SET: 'event_balance.unlimited_set',
  EVENT_BALANCE_UNLIMITED_CHANGED: 'event_balance.unlimited_changed',
  EVENT_BALANCE_UNLIMITED_CANCELLED: 'event_balance.unlimited_cancelled',
  // настройки платформы, Root Admin (22.3.1); запись платформенная, organization_id = NULL
  PLATFORM_SETTING_UPDATED: 'platform_setting.updated',
  // сборы (21.2.4): жизненный цикл сбора и решения по взносам (платежам сбора)
  COLLECTION_CREATED: 'collection.created',
  COLLECTION_UPDATED: 'collection.updated',
  COLLECTION_COMPLETED: 'collection.completed',
  COLLECTION_CANCELLED: 'collection.cancelled',
  COLLECTION_CONTRIBUTION_CONFIRMED: 'collection.contribution_confirmed',
  COLLECTION_CONTRIBUTION_REJECTED: 'collection.contribution_rejected',
  // повторный взнос до подтверждения: прежний pending-платёж отменён, создан новый (2026-10-28)
  COLLECTION_CONTRIBUTION_REPLACED: 'collection.contribution_replaced',
  // модерация страниц групп, Root Admin (24.1.3); запись платформенная (organization_id = NULL,
  // entity — организация): журнал группы автора решения не показывает
  GROUP_PAGE_HIDDEN: 'group_page.moderation_hidden',
  GROUP_PAGE_NOINDEXED: 'group_page.moderation_noindex',
  GROUP_PAGE_RESTORED: 'group_page.moderation_restored',
  GROUP_PAGE_COMPLAINT_REJECTED: 'group_page.complaint_rejected',
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
  | 'schedule_slot'
  | 'payment'
  | 'ledger_entry'
  | 'event_balance_purchase_request'
  | 'event_balance_entry'
  | 'event_balance_package'
  | 'platform_setting'
  | 'event_invite_request'
  | 'event_series'
  | 'waitlist_offer'
  | 'telegram_chat'
  | 'collection'
  | 'ownership_transfer'
  | 'user'
  | 'group_page_complaint'
