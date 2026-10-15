/** Настройки группы в кабинете (W-11, 20.5.7): разделы, подсказки влияния, проверка и разница. */

export type PlayerLevelCode = 'v1' | 'v2' | 'v3' | 'v4' | 'v4_plus'

/** Ответ GET /api/organizations/{id}/settings (19.2.2). */
export interface GroupSettings {
  subscriptionsEnabled: boolean
  maxSeatsPerBooking: number
  defaultPriceMode: 'fixed' | 'split'
  defaultJoinMode: 'open' | 'invite'
  cancellationAllowed: boolean
  /** null: отмена до начала события. */
  cancellationDeadlineHours: number | null
  seoIndex: boolean
  city: string | null
  district: string | null
  levels: PlayerLevelCode[]
}

export type SettingsSectionKey =
  'profile' | 'bookings' | 'venues' | 'team' | 'notifications' | 'integrations' | 'danger'

export const SETTINGS_SECTIONS: { key: SettingsSectionKey; label: string; ownerOnly?: boolean }[] =
  [
    { key: 'profile', label: 'Профиль' },
    { key: 'bookings', label: 'Записи и оплата' },
    { key: 'venues', label: 'Залы и площадки' },
    { key: 'team', label: 'Команда' },
    { key: 'notifications', label: 'Уведомления' },
    { key: 'integrations', label: 'Интеграции' },
    { key: 'danger', label: 'Опасная зона', ownerOnly: true },
  ]

export function visibleSections(isOwner: boolean) {
  return SETTINGS_SECTIONS.filter((s) => isOwner || !s.ownerOnly)
}

/** Раздел из `?section=`; неизвестный или недоступный по роли — «Профиль». */
export function parseSection(value: unknown, isOwner: boolean): SettingsSectionKey {
  const raw = Array.isArray(value) ? value[0] : value
  return visibleSections(isOwner).find((s) => s.key === raw)?.key ?? 'profile'
}

export const MAX_SEATS_LIMITS = { min: 1, max: 10 } as const
export const CANCELLATION_HOURS_MAX = 720
export const TEXT_LIMITS = { name: 100, description: 500, city: 100, district: 100 } as const

/** Подсказка «на что влияет» у каждой настройки (критерий приёмки 20.5.7). */
export const SETTING_IMPACT = {
  name: 'Показывается игрокам в Mini App, в приглашениях и в сообщениях бота.',
  description: 'Показывается игрокам в карточке группы и в приглашении.',
  city: 'Помогает игрокам найти группу; попадает на страницу группы.',
  district: 'Уточняет место игры; попадает на страницу группы.',
  seoIndex: 'Разрешает поисковикам находить страницу группы. Выключено: страница скрыта от поиска.',
  subscriptionsEnabled:
    'Выключено: вкладка и продажа абонементов скрыты в кабинете и в Mini App; уже купленные доживают срок.',
  cancellationAllowed:
    'Выключено: игроки не могут сами отменить запись, отменить может только организатор.',
  cancellationDeadlineHours:
    'Новые события получают этот срок; уже созданные события хранят свой и не меняются.',
  maxSeatsPerBooking:
    'Сколько мест игрок занимает одной записью. Касается новых записей в Mini App; существующие не меняются.',
  defaultPriceMode:
    'Подставляется при создании события; на самом событии можно поменять. Созданные события не меняются.',
  defaultJoinMode:
    'Подставляется при создании события: свободная запись или только по приглашению. Созданные события не меняются.',
  levels: 'Показываются игрокам в карточке группы и помогают подобрать подходящую игру.',
  defaultMemberStatus:
    'Как новый участник попадает в состав: сразу или после одобрения организатором.',
} as const

export function seatsHint(n: number): string {
  return n === 1
    ? 'Только своё место: приводить гостей нельзя.'
    : `Игрок займёт до ${n} мест: своё и ещё ${n - 1}. Оплата считается за каждое место.`
}

