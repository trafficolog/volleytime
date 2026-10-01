/** Staged release capability: only the literal lowercase true enables new split events. */
export function isSplitPricingEnabled(value: string | undefined): boolean {
  return value === 'true'
}
