import type { EventListItem } from '~/components/EventCard.vue'

export function groupEventsByOrgDay(
  events: readonly EventListItem[],
  timeZone: string,
): Map<string, EventListItem[]> {
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const groups = new Map<string, EventListItem[]>()
  for (const event of events) {
    const parts = dateFormat.formatToParts(new Date(event.startsAt))
    const part = (type: string) => parts.find((item) => item.type === type)!.value
    const day = `${part('year')}-${part('month')}-${part('day')}`
    const group = groups.get(day) ?? []
    group.push(event)
    groups.set(day, group)
  }
  return groups
}

export function appendDesktopEventPage(
  current: readonly EventListItem[],
  page: readonly EventListItem[],
  offset: number,
): EventListItem[] {
  if (offset !== current.length) return [...current]
  const seen = new Set(current.map((event) => event.id))
  return [
    ...current,
    ...page.filter((event) => {
      if (seen.has(event.id)) return false
      seen.add(event.id)
      return true
    }),
  ]
}
