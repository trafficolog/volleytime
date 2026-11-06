/**
 * Способы оплаты группы (W-11, 21.2.11): подписи, подсказки влияния, проверка реквизитов и
 * тексты экрана «ждёт оплаты» у игрока. Источник истины — сервер; здесь только то, что нужно UI.
 */
import type { SettingsErrors } from './group-settings'

export type PaymentMethodCode = 'cash' | 'transfer'

/** Ответ GET /api/organizations/{id}/payment-methods: полного номера карты в нём нет. */
export interface PaymentMethodView {
  method: PaymentMethodCode
  enabled: boolean
  bank: string | null
  cardLast4: string | null
  recipient: string | null
}

export const REQUISITE_LIMIT = 100
/** 9+ цифр с любыми разделителями и любыми Unicode-цифрами — полный номер карты; как на сервере. */
const LONG_DIGIT_RUN = /\p{Nd}(?:[\s\p{Pd}._/\\,:;|]*\p{Nd}){8,}/u

export const PAYMENT_METHOD_TITLES: Record<PaymentMethodCode, string> = {
  cash: 'Наличными организатору',
  transfer: 'Перевод на карту',
}

/** Подпись под названием способа в кабинете. */
export const PAYMENT_METHOD_SUBTITLES: Record<PaymentMethodCode, string> = {
  cash: 'Касса обновляется после подтверждения',
  transfer: 'Реквизиты показываются игроку, когда запись ждёт оплаты',
}

/** Способы, которых пока нет: показываются недоступными (макет W-11, фаза 12). */
export const UNAVAILABLE_METHODS = [
  { key: 'erip', title: 'ЕРИП' },
  { key: 'bepaid', title: 'Картой онлайн (bePaid)' },
] as const
export const UNAVAILABLE_NOTE = 'Недоступно: онлайн-оплата появится в фазе 12'

/** Подсказка «на что влияет» (критерий приёмки W-11). */
export const PAYMENT_IMPACT = {
  enabled:
    'Выключено: игрок не увидит способ на экране «ждёт оплаты». Записи и платежи не меняются: уже созданные платежи можно подтверждать как прежде.',
  bank: 'Показывается игроку на экране оплаты.',
  cardLast4:
    'Только последние 4 цифры: игрок увидит «*3214». Полный номер карты не сохраняется — отправьте его игроку лично.',
  recipient: 'Показывается игроку на экране оплаты: так он убедится, что переводит вам.',
} as const

/** «Belarusbank · *3214 · Иван П.»; пустая строка, если реквизитов нет. */
export function requisitesLine(m: Pick<PaymentMethodView, 'bank' | 'cardLast4' | 'recipient'>) {
  return [m.bank, m.cardLast4 ? `*${m.cardLast4}` : null, m.recipient]
    .filter((part): part is string => !!part)
    .join(' · ')
}

/** Подпись способа в кабинете: для перевода — реквизиты, если они заданы. */
export function methodSubtitle(m: PaymentMethodView): string {
  if (m.method === 'transfer') return requisitesLine(m) || PAYMENT_METHOD_SUBTITLES.transfer
  return PAYMENT_METHOD_SUBTITLES.cash
}

export interface RequisitesDraft {
  bank: string
  cardLast4: string
  recipient: string
}

export const draftOf = (m: PaymentMethodView | undefined): RequisitesDraft => ({
  bank: m?.bank ?? '',
  cardLast4: m?.cardLast4 ?? '',
  recipient: m?.recipient ?? '',
})

export function validateRequisites(draft: RequisitesDraft): SettingsErrors {
  const errors: SettingsErrors = {}
  for (const [key, label] of [
    ['bank', 'Банк'],
    ['recipient', 'Получатель'],
  ] as const) {
    const value = draft[key].trim()
    if (value.length > REQUISITE_LIMIT) errors[key] = `${label}: не длиннее ${REQUISITE_LIMIT}`
    else if (LONG_DIGIT_RUN.test(value))
      errors[key] = 'Номер карты не принимается: укажите только последние 4 цифры в поле «Карта»'
  }
  const last4 = draft.cardLast4.trim()
  if (last4 !== '' && !/^\d{4}$/.test(last4)) errors.cardLast4 = 'Укажите ровно 4 последние цифры'
  return errors
}

/** Тело PATCH: только изменённые реквизиты; пустое поле — null (очистка). */
export function requisitesPatch(m: PaymentMethodView | undefined, draft: RequisitesDraft) {
  const before = draftOf(m)
  const patch: Partial<Pick<PaymentMethodView, 'bank' | 'cardLast4' | 'recipient'>> = {}
  for (const key of ['bank', 'cardLast4', 'recipient'] as const) {
    if (draft[key].trim() !== before[key]) patch[key] = draft[key].trim() || null
  }
  return patch
}

/** Экран оплаты игрока: включённые способы и реквизиты либо объяснение, как заплатить. */
export interface PlayerPaymentView {
  title: string
  lines: { method: PaymentMethodCode; title: string; text: string }[]
  /** Нет включённых способов: игрок должен спросить организатора. */
  fallback: string | null
}

export const NO_METHODS_TEXT =
  'Организатор не включил способы оплаты в приложении. Уточните у него, как оплатить: подтвердит оплату он же.'

export function playerPaymentView(methods: PaymentMethodView[]): PlayerPaymentView {
  const lines = methods
    .filter((m) => m.enabled)
    .map((m) => ({
      method: m.method,
      title: PAYMENT_METHOD_TITLES[m.method],
      text:
        m.method === 'cash'
          ? 'Передайте сумму организатору. Он подтвердит оплату в приложении.'
          : requisitesLine(m)
            ? `${requisitesLine(m)}. Организатор подтвердит оплату после перевода.`
            : 'Реквизиты уточните у организатора. Он подтвердит оплату после перевода.',
    }))
  return {
    title: 'Как оплатить',
    lines,
    fallback: lines.length === 0 ? NO_METHODS_TEXT : null,
  }
}