export function cancellationHint(allowed: boolean, hours: number | null): string {
  if (!allowed) return 'Игроки не смогут отменить запись сами.'
  return hours === null || hours === 0
    ? 'Игроки смогут отменять запись вплоть до начала тренировки.'
    : `Позже чем за ${hours} ч до начала отменить запись будет нельзя.`
}

export const DEADLINE_ANY = 'any'

export function deadlineOptions(current: number | null): { value: string; label: string }[] {
  const presets = [1, 2, 6, 12, 24, 48, 72]
  const extra = current !== null && current !== 0 && !presets.includes(current) ? [current] : []
  return [
    { value: DEADLINE_ANY, label: 'В любое время до начала' },
    ...[...presets, ...extra]
      .sort((a, b) => a - b)
      .map((h) => ({ value: String(h), label: `За ${h} ч до начала` })),
  ]
}

export const deadlineToValue = (hours: number | null) =>
  hours === null || hours === 0 ? DEADLINE_ANY : String(hours)
export const valueToDeadline = (value: string) => (value === DEADLINE_ANY ? null : Number(value))

export type SettingsErrors = Record<string, string>

export function validateBookings(draft: {
  maxSeatsPerBooking: number
  cancellationDeadlineHours: number | null
}): SettingsErrors {
  const errors: SettingsErrors = {}
  const seats = draft.maxSeatsPerBooking
  if (!Number.isInteger(seats) || seats < MAX_SEATS_LIMITS.min || seats > MAX_SEATS_LIMITS.max) {
    errors.maxSeatsPerBooking = `Укажите число мест от ${MAX_SEATS_LIMITS.min} до ${MAX_SEATS_LIMITS.max}`
  }
  const hours = draft.cancellationDeadlineHours
  if (hours !== null && (!Number.isInteger(hours) || hours < 0 || hours > CANCELLATION_HOURS_MAX)) {
    errors.cancellationDeadlineHours = `Срок отмены: от 0 до ${CANCELLATION_HOURS_MAX} ч`
  }
  return errors
}

export function validateProfile(draft: {
  name: string
  description: string
  city: string
  district: string
}): SettingsErrors {
  const errors: SettingsErrors = {}
  const name = draft.name.trim()
  if (name.length < 2) errors.name = 'Название: минимум 2 символа'
  else if (name.length > TEXT_LIMITS.name) errors.name = `Название: не длиннее ${TEXT_LIMITS.name}`
  if (draft.description.trim().length > TEXT_LIMITS.description)
    errors.description = `Описание: не длиннее ${TEXT_LIMITS.description} символов`
  if (draft.city.trim().length > TEXT_LIMITS.city)
    errors.city = `Город: не длиннее ${TEXT_LIMITS.city} символов`
  if (draft.district.trim().length > TEXT_LIMITS.district)
    errors.district = `Район: не длиннее ${TEXT_LIMITS.district} символов`
  return errors
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Только изменённые поля из `keys` — тело PATCH /settings. */
export function settingsPatch<K extends keyof GroupSettings>(
  confirmed: GroupSettings,
  draft: Pick<GroupSettings, K>,
  keys: readonly K[],
): Partial<Pick<GroupSettings, K>> {
  const patch: Partial<Pick<GroupSettings, K>> = {}
  for (const key of keys) if (!same(draft[key], confirmed[key])) patch[key] = draft[key]
  return patch
}

/** Пустая строка в необязательном тексте превращается в null (как на сервере). */
export const textOrNull = (value: string): string | null => value.trim() || null

export const LEVEL_ORDER: PlayerLevelCode[] = ['v1', 'v2', 'v3', 'v4', 'v4_plus']
export const sortLevels = (levels: PlayerLevelCode[]) =>
  LEVEL_ORDER.filter((code) => levels.includes(code))

/** Сообщение об ошибке PATCH; 422 по полям сервер не расшифровывает. */
export function settingsErrorMessage(status: number | undefined, fallback: string): string {
  if (status === 410) return 'Группа в архиве: настройки недоступны'
  if (status === 422) return 'Сервер не принял значения. Проверьте поля и попробуйте ещё раз'
  return fallback
}
