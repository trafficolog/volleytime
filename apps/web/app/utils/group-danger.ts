import { apiErrorCode, apiErrorMessage } from './api-error'

/**
 * «Опасная зона» настроек (W-11, 21.2.17): передача владения и мягкое удаление группы. Решение
 * владельца D-15: передача — любому действующему участнику с подтверждением получателя по личной
 * ссылке; удаление — мягкое, с окном восстановления.
 */

/** Подтверждение удаления: название вводится точно (регистр важен), пробелы по краям не важны. */
export function deleteNameMatches(typed: string, name: string): boolean {
  return typed.trim() !== '' && typed.trim() === name.trim()
}

const ROLE_LABELS: Record<string, string> = {
  organizer: 'Организатор',
  assistant: 'Помощник',
  player: 'Игрок',
}

export interface TransferCandidate {
  id: number
  role: string
  status: string
  user: { id: number; name: string | null; telegramUsername: string | null }
}

export function memberDisplayName(user: TransferCandidate['user']): string {
  return user.name?.trim() || (user.telegramUsername ? `@${user.telegramUsername}` : 'Без имени')
}

/** Кому можно передать владение: действующие участники, кроме самого owner. */
export function transferOptions(members: readonly TransferCandidate[], ownerUserId: number) {
  return members
    .filter((m) => m.status === 'active' && m.role !== 'owner' && m.user.id !== ownerUserId)
    .map((m) => ({
      value: String(m.id),
      label: memberDisplayName(m.user),
      sub: ROLE_LABELS[m.role] ?? m.role,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

/** «9 декабря 2026, 18:30» в часовом поясе группы. */
export function formatDangerDate(value: string | Date, timeZone = 'Europe/Minsk'): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

const DANGER_MESSAGES: Record<string, string> = {
  'ownership_transfer.pending_exists':
    'Уже есть ожидающая передача: отмените её, чтобы выбрать другого участника',
  'ownership_transfer.recipient_invalid':
    'Этому участнику нельзя передать владение: выберите действующего участника группы',
  'organization.delete_confirmation_mismatch': 'Название не совпадает: введите его точно',
  'organization.transfer_pending': 'Сначала отмените ожидающую передачу владения',
  'organization.restore_window_closed': 'Срок восстановления истёк: группу уже не вернуть',
  'organization.not_deleted': 'Группа уже восстановлена',
  'organization.deleted': 'Группа удалена',
  'forbidden.owner_only': 'Действие доступно только владельцу',
}

export function dangerErrorMessage(cause: unknown, fallback: string): string {
  const code = apiErrorCode(cause)
  return (code && DANGER_MESSAGES[code]) || apiErrorMessage(cause, fallback)
}

/** Страница принятия передачи (Mini App и веб): текст по состоянию ссылки. */
export type TransferPageState =
  'loading' | 'pending' | 'accepted' | 'cancelled' | 'expired' | 'invalid' | 'done' | 'error'

const ACCEPT_MESSAGES: Record<string, TransferPageState> = {
  'ownership_transfer.used': 'accepted',
  'ownership_transfer.cancelled': 'cancelled',
  'ownership_transfer.expired': 'expired',
  'ownership_transfer.invalid': 'invalid',
}

/** Состояние страницы после неудачного принятия: известная причина или общая ошибка. */
export function acceptFailureState(cause: unknown): TransferPageState {
  return ACCEPT_MESSAGES[apiErrorCode(cause) ?? ''] ?? 'error'
}

export const TRANSFER_STATE_TEXT: Record<
  Exclude<TransferPageState, 'loading' | 'pending'>,
  { title: string; body: string }
> = {
  done: { title: 'Вы владелец группы', body: 'Передача завершена: теперь группой управляете вы.' },
  accepted: {
    title: 'Ссылка уже использована',
    body: 'Передача по этой ссылке уже принята.',
  },
  cancelled: {
    title: 'Передача отменена',
    body: 'Владелец группы отменил передачу. Попросите новую ссылку, если договорились иначе.',
  },
  expired: {
    title: 'Срок ссылки истёк',
    body: 'Попросите владельца группы начать передачу заново.',
  },
  invalid: {
    title: 'Ссылка недействительна',
    body: 'Ссылка не найдена или выдана другому человеку. Войдите под той учётной записью, которой передают группу.',
  },
  error: { title: 'Не удалось принять передачу', body: 'Попробуйте ещё раз.' },
}

/** Токен ссылки передачи: из фрагмента адреса веба или из startapp Mini App. */
export const TRANSFER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const STASH_KEY = 'vt.transferToken'
/** Запасное место, если sessionStorage недоступен (приватный режим): память текущей страницы. */
let memoryToken: string | null = null

/** Токен держится только на время сессии вкладки, не в адресе и не в журнале. */
export function stashTransferToken(token: string): void {
  if (!TRANSFER_TOKEN_RE.test(token)) return
  memoryToken = token
  try {
    sessionStorage.setItem(STASH_KEY, token)
  } catch {
    // приватный режим: токен остаётся только в памяти страницы (memoryToken)
  }
}

export function readTransferToken(): string | null {
  try {
    const value = sessionStorage.getItem(STASH_KEY)
    if (value && TRANSFER_TOKEN_RE.test(value)) return value
  } catch {
    // хранилище недоступно: берём токен из памяти страницы
  }
  return memoryToken
}

export function clearTransferToken(): void {
  memoryToken = null
  try {
    sessionStorage.removeItem(STASH_KEY)
  } catch {
    // нечего очищать
  }
}
