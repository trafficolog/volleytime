import { formatMoneyRu } from './labels'

export function desktopPlanState<T>(subscriptionsEnabled: boolean | null, plans: readonly T[]) {
  return { showCreate: subscriptionsEnabled === true, plans }
}

export function canMutateDesktopPlan(
  currentPath: string,
  expectedPath: string,
  subscriptionsEnabled: boolean | null,
  busy: boolean,
): boolean {
  return currentPath === expectedPath && subscriptionsEnabled === true && !busy
}

/** Цена одного занятия в минорных единицах; для бесплатного плана или 0 занятий — null. */
export function planPerSession(price: number, totalSessions: number): number | null {
  if (price <= 0 || totalSessions <= 0) return null
  return Math.round(price / totalSessions)
}

export function planValidityLabel(validityDays: number | null): string {
  return validityDays ? `${validityDays} дн.` : 'бессрочно'
}

/** Подпись карточки плана: «13,75 BYN/занятие · 45 дн.». */
export function planCaption(plan: {
  price: number
  totalSessions: number
  validityDays: number | null
  currency: string
}): string {
  const per = planPerSession(plan.price, plan.totalSessions)
  const validity = planValidityLabel(plan.validityDays)
  return per === null ? validity : `${formatMoneyRu(per, plan.currency)}/занятие · ${validity}`
}
