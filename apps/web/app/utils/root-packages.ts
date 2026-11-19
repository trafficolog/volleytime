import {
  type EventBalancePackageBadgeValue,
  type PlatformEventBalancePackage,
  type PlatformPackageHistoryEntry,
  type PlatformPackageSales,
  toMinor,
} from '@volley-time/shared'

import { pluralEvents } from './cabinet-shell'

/**
 * Баланс и тарифы платформы (22.2.1, R-02): каталог пакетов баланса событий. Единица — «событие»
 * (D-10): английский термин из макета не переносится. Суммы приходят в minor units.
 */

/** Границы формы совпадают с проверкой API (ADR-22-2-1). */
export const PACKAGE_UNITS_MAX = 10_000
export const PACKAGE_AMOUNT_MAX = 10_000_000

/** Подписи бейджей; «Скидка» — фиксированная (решение владельца 2026-11-19), без вычисляемого «−N%». */
export const PACKAGE_BADGE_LABELS: Record<EventBalancePackageBadgeValue, string> = {
  popular: 'Популярный',
  discount: 'Скидка',
  best_price: 'Лучшая цена',
}

export const PACKAGE_BADGE_OPTIONS: {
  value: EventBalancePackageBadgeValue | null
  label: string
}[] = [
  { value: null, label: '—' },
  { value: 'popular', label: PACKAGE_BADGE_LABELS.popular },
  { value: 'discount', label: PACKAGE_BADGE_LABELS.discount },
  { value: 'best_price', label: PACKAGE_BADGE_LABELS.best_price },
]

const CURRENCY_LABEL: Record<string, string> = { BYN: 'Br' }
const currencyLabel = (currency: string) => CURRENCY_LABEL[currency] ?? currency

const ru = (fractionDigits: number) =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

/** «50 Br», «50,50 Br»: целые суммы без копеек. */
export function formatPackageMoney(minor: number, currency = 'BYN'): string {
  const digits = minor % 100 === 0 ? 0 : 2
  return `${ru(digits)
    .format(minor / 100)
    .replace(/\s/g, ' ')} ${currencyLabel(currency)}`
}

/** «5,00 Br за событие»: цена одного события, всегда с копейками. */
export function pricePerEventLabel(minor: number, currency = 'BYN'): string {
  return `${ru(2).format(minor / 100)} ${currencyLabel(currency)} за событие`
}

/** Число продаж: сумма по валютам (в штуках заявок валюты не мешают). */
export function soldLabel(sales: PlatformPackageSales[]): string {
  return String(sales.reduce((sum, s) => sum + s.sold, 0))
}

/** «+150 Br», по валютам через « · »; выручки нет — «—». */
export function revenueLabel(sales: PlatformPackageSales[]): string {
  const parts = sales
    .filter((s) => s.revenue > 0)
    .map((s) => `+${formatPackageMoney(s.revenue, s.currency)}`)
  return parts.length ? parts.join(' · ') : '—'
}

export interface PackageRowView {
  id: number
  code: string
  units: number
  unitsCaption: string
  price: string
  perEvent: string
  badge: string | null
  visible: boolean
  draft: boolean
  archived: boolean
  sold: string
  revenue: string
  hasRevenue: boolean
}

export function packageRowView(pkg: PlatformEventBalancePackage): PackageRowView {
  const archived = pkg.archivedAt !== null
  return {
    id: pkg.id,
    code: pkg.code,
    units: pkg.units,
    unitsCaption: pluralEvents(pkg.units),
    price: formatPackageMoney(pkg.amount, pkg.currency),
    perEvent: pricePerEventLabel(pkg.pricePerEvent, pkg.currency),
    badge: pkg.badge ? PACKAGE_BADGE_LABELS[pkg.badge] : null,
    visible: pkg.visible,
    draft: !pkg.visible && !archived,
    archived,
    sold: soldLabel(pkg.sales),
    revenue: revenueLabel(pkg.sales),
    hasRevenue: pkg.sales.some((s) => s.revenue > 0),
  }
}

/** Строка «Без пакета (до каталога)»: подтверждённые заявки, не отнесённые к пакету. */
export function unattributedView(sales: PlatformPackageSales[]) {
  return { sold: soldLabel(sales), revenue: revenueLabel(sales), any: sales.length > 0 }
}

export interface PackageForm {
  units: string
  /** Цена в мажорных единицах: «120», «120,50». */
  price: string
  badge: EventBalancePackageBadgeValue | null
  visible: boolean
}

export const EMPTY_PACKAGE_FORM: PackageForm = { units: '', price: '', badge: null, visible: false }

export type PackageFormErrors = Partial<Record<'units' | 'price', string>>

/** Цена из поля формы в minor units; `null` — не число, отрицательное или выше границы. */
export function parsePackagePrice(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null
  const value = toMinor(Number(text.replace(',', '.')))
  return value <= PACKAGE_AMOUNT_MAX ? value : null
}

export function parsePackageUnits(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d{1,5}$/.test(text)) return null
  const value = Number(text)
  return value >= 1 && value <= PACKAGE_UNITS_MAX ? value : null
}

/** Ошибки полей; при редактировании количество не проверяется (оно не меняется). */
export function packageFormErrors(form: PackageForm, editing = false): PackageFormErrors {
  const errors: PackageFormErrors = {}
  if (!editing && parsePackageUnits(form.units) === null) {
    errors.units = 'Целое число событий от 1 до 10 000'
  }
  if (parsePackagePrice(form.price) === null) {
    errors.price = 'Цена: число от 0 до 100 000, до двух знаков после запятой'
  }
  return errors
}

