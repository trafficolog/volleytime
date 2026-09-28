import { canSubmitSubscriptionPurchase } from './subscription-availability'

type Selection = {
  orgId: number
  allowPurchase: boolean
  buying: boolean
  plan: { id: number; organizationId: number; status: string } | null
}

export async function runSubscriptionPurchase(
  selection: Selection,
  method: 'cash' | 'transfer',
  submit: (orgId: number, planId: number, method: 'cash' | 'transfer') => Promise<unknown>,
  isCurrent: () => boolean,
  onSuccess: () => void,
): Promise<{ kind: 'blocked' | 'stale' | 'success' } | { kind: 'error'; error: unknown }> {
  if (
    !canSubmitSubscriptionPurchase(
      selection.orgId,
      selection.allowPurchase,
      selection.buying,
      selection.plan,
    )
  )
    return { kind: 'blocked' }

  try {
    await submit(selection.orgId, selection.plan!.id, method)
    if (!isCurrent()) return { kind: 'stale' }
    onSuccess()
    return { kind: 'success' }
  } catch (error) {
    return isCurrent() ? { kind: 'error', error } : { kind: 'stale' }
  }
}
