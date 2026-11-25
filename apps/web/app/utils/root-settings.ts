import {
  parsePlatformSetting,
  PLATFORM_SETTINGS,
  type PlatformPolicy,
  type PlatformSettingKey,
  type PlatformSettingsHistoryEntry,
  type PlatformSettingsResponse,
  type PlatformStaffMe,
} from '@volley-time/shared'

/**
 * Экран «Настройки» Root Admin (22.3.1, R-05): разделы, формы редактируемых разделов («Общие» и
 * «Лимиты»), только изменённые ключи с их `version`, подписи истории. Остальные разделы — статусы
 * только для чтения из `readonly` ответа.
 */
export const ROOT_SETTINGS_SECTIONS = [
  { key: 'general', label: 'Общие', policy: 'settings' },
  // R-15 (29.3.1): команда и безопасность — только Owner
  { key: 'team', label: 'Команда & роли', policy: 'team' },
  { key: 'payments', label: 'Платежи', policy: 'settings' },
  { key: 'notifications', label: 'Уведомления', policy: 'settings' },
  { key: 'limits', label: 'Лимиты', policy: 'settings' },
  { key: 'security', label: 'Безопасность', policy: 'team' },
  { key: 'integrations', label: 'Интеграции', policy: 'settings' },
] as const satisfies readonly { key: string; label: string; policy: PlatformPolicy }[]
export type RootSettingsSectionKey = (typeof ROOT_SETTINGS_SECTIONS)[number]['key']
export type RootSettingsSection = (typeof ROOT_SETTINGS_SECTIONS)[number]

export const isSettingsSection = (value: unknown): value is RootSettingsSectionKey =>
  ROOT_SETTINGS_SECTIONS.some((s) => s.key === value)

/**
 * Разделы настроек, доступные роли (R-15). Роль неизвестна — разделы политики `settings` (без
 * команды и безопасности): доступ всё равно проверяет сервер.
 */
export function settingsSectionsFor(me: PlatformStaffMe | null): readonly RootSettingsSection[] {
  return ROOT_SETTINGS_SECTIONS.filter((s) =>
    me === null ? s.policy === 'settings' : me.policies.includes(s.policy),
  )
}

/** Раздел из `?section=`; неизвестный или недоступный роли — «Общие». */
export function sectionFromQuery(
  value: unknown,
  sections: readonly RootSettingsSection[] = ROOT_SETTINGS_SECTIONS,
): RootSettingsSectionKey {
  const v = Array.isArray(value) ? value[0] : value
  return sections.some((s) => s.key === v) ? (v as RootSettingsSectionKey) : 'general'
}

/** Ключи редактируемых разделов, в порядке полей формы. */
export const EDITABLE_KEYS = {
  general: ['general.platformName', 'general.supportContact'],
  limits: [
    'eventBalance.newOrganizationGrant',
    'events.maxPublishedPerDay',
    'bot.callbackLimit',
    'bot.callbackWindowSeconds',
  ],
} as const satisfies Record<string, readonly PlatformSettingKey[]>
export type EditableSection = keyof typeof EDITABLE_KEYS

export const FIELD_LABELS: Record<PlatformSettingKey, string> = {
  'general.platformName': 'Название платформы',
  'general.supportContact': 'Контакт поддержки',
  'eventBalance.newOrganizationGrant': 'Стартовый баланс новой группы (событий)',
  'events.maxPublishedPerDay': 'Макс. опубликованных событий в день на группу',
  'bot.callbackLimit': 'Нажатия кнопок бота на пользователя',
  'bot.callbackWindowSeconds': 'за секунд',
}

/** Поле формы — всегда строка: числа вводятся в `<input>`, пустое поле лимита в день = «без лимита». */
export type SettingsForm = Record<PlatformSettingKey, string>

const toText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

/** Форма из ответа сервера: текущие значения (сохранённые или по умолчанию). */
export function formFromSettings(data: PlatformSettingsResponse): SettingsForm {
  return Object.fromEntries(
    (Object.keys(PLATFORM_SETTINGS) as PlatformSettingKey[]).map((k) => [
      k,
      toText(data.settings[k].value),
    ]),
  ) as SettingsForm
}

