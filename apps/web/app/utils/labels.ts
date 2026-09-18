export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Ждёт оплаты',
  confirmed: 'Записан',
  waitlisted: 'В листе ожидания',
  attended: 'Был',
  no_show: 'Не пришёл',
  cancelled: 'Отменена',
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  published: 'Открыто',
  closed: 'Запись закрыта',
  finished: 'Завершено',
  cancelled: 'Отменено',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает активации',
  active: 'Активен',
  exhausted: 'Занятия закончились',
  expired: 'Истёк',
  cancelled: 'Отменён',
}

export const BOOKING_METHOD_LABELS: Record<string, string> = {
  subscription: 'С абонемента',
  cash: 'Наличными',
  transfer: 'Переводом',
  online: 'Онлайн',
  free: 'Бесплатно',
}

export function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key
}

/** Цена события/плана: 0 → «Бесплатно», иначе «15,00 BYN» (ru-RU). */
export function formatPrice(minor: number, currency = 'BYN'): string {
  if (minor === 0) return 'Бесплатно'
  return formatMoneyRu(minor, currency)
}

/** Денежная сумма в формате ru-RU: «1 234,50 BYN», «0,00 BYN» (6.8.12). */
export function formatMoneyRu(minor: number, currency = 'BYN'): string {
  const n = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
  return `${n} ${currency}`
}

export { formatEventDate } from '@volley-time/shared'

export const LEDGER_CATEGORY_LABELS: Record<string, string> = {
  payment_income: 'Оплата участия',
  rent: 'Аренда',
  equipment: 'Инвентарь',
  refund: 'Возврат',
  salary: 'Зарплата',
  other: 'Прочее',
  contribution: 'Взнос на аренду',
  carryover: 'Перенос остатка',
  donation: 'Донат',
  sponsorship: 'Спонсорство',
  other_income: 'Прочий доход',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Наличные',
  transfer: 'Перевод',
  online: 'Онлайн',
}

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  organizer: 'Организатор',
  assistant: 'Помощник',
  player: 'Игрок',
}

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  pending: 'Заявка',
  blocked: 'Заблокирован',
  left: 'Вышел',
  rejected: 'Отклонён',
  guest: 'Гость',
}

/** Отображаемое имя пользователя: имя → @username → «Игрок». */
export function displayName(u: { name?: string | null; telegramUsername?: string | null }): string {
  return u.name?.trim() || (u.telegramUsername ? `@${u.telegramUsername}` : 'Игрок')
}
