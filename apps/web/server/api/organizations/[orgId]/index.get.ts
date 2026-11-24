import {
  isCollectionsEnabled,
  isInviteModeEnabled,
  isMultiSeatEnabled,
  isSchedulerEnabled,
  isSplitPricingEnabled,
  memberModes,
  memberRoles,
  normalizeRole,
} from '@volley-time/core'

export default defineApiHandler((event) => {
  // tenant middleware (4.5.1) уже проверил доступ и наполнил context
  const member = event.context.member
  return {
    organization: event.context.organization,
    // роли и режимы на членстве (30.1.1, P-18): устаревшее `assistant` — тренер
    myMember: member && {
      ...member,
      role: normalizeRole(member.role),
      roles: memberRoles(member),
      modes: memberModes(member),
    },
    capabilities: {
      eventSplitPricing: isSplitPricingEnabled(process.env.EVENT_SPLIT_PRICING_ENABLED),
      // запись «по приглашению» (20.1.3): форма события и настройки скрывают режим, пока выключен
      eventInviteMode: isInviteModeEnabled(process.env.EVENT_INVITE_MODE_ENABLED),
      // планировщик (20.3.1): время открытия записи и предложения мест из очереди с TTL
      eventScheduler: isSchedulerEnabled(process.env.SCHEDULER_ENABLED),
      // запись на несколько мест (20.1.2): степпер мест в Mini App скрыт, пока флаг выключен (20.4.5)
      eventMultiSeat: isMultiSeatEnabled(process.env.EVENT_MULTI_SEAT_ENABLED),
      // сборы (21.2.4): создание сборов и взносов скрыто, пока флаг выключен
      collections: isCollectionsEnabled(process.env.COLLECTIONS_ENABLED),
    },
  }
})
