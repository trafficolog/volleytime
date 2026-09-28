import type { Payment } from '@volley-time/db'

export function paymentStatusLabel(status: Payment['status']): string {
  return {
    pending: 'Ожидает подтверждения',
    succeeded: 'Подтверждён',
    cancelled: 'Отменён',
    refunded: 'Возвращён',
  }[status]
}

export function paymentMethodLabel(method: Payment['method']): string {
  return { cash: 'Наличные', transfer: 'Перевод', online: 'Онлайн' }[method]
}

export function historyCursorForStatusChange(
  previousStatus: Payment['status'] | 'all',
  nextStatus: Payment['status'] | 'all',
  cursor: string | null,
): string | null {
  return previousStatus === nextStatus ? cursor : null
}

export function shouldReloadPaymentsAfterError(code: string | null): boolean {
  return code === 'payment.not_pending'
}

export function canSubmitDesktopPaymentAction(
  currentPath: string,
  expectedPath: string,
  expectedOrgId: number,
  currentOrgId: number,
  busy: boolean,
): boolean {
  return currentPath === expectedPath && expectedOrgId === currentOrgId && !busy
}

export function paymentTargetLabel(payment: {
  event: { title: string } | null
  plan: { name: string } | null
}): string {
  return (
    payment.event?.title ??
    (payment.plan ? `Абонемент «${payment.plan.name}»` : 'Назначение недоступно')
  )
}
