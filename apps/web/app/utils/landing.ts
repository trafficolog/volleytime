export function groupCreateHref(isAuthenticated: boolean | null): string {
  return isAuthenticated === true ? '/m/orgs/create' : '/auth/login?redirect=%2Fm%2Forgs%2Fcreate'
}

export function telegramBotHref(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(name) ? `https://t.me/${name}` : null
}

export const landingPricingSection = { id: 'pricing', label: 'Тарифы' } as const

export const landingSections = [
  { id: 'features', label: 'Возможности' },
  { id: 'how-it-works', label: 'Как работает' },
  { id: 'faq', label: 'Вопросы' },
] as const

export const landingFeatures = [
  {
    title: 'Запись и лист ожидания',
    body: 'Игроки видят места и записываются; при освобождении места очередь обновляется.',
  },
  {
    title: 'Делим сумму за зал',
    body: 'Игрок видит прогноз своей доли. После закрытия записи организатор фиксирует точную сумму; оплатить её можно наличными или переводом.',
  },
  {
    title: 'Расписание тренировок',
    body: 'Создавайте события: время, место и количество участников видны в одном месте.',
  },
  {
    title: 'Касса группы',
    body: 'Проверяйте поступления и расходы группы, не собирая движения в отдельную таблицу.',
  },
  {
    title: 'Абонементы по выбору группы',
    body: 'Группа может включить абонементы; организатор управляет планами и остатками.',
  },
  {
    title: 'Состав под рукой',
    body: 'Проверяйте участников тренировки и лист ожидания без переклички в чате.',
  },
] as const

export const landingFaq = [
  {
    question: 'Нужно ли устанавливать приложение?',
    answer: 'Нет. Игрок открывает Mini App в Telegram по приглашению группы.',
  },
  {
    question: 'Как учитываются оплаты?',
    answer:
      'Организатор отмечает наличные или перевод и подтверждает оплату в приложении. Для общей суммы за зал игрок сначала видит прогноз, а после ручного закрытия записи — свою точную долю.',
  },
  {
    question: 'Что происходит при отмене записи?',
    answer: 'Освободившееся место может перейти следующему игроку из листа ожидания.',
  },
  {
    question: 'Как создать группу?',
    answer:
      'Войдите по email и заполните форму создания группы, затем отправьте приглашение игрокам.',
  },
] as const

/** Пакет публичного каталога (`GET /api/public/event-balance-packages`, D-11, D-18). */
export interface LandingPackage {
  code: string
  units: number
  /** minor units */
  amount: number
  currency: string
  badge: 'popular' | 'discount' | 'best_price' | null
}

/** Подписи бейджей каталога; «Скидка» — подпись каталога, а не вычисляемый процент (D-19). */
export const LANDING_BADGE_LABELS = {
  popular: 'Популярный',
  discount: 'Скидка',
  best_price: 'Лучшая цена',
} as const

/** «Br» для BYN (как в референсе), иначе код валюты каталога. */
const currencyLabel = (currency: string) => (currency === 'BYN' ? 'Br' : currency)

/** «50 Br», «12,50 Br»: копейки показываются, только если они есть. */
export function landingPrice(minor: number, currency: string): string {
  const whole = minor % 100 === 0
  const n = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
  return `${n} ${currencyLabel(currency)}`
}

/** Цена одного события: `amount / units`, округление half-up до копейки (как в Root Admin). */
export function landingPricePerEvent(amount: number, units: number, currency: string): string {
  const perEvent = Math.floor((2 * amount + units) / (2 * units))
  const n = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(perEvent / 100)
  return `${n} ${currencyLabel(currency)} за событие`
}

/** Единица баланса — «событие» (D-10). */
export function landingEventsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'событие'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'события'
  return 'событий'
}

export function landingPricing(packages: readonly LandingPackage[]) {
  return packages.map((p) => ({
    code: p.code,
    units: p.units,
    unitsWord: landingEventsWord(p.units),
    price: landingPrice(p.amount, p.currency),
    perEvent: landingPricePerEvent(p.amount, p.units, p.currency),
    badge: p.badge ? LANDING_BADGE_LABELS[p.badge] : null,
    popular: p.badge === 'popular',
  }))
}

/** Заметки под тарифами: только то, что работает в production. */
export const landingPricingNotes = [
  'Без абонентской платы',
  'Деньги игроков идут напрямую вам',
] as const
