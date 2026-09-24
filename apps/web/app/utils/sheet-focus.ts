export function nextSheetFocus(
  focusables: readonly HTMLElement[],
  active: Element | null,
  backward: boolean,
): HTMLElement | null {
  if (!focusables.length) return null
  if (!active || !focusables.includes(active as HTMLElement)) {
    return backward ? focusables[focusables.length - 1]! : focusables[0]!
  }
  if (backward && active === focusables[0]) return focusables[focusables.length - 1]!
  if (!backward && active === focusables[focusables.length - 1]) return focusables[0]!
  return null
}
