import { formatTime } from '@volley-time/shared'

import { displayName } from './labels'

/**
 * Запись по приглашению в Mini App (20.4.7, D-06, M-08): четыре состояния экрана игрока.
 * Источник правды — сервер (`POST …/invite-access`); здесь только проекция в вид и ограничения
 * кнопок. Сервер всё равно проверяет приглашение при записи (20.1.3).
 */
export type InviteState = 'none' | 'requested' | 'invited' | 'expired'

export interface InvitePerson {
  name: string | null
  telegramUsername: string | null
  image: string | null
}

/** Ответ `POST …/invite-access` (даты — строки ISO). */
export interface InviteAccessView {
  state: InviteState
  request: { id: number; status: string; createdAt: string } | null
  invite: {
    source: 'link' | 'request' | 'previous'
    expiresAt: string | null
    inviter: InvitePerson | null
  } | null
  organizer: InvitePerson | null
}

/**
 * Показывать ли состояние приглашения и можно ли записываться. Свободная запись, владелец и
 * организатор (записывают себя без приглашения, D-06 C) и уже записанный игрок не ограничены.
 * Пока состояние не получено — запись закрыта (по умолчанию «нельзя»).
 */
export function inviteGate(input: {
  joinMode: string
  isManager: boolean
  hasBooking: boolean
  loaded: boolean
  access: InviteAccessView | null
}): { show: boolean; state: InviteState | null; canBook: boolean } {
  if (input.joinMode !== 'invite' || input.isManager || input.hasBooking) {
    return { show: false, state: null, canBook: true }
  }
  if (!input.loaded || !input.access) return { show: false, state: null, canBook: false }
  return {
    show: true,
    state: input.access.state,
    canBook: input.access.state === 'invited',
  }
}

/** Метка состояния в карточке события. */
export function inviteChip(state: InviteState): {
  text: string
  tone: 'default' | 'amber' | 'grass' | 'rose'
  dot: boolean
} {
  switch (state) {
    case 'none':
      return { text: 'по приглашению', tone: 'default', dot: false }
    case 'requested':
      return { text: 'запрос отправлен', tone: 'amber', dot: true }
    case 'invited':
      return { text: 'вы приглашены', tone: 'grass', dot: true }
    case 'expired':
      return { text: 'ссылка просрочена', tone: 'rose', dot: true }
  }
}

/** Токен личной ссылки уходит в запись только если приглашение пришло по ней. */
export function inviteBookingToken(
  access: InviteAccessView | null,
  stashed: string | null,
): string | undefined {
  return access?.invite?.source === 'link' && stashed ? stashed : undefined
}

interface TokenStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const tokenKey = (eventId: number) => `vt.inviteToken.${eventId}`

function sessionStorageOrNull(): TokenStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Токен из startapp `event_<id>_<token>` хранится на время сессии, не в адресе и не в журнале. */
export function stashInviteToken(
  eventId: number,
  token: string,
  storage: TokenStorage | null = sessionStorageOrNull(),
): void {
  try {
    storage?.setItem(tokenKey(eventId), token)
  } catch {
    /* хранилище недоступно: ссылка сработает при следующем открытии */
  }
}

export function readStashedInviteToken(
  eventId: number,
  storage: TokenStorage | null = sessionStorageOrNull(),
): string | null {
  try {
    return storage?.getItem(tokenKey(eventId)) ?? null
  } catch {
    return null
  }
}

export function clearStashedInviteToken(
  eventId: number,
  storage: TokenStorage | null = sessionStorageOrNull(),
): void {
  try {
    storage?.removeItem(tokenKey(eventId))
  } catch {
    /* см. stashInviteToken */
  }
}

const dayMonth = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'long' }).format(d)

/** «29 мая, 20:00». */
export function inviteExpiryLabel(iso: string, tz: string): string {
  const d = new Date(iso)
  return `${dayMonth(d, tz)}, ${formatTime(d, tz)}`
}

/** Время отправки запроса: «сегодня, 19:24», «вчера, 19:24», иначе дата. */
export function inviteSentLabel(iso: string, now: Date, tz: string): string {
  const d = new Date(iso)
  const day = dayMonth(d, tz)
  const when =
    day === dayMonth(now, tz)
      ? 'сегодня'
      : day === dayMonth(new Date(now.getTime() - 86_400_000), tz)
        ? 'вчера'
        : day
  return `${when}, ${formatTime(d, tz)}`
}

/** «Иван Петренко · организатор». */
export function organizerLine(person: InvitePerson | null): string {
  return person ? `${displayName(person)} · организатор` : 'Организатор'
}