/** Тело POST: форму нужно проверить `packageFormErrors` заранее. */
export function packageCreateBody(form: PackageForm) {
  return {
    units: parsePackageUnits(form.units)!,
    amount: parsePackagePrice(form.price)!,
    badge: form.badge,
    visible: form.visible,
  }
}

/** Тело «Дублировать»: количество и цена — из формы. */
export function packageDuplicateBody(form: PackageForm) {
  return { units: parsePackageUnits(form.units)!, amount: parsePackagePrice(form.price)! }
}

/** Тело PATCH: только изменённые поля и `version` из списка. */
export function packagePatchBody(form: PackageForm, pkg: PlatformEventBalancePackage) {
  const amount = parsePackagePrice(form.price)!
  return {
    version: pkg.version,
    ...(amount !== pkg.amount ? { amount } : {}),
    ...(form.badge !== pkg.badge ? { badge: form.badge } : {}),
    ...(form.visible !== pkg.visible ? { visible: form.visible } : {}),
  }
}

export function packageToForm(pkg: PlatformEventBalancePackage): PackageForm {
  const major = pkg.amount / 100
  return {
    units: String(pkg.units),
    price: Number.isInteger(major) ? String(major) : major.toFixed(2).replace('.', ','),
    badge: pkg.badge,
    visible: pkg.visible,
  }
}

/** Превью карточки покупки; пустое или неверное значение — прочерк. */
export function packagePreview(form: PackageForm) {
  const units = parsePackageUnits(form.units)
  const amount = parsePackagePrice(form.price)
  return {
    units: units === null ? '—' : String(units),
    caption: units === null ? 'событий' : pluralEvents(units),
    price: amount === null ? '—' : formatPackageMoney(amount),
    perEvent:
      units === null || amount === null
        ? '—'
        : pricePerEventLabel(Math.floor((2 * amount + units) / (2 * units))),
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'event_balance_package.units_taken':
    'Пакет с таким количеством событий уже есть среди действующих. Выберите другое количество или переместите существующий пакет в архив',
  'event_balance_package.stale':
    'Пакет уже изменил другой администратор. Список обновлён: повторите действие',
  'event_balance_package.archived': 'Пакет в архиве: изменить его нельзя',
  'event_balance_package.not_found': 'Пакет не найден: возможно, список устарел',
  validation_failed: 'Проверьте заполнение полей',
}

export function packageErrorMessage(code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Не удалось выполнить действие. Попробуйте ещё раз'
}

const HISTORY_TITLES: Record<string, string> = {
  'event_balance_package.created': 'Пакет создан',
  'event_balance_package.updated': 'Параметры изменены',
  'event_balance_package.visibility_changed': 'Видимость изменена',
  'event_balance_package.archived': 'Пакет перенесён в архив',
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const badgeText = (value: unknown): string =>
  typeof value === 'string' && value in PACKAGE_BADGE_LABELS
    ? PACKAGE_BADGE_LABELS[value as EventBalancePackageBadgeValue]
    : '—'
const moneyText = (value: unknown, currency: string): string =>
  typeof value === 'number' ? formatPackageMoney(value, currency) : '—'

/** Что изменилось: «Цена: 50 Br → 55 Br», «Бейдж: — → Скидка», «Витрина: показан → скрыт». */
export function historyDetails(entry: PlatformPackageHistoryEntry): string {
  const before = asRecord(entry.oldValue)
  const after = asRecord(entry.newValue)
  switch (entry.action) {
    case 'event_balance_package.created': {
      const currency = typeof after.currency === 'string' ? after.currency : 'BYN'
      const units = typeof after.units === 'number' ? after.units : null
      const head =
        units === null
          ? 'Новый пакет'
          : `${units} ${pluralEvents(units)} · ${moneyText(after.amount, currency)}`
      return after.duplicatedFromId === undefined
        ? head
        : `${head} · копия пакета №${after.duplicatedFromId}`
    }
    case 'event_balance_package.updated': {
      const parts: string[] = []
      if ('amount' in after) {
        parts.push(`Цена: ${moneyText(before.amount, 'BYN')} → ${moneyText(after.amount, 'BYN')}`)
      }
      if ('badge' in after) {
        parts.push(`Бейдж: ${badgeText(before.badge)} → ${badgeText(after.badge)}`)
      }
      if ('sortOrder' in after) parts.push(`Порядок: ${before.sortOrder} → ${after.sortOrder}`)
      return parts.join(' · ')
    }
    case 'event_balance_package.visibility_changed':
      return `Витрина: ${before.visible ? 'показан' : 'скрыт'} → ${after.visible ? 'показан' : 'скрыт'}`
    default:
      return 'Заявки пакета не изменены'
  }
}

export interface PackageHistoryView {
  id: number
  time: string
  isoTime: string
  title: string
  pkg: string
  details: string
  actor: string
}

/** Строка истории. Часовой пояс — параметр, чтобы вывод не зависел от машины. */
export function historyEntryView(
  entry: PlatformPackageHistoryEntry,
  timeZone?: string,
): PackageHistoryView {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(entry.createdAt))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    id: entry.id,
    time: `${part('day')}.${part('month')} ${part('hour')}:${part('minute')}`,
    isoTime: new Date(entry.createdAt).toISOString(),
    title: HISTORY_TITLES[entry.action] ?? entry.action,
    pkg: entry.packageCode ?? `№${entry.packageId}`,
    details: historyDetails(entry),
    actor: entry.actor ? entry.actor.name || entry.actor.email || `#${entry.actor.id}` : 'system',
  }
}
