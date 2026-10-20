export const APP_NAME = 'Volley Time'
export { allocateSplitAmount, previewSplitAmount } from './events/pricing'
export {
  quoteEventPrice,
  type EventPriceQuote,
  type EventPriceQuoteInput,
  type PriceRange,
} from './events/price-quote'

export {
  expandSeriesRule,
  isoWeekday,
  RecurrenceError,
  SERIES_MAX_DATES,
  seriesOccurrence,
  type SeriesFreq,
  type SeriesRule,
} from './events/recurrence'

export { formatMoney, toMajor, toMinor } from './money/money'
export { slugify, uniqueSlug } from './slug/slug'
export {
  buildBotDeeplink,
  buildBotStartAppDeeplink,
  buildEventInviteStartParam,
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
export type {
  EventPricingView,
  PricingFinancials,
  PricingPermissions,
} from './events/pricing-types'
