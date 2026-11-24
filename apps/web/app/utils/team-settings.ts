/** Настройки → Команда (W-17, 30.1.2): строки таблицы, меню, матрица прав, история ролей, серии. */
import { ROLE_LABELS } from './labels'

import type { VtPopoverItem } from '~/components/vt/Popover.vue'

export type TeamRole = 'owner' | 'organizer' | 'coach'

/** Участник из GET /api/organizations/{id}/members; `leads` приходит только управляющим. */
export interface TeamMember {
  id: number
  role: 'owner' | 'organizer' | 'coach' | 'player'
  roles: string[]
  canAcceptPayment: boolean
  status: string
  user: { id: number; name: string | null; image: string | null }
  leads?: TeamLead[]
}

/** Предстоящее событие, которое ведёт человек (`memberService.coachedEvents`). */
export interface TeamLead {
  id: number
  title: string
  startsAt: string | Date
  seriesId: number | null
}

export interface TeamRow {
  id: number
  userId: number
  name: string
  image: string | null
  role: TeamRole
  /** Роли в группе: роль членства и `player` (P-18). */
  roles: string[]
  /** Приём оплаты настраивается только у тренера. */
  canAcceptPayment: boolean
  leads: TeamLead[]
}

/** Команда — действующие владелец, организаторы и тренеры; игроки в таблицу не попадают. */
export function teamRows(members: TeamMember[]): TeamRow[] {
  const rows: TeamRow[] = []
  for (const m of members) {
    if (m.status !== 'active' || m.role === 'player') continue
    rows.push({
      id: m.id,
      userId: m.user.id,
      name: m.user.name?.trim() || 'Без имени',
      image: m.user.image,
      role: m.role,
      roles: m.roles,
      canAcceptPayment: m.role === 'coach' && m.canAcceptPayment,
      leads: m.leads ?? [],
    })
  }
  return rows
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function weekdayIndex(at: string | Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(
    new Date(at),
  )
  return DAY_ORDER.indexOf(short)
}

function weekdayLabel(index: number): string {
  const short = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + index)), // 1 января 2024 — понедельник
  )
  return short.charAt(0).toUpperCase() + short.slice(1)
}

function weekdaysLabel(dates: (string | Date)[], timeZone: string): string {
  const days = [...new Set(dates.map((d) => weekdayIndex(d, timeZone)))].sort((a, b) => a - b)
  return days.map(weekdayLabel).join(', ')
}

function dayLabel(at: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone }).format(
    new Date(at),
  )
}

/** Колонка «Ведёт»: серии с днями недели («Основа · Ср, Пт») и разовые события с датой. */
export function leadsLines(role: TeamRole, leads: TeamLead[], timeZone: string): string[] {
  if (role === 'owner') return ['все события']
  if (leads.length === 0) return ['—']
  const lines: string[] = []
  const series = new Map<number, { title: string; dates: (string | Date)[] }>()
  for (const lead of leads) {
    if (lead.seriesId === null) {
      lines.push(`${lead.title} · ${dayLabel(lead.startsAt, timeZone)}`)
      continue
    }
    const group = series.get(lead.seriesId)
    if (group) group.dates.push(lead.startsAt)
    else series.set(lead.seriesId, { title: lead.title, dates: [lead.startsAt] })
  }
  const grouped = [...series.values()].map(
    (s) => `${s.title} · ${weekdaysLabel(s.dates, timeZone)}`,
  )
  return [...grouped, ...lines]
}

export type TeamMenuKey = 'transfer' | 'makeOrganizer' | 'makeCoach' | 'assignSeries' | 'remove'

/** Меню строки: владельца передают через «Опасную зону», остальных — меняют, назначают, убирают. */
export function teamMenuItems(role: TeamRole): (VtPopoverItem & { key: TeamMenuKey })[] {
  if (role === 'owner') return [{ key: 'transfer', label: 'Передать владение' }]
  return [
    role === 'coach'
      ? { key: 'makeOrganizer', label: 'Сделать организатором' }
      : { key: 'makeCoach', label: 'Сделать тренером' },
    { key: 'assignSeries', label: 'Назначить на серию' },
    { key: 'remove', label: 'Убрать из команды', tone: 'danger', separator: true },
  ]
}

export type MatrixCell = 'yes' | 'no' | 'conditional' | 'view'
export const TEAM_MATRIX_ROLES = ['Владелец', 'Организатор', 'Тренер'] as const
export const MATRIX_CELL_LABELS: Record<MatrixCell, string> = {
  yes: 'Да',
  no: 'Нет',
  conditional: 'если разрешено',
  view: 'только просмотр',
}

