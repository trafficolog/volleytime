type PaymentMethod = 'free' | 'cash' | 'transfer' | 'subscription'

export function bookingPayload(method: PaymentMethod, subscriptionId?: number) {
  if (method !== 'subscription') return { method }
  if (!Number.isInteger(subscriptionId) || (subscriptionId ?? 0) <= 0) {
    throw new Error('Choose an active subscription before booking')
  }
  return { method, subscriptionId }
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
