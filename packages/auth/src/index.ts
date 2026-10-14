export { auth, type Auth } from './config'
export { getEmailDriver, type EmailDriver, type EmailMessage } from './email'
export {
  validateInitData,
  TelegramAuthError,
  type ValidatedInitData,
  type ValidatedTelegramUser,
} from './telegram/validate'
export {
  validateLoginWidgetData,
  LoginWidgetPayload,
  type ValidatedLoginWidgetData,
} from './telegram/login-widget'
export {
  telegramAuthSettingsFromEnv,
  TelegramConfigError,
  type TelegramAuthSettings,
} from './telegram/settings'
export {
  linkTelegramToUser,
  AccountAlreadyLinkedError,
  AccountLinkedToOtherUserError,
} from './linking'
export {
  authenticateViaTelegram,
  authenticateViaLoginWidget,
  type TelegramAuthResult,
} from './telegram/authenticate'
export { telegramPlugin, botTokenFromEnv, type TelegramPluginOptions } from './telegram/plugin'
