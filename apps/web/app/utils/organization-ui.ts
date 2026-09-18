export interface OrganizationUiMembership {
  role: 'owner' | 'organizer' | 'assistant' | 'player'
  status: string
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.created': 'Организация создана',
  'organization.updated': 'Настройки обновлены',
  'organization.archived': 'Организация архивирована',
  'member.invited': 'Приглашение создано',
  'member.joined': 'Участник присоединился',
  'member.left': 'Участник покинул организацию',
  'member.blocked': 'Участник заблокирован',
  'member.unblocked': 'Участник разблокирован',
  'member.role_changed': 'Роль участника изменена',
  'member.kicked': 'Участник удалён',
  'invite.created': 'Приглашение создано',
  'invite.revoked': 'Приглашение отозвано',
  'invite.used': 'Приглашение использовано',
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  organization: 'Организация',
  member: 'Участник',
  invite: 'Приглашение',
  event: 'Событие',
  booking: 'Запись',
  payment: 'Оплата',
  subscription: 'Абонемент',
}

export function canViewOrgAuditUi(member: OrganizationUiMembership | null | undefined): boolean {
  return (
    member?.status === 'active' && (member.role === 'owner' || member.role === 'organizer')
  )
}

export function canManageOrgSettingsUi(
  member: OrganizationUiMembership | null | undefined,
): boolean {
  return member?.status === 'active' && member.role === 'owner'
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType
}
