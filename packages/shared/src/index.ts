export const APP_NAME = 'Volley Time'

export { formatMoney, toMajor, toMinor } from './money/money'
export { slugify, uniqueSlug } from './slug/slug'
export {
  buildBotDeeplink,
  buildInviteDeeplink,
  buildShareUrl,
  buildStartParam,
  parseInviteInput,
  resolveStartParam,
  type StartTarget,
  DeeplinkConfigError,
  type StartParamKind,
} from './telegram/deeplink'
export {
  DEFAULT_TIMEZONE,
  dateToZonedInput,
  formatDay,
  formatEventDate,
  formatShortDate,
  formatTime,
  zonedInputToDate,
} from './datetime/datetime'
