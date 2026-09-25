export function groupEntryState(
  status: number | undefined,
  code: string | undefined,
): 'denied' | 'suspended' | 'unauthorized' | 'error' {
  if (status === 401) return 'unauthorized'
  if (status === 403) return code === 'organization.suspended' ? 'suspended' : 'denied'
  return 'error'
}

export function visibleGroup<T extends { id: number }>(
  value: T | null | undefined,
  requestError: unknown,
  requestedId: number,
): T | null {
  return requestError || value?.id !== requestedId ? null : value
}
