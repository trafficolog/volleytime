export { auth, type Auth } from './config'
export { getEmailDriver, type EmailDriver, type EmailMessage } from './email'
export { validateInitData, TelegramAuthError, type ValidatedInitData } from './telegram/validate'
export {
  linkTelegramToUser,
  AccountAlreadyLinkedError,
  AccountLinkedToOtherUserError,
} from './linking'
export { authenticateViaTelegram, type TelegramAuthResult } from './telegram/authenticate'
export { telegramPlugin, botTokenFromEnv, type TelegramPluginOptions } from './telegram/plugin'