const NUMERIC_KEYS = new Set<PlatformSettingKey>([
  'eventBalance.newOrganizationGrant',
  'events.maxPublishedPerDay',
  'bot.callbackLimit',
  'bot.callbackWindowSeconds',
])

/**
 * Значение для отправки из поля формы: число — у числовых ключей (нечисловой ввод остаётся строкой и
 * не проходит схему), пустое поле лимита в день — `null` («без лимита»), пустой контакт — `null`.
 */
export function parseFieldInput(key: PlatformSettingKey, text: string): unknown {
  const trimmed = text.trim()
  if (NUMERIC_KEYS.has(key)) {
    if (trimmed === '') return key === 'events.maxPublishedPerDay' ? null : trimmed
    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed
  }
  if (key === 'general.supportContact' && trimmed === '') return null
  return text
}

/** Ошибки полей раздела (клиентская проверка той же схемой, что на сервере). */
export function sectionErrors(
  section: EditableSection,
  form: SettingsForm,
): Partial<Record<PlatformSettingKey, string>> {
  const errors: Partial<Record<PlatformSettingKey, string>> = {}
  for (const key of EDITABLE_KEYS[section]) {
    const result = parsePlatformSetting(key, parseFieldInput(key, form[key]))
    if (!result.ok) errors[key] = fieldMessage(key)
  }
  return errors
}

/** Понятное сообщение у поля вместо технического текста схемы. */
export function fieldMessage(key: PlatformSettingKey): string {
  switch (key) {
    case 'general.platformName':
      return 'От 1 до 60 символов, без переводов строк'
    case 'general.supportContact':
      return 'До 120 символов, без переводов строк; пусто — не показывать'
    case 'eventBalance.newOrganizationGrant':
      return 'Целое число от 1 до 1000'
    case 'events.maxPublishedPerDay':
      return 'Целое число от 1 до 50 или пусто — без лимита'
    case 'bot.callbackLimit':
      return 'Целое число от 1 до 100'
    case 'bot.callbackWindowSeconds':
      return 'Целое число от 1 до 300'
  }
}

export interface SettingsChange {
  key: PlatformSettingKey
  value: unknown
  version: number
}

/**
 * Изменённые ключи раздела с их `version` из последнего ответа. Неизменённые поля не отправляются,
 * поэтому чужая правка другого ключа не даёт конфликта.
 */
export function sectionChanges(
  section: EditableSection,
  form: SettingsForm,
  data: PlatformSettingsResponse,
): SettingsChange[] {
  const changes: SettingsChange[] = []
  for (const key of EDITABLE_KEYS[section]) {
    const value = parseFieldInput(key, form[key])
    const parsed = parsePlatformSetting(key, value)
    const next = parsed.ok ? parsed.value : value
    if (JSON.stringify(next ?? null) === JSON.stringify(data.settings[key].value ?? null)) continue
    changes.push({ key, value: next, version: data.settings[key].version })
  }
  return changes
}

/** Раздел менялся: есть что сохранять. */
export const sectionDirty = (
  section: EditableSection,
  form: SettingsForm,
  data: PlatformSettingsResponse,
): boolean => sectionChanges(section, form, data).length > 0

export const STALE_MESSAGE = 'Настройки изменил другой администратор — данные обновлены'

const KEY_LABELS = FIELD_LABELS

/** Значение в истории: пусто — «не задано / без лимита», строки в кавычках не берём. */
export function historyValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return key === 'events.maxPublishedPerDay' ? 'без лимита' : 'не задано'
  }
  return String(value)
}

export function historyRow(entry: PlatformSettingsHistoryEntry) {
  const label = KEY_LABELS[entry.key as PlatformSettingKey] ?? entry.key
  return {
    id: entry.id,
    when: entry.createdAt,
    who: entry.actor?.name ?? 'система',
    key: entry.key,
    label,
    from: historyValue(entry.key, entry.oldValue),
    to: historyValue(entry.key, entry.newValue),
  }
}

/** Булевы статусы для списков «включено / не настроено». */
export const statusText = (on: boolean): string => (on ? 'включено' : 'не настроено')
