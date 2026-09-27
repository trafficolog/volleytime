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
