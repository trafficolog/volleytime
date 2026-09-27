import { isLiveDesktopRoute } from './desktop-org-ui'

export function canSubmitDesktopEventAction(
  currentPath: string,
  expectedPath: string,
  busy: boolean,
): boolean {
  return !busy && isLiveDesktopRoute(currentPath, expectedPath)
}
