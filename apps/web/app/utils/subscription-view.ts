/** Отображение абонементов игрока (20.4.9, M-13): срок, период, цена занятия, последние списания. */

const DAY_MS = 24 * 60 * 60 * 1000

/** Целых суток до конца срока (вверх); `null` — бессрочный или уже истёк. */
export function subscriptionDaysLeft(
  expiresAt: Date | string | null,
  now = new Date(),
): number | null {
  if (expiresAt == null) return null
  const left = new Date(expiresAt).getTime() - now.getTime()
  return left > 0 ? Math.ceil(left / DAY_MS) : null
}

const shortDay = (d: Date | string, tz: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short' }).format(
    new Date(d),
  )

/** «11 апр. — 5 мая»: от активации (или покупки) до срока для истёкшего, иначе до последнего изменения. */
export function subscriptionPeriodLabel(
  sub: {
    status: string
    purchasedAt: Date | string
    activatedAt: Date | string | null
    expiresAt: Date | string | null
    updatedAt: Date | string
  },
  tz: string,
): string {
  const end = sub.status === 'expired' && sub.expiresAt ? sub.expiresAt : sub.updatedAt
  return `${shortDay(sub.activatedAt ?? sub.purchasedAt, tz)} — ${shortDay(end, tz)}`
}

/** Цена одного занятия в минорных единицах; `null` для бесплатного плана и плана без занятий. */
export function subscriptionPerSession(price: number, totalSessions: number): number | null {
  if (price <= 0 || totalSessions <= 0) return null
  return Math.round(price / totalSessions)
}

/** Последние списания по всем абонементам, новые сверху. */
export function recentSubscriptionUsage<S extends { usage: readonly { startsAt: string }[] }>(
  subs: readonly S[],
  limit = 3,
): S['usage'][number][] {
  return subs
    .flatMap((s) => [...s.usage])
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, limit)
}
