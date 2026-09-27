export function canSaveDesktopSettings(
  member: { role: string; status: string } | null,
  currentPath: string,
  expectedPath: string,
  busy: boolean,
): boolean {
  return (
    member?.role === 'owner' && member.status === 'active' && currentPath === expectedPath && !busy
  )
}
