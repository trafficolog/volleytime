export function playerTabs(
  base: string,
  availability: { showMenu: boolean },
  options: { collections?: boolean; collectionsDot?: boolean } = {},
): { to: string; label: string; icon: string; prefix?: boolean; dot?: boolean }[] {
  return [
    { to: base, label: 'Главная', icon: 'home' },
    ...(availability.showMenu
      ? [{ to: `${base}/subscriptions`, label: 'Абонементы', icon: 'card', prefix: true }]
      : []),
    // «Сборы» (21.1.6): между «Абонементами» и «Профилем»; точка — пока вкладку не открывали
    ...(options.collections === false
      ? []
      : [
          {
            to: `${base}/collections`,
            label: 'Сборы',
            icon: 'gift',
            prefix: true,
            dot: options.collectionsDot === true,
          },
        ]),
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
      to: `/m/orgs/${group.id}`,
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
