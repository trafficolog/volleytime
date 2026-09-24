export function playerTabs(base: string, availability: { showMenu: boolean }) {
  return [
    { to: base, label: 'Главная', icon: 'home' },
    { to: `${base}/bookings`, label: 'Записи', icon: 'ticket' },
    ...(availability.showMenu
      ? [{ to: `${base}/subscriptions`, label: 'Абонементы', icon: 'card' }]
      : []),
    { to: `${base}/profile`, label: 'Профиль', icon: 'users' },
  ]
}

export function playerGroupOptions(
  groups: readonly {
    id: number
    name: string
    city: string | null
    status: string
    membershipStatus: string
  }[],
  selectedId: number,
) {
  return groups.map((group) => {
    const selectable = group.status === 'active' && group.membershipStatus === 'active'
    return {
      id: group.id,
      name: group.name,
      city: group.city,
      selectable,
      statusLabel:
        group.status === 'suspended'
          ? 'Группа приостановлена'
          : group.membershipStatus === 'pending'
            ? 'Заявка на рассмотрении'
            : null,
      to: selectable ? `/m/orgs/${group.id}` : '/m/orgs',
      selected: group.id === selectedId,
    }
  })
}

export function playerProfileFields(
  user: {
    name: string | null
    email: string | null
    telegramUsername: string | null
  } | null,
) {
  if (!user) return []
  const fields: { label: string; value: string }[] = []
  if (user.name?.trim()) fields.push({ label: 'Имя', value: user.name.trim() })
  if (user.email?.trim()) fields.push({ label: 'Почта', value: user.email.trim() })
  if (user.telegramUsername?.trim()) {
    const username = user.telegramUsername.trim().replace(/^@/, '')
    fields.push({ label: 'Telegram', value: `@${username}` })
  }
  return fields
}