/**
 * «Что доступно роли» (макет W-17). Баланс событий организатор видит, но пополняет только
 * владелец (D-27); кассу, сборы, абонементы и отчёты организатор сохраняет (D-32).
 */
export const TEAM_MATRIX: { title: string; cells: [MatrixCell, MatrixCell, MatrixCell] }[] = [
  { title: 'Состав и посещаемость', cells: ['yes', 'yes', 'yes'] },
  { title: 'Приём и подтверждение оплаты', cells: ['yes', 'yes', 'conditional'] },
  { title: 'События и серии', cells: ['yes', 'yes', 'no'] },
  { title: 'Игроки и приглашения', cells: ['yes', 'yes', 'no'] },
  { title: 'Касса, сборы, абонементы, отчёты', cells: ['yes', 'yes', 'no'] },
  { title: 'Баланс событий и оплата платформы', cells: ['yes', 'view', 'no'] },
  { title: 'Настройки, роли, страница группы', cells: ['yes', 'no', 'no'] },
]

/** Запись журнала `member.role_changed` из GET …/audit. */
export interface RoleHistoryEntry {
  id: number
  /** Автор изменения (пользователь); у передачи владения его нет. */
  userId: number | null
  /** id членства, у которого сменилась роль. */
  entityId: number
  createdAt: string | Date
  oldValue: unknown
  newValue: unknown
}

export interface HistoryNames {
  byMemberId: Map<number, string>
  byUserId: Map<number, string>
}

interface RoleState {
  role?: string
  canAcceptPayment?: boolean
}

const asState = (value: unknown): RoleState =>
  value && typeof value === 'object' ? (value as RoleState) : {}

const roleName = (role: string | undefined) => (role ? (ROLE_LABELS[role] ?? role) : '—')

/** Строка истории без пола: «Автор: Человек — роль «Тренер» (была «Игрок»)». */
export function historyLine(entry: RoleHistoryEntry, names: HistoryNames): string {
  const target = names.byMemberId.get(entry.entityId) ?? 'Участник'
  const author = entry.userId === null ? null : (names.byUserId.get(entry.userId) ?? 'Участник')
  const before = asState(entry.oldValue)
  const after = asState(entry.newValue)
  let text: string
  if (before.role !== after.role) {
    text =
      after.role === 'player'
        ? `${target} — убран из команды, остаётся игроком`
        : `${target} — роль «${roleName(after.role)}» (была «${roleName(before.role)}»)`
  } else {
    text = `${target} — приём оплаты ${after.canAcceptPayment ? 'разрешён' : 'отключён'}`
  }
  return author ? `${author}: ${text}` : text
}

/** Время записи истории: «Сегодня 12:10» или «24 мая 18:02» по часам группы. */
export function formatHistoryWhen(at: string | Date, now: Date, timeZone: string): string {
  const date = new Date(at)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone }) // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date)
  const when = day.format(date) === day.format(now) ? 'Сегодня' : dayLabel(date, timeZone)
  return `${when} ${time}`
}

export interface SeriesOption {
  seriesId: number
  title: string
  label: string
  /** Первая предстоящая дата серии (YYYY-MM-DD): с неё правка «это и последующие». */
  from: string
}

export interface SeriesEventRow {
  id: number
  title: string
  startsAt: string | Date
  status: string
  seriesId: number | null
  seriesDate: string | null
}

/** Серии группы из предстоящих событий: название, дни недели, дата начала правки. */
export function seriesOptions(events: SeriesEventRow[], timeZone: string): SeriesOption[] {
  const groups = new Map<number, { title: string; dates: (string | Date)[]; from: string }>()
  for (const e of events) {
    if (e.seriesId === null || e.seriesDate === null) continue
    if (e.status === 'cancelled' || e.status === 'finished') continue
    const group = groups.get(e.seriesId)
    if (!group) groups.set(e.seriesId, { title: e.title, dates: [e.startsAt], from: e.seriesDate })
    else {
      group.dates.push(e.startsAt)
      if (e.seriesDate < group.from) group.from = e.seriesDate
    }
  }
  return [...groups.entries()].map(([seriesId, g]) => ({
    seriesId,
    title: g.title,
    label: `${g.title} · ${weekdaysLabel(g.dates, timeZone)}`,
    from: g.from,
  }))
}
