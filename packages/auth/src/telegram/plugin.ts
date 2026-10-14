import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'

import {
  AccountAlreadyLinkedError,
  AccountLinkedToOtherUserError,
  linkTelegramToUser,
} from '../linking'

import { authenticateViaLoginWidget, authenticateViaTelegram } from './authenticate'
import { LoginWidgetPayload } from './login-widget'
import {
  TelegramConfigError,
  telegramAuthSettingsFromEnv,
  type TelegramAuthSettings,
} from './settings'
import { TelegramAuthError } from './validate'

export interface TelegramPluginOptions {
  /** Токен бота читается лениво: значение может появиться после импорта модуля. */
  getBotToken: () => string
  /** Срок жизни initData и флаг Login Widget; читаются лениво на каждый запрос (19.3.1). */
  getSettings?: () => TelegramAuthSettings
}

/** Токен бота из окружения процесса (web: NUXT_* перекрывает обычную переменную). */
export function botTokenFromEnv(): string {
  return (process.env.NUXT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim()
}

function requireToken(opts: TelegramPluginOptions): string {
  const token = opts.getBotToken()
  if (!token) {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Вход через Telegram не настроен на сервере',
      code: 'telegram.not_configured',
    })
  }
  return token
}

function requireSettings(opts: TelegramPluginOptions): TelegramAuthSettings {
  try {
    return (opts.getSettings ?? telegramAuthSettingsFromEnv)()
  } catch (e) {
    if (e instanceof TelegramConfigError) {
      // в сообщении только имя переменной и правило, значений нет
      console.error('[telegram] invalid auth settings:', e.message)
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: 'Вход через Telegram не настроен на сервере',
        code: 'telegram.not_configured',
      })
    }
    throw e
  }
}

const INVALID_TELEGRAM_SIGN_IN =
  'Не удалось подтвердить вход через Telegram. Откройте приложение заново из чата с ботом.'

/**
 * Telegram Mini App вход как плагин better-auth (Task 3.9.4).
 * Единственный источник сессий — better-auth: эндпоинт создаёт стандартную сессию и cookie.
 */
export function telegramPlugin(opts: TelegramPluginOptions) {
  return {
    id: 'telegram',
    endpoints: {
      signInTelegram: createAuthEndpoint(
        '/sign-in/telegram',
        { method: 'POST', body: z.object({ initData: z.string().min(1) }) },
        async (ctx) => {
          const botToken = requireToken(opts)
          const settings = requireSettings(opts)
          let result: Awaited<ReturnType<typeof authenticateViaTelegram>>
          try {
            result = await authenticateViaTelegram(ctx.body.initData, botToken, {
              maxAgeSeconds: settings.initDataMaxAgeSeconds,
            })
          } catch (e) {
            if (e instanceof TelegramAuthError) {
              // техническая причина остаётся в логах, пользователю — русский текст (Task 3.10.3)
              console.warn('[telegram] sign-in rejected:', e.message)
              throw new APIError('UNAUTHORIZED', {
                message: INVALID_TELEGRAM_SIGN_IN,
                code: 'telegram.invalid',
              })
            }
            throw e
          }
          const user = await ctx.context.internalAdapter.findUserById(String(result.userId))
          if (!user)
            throw new APIError('UNAUTHORIZED', {
              message: 'Пользователь не найден',
              code: 'user.not_found',
            })
          const session = await ctx.context.internalAdapter.createSession(user.id)
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ userId: result.userId, isNewUser: result.isNewUser })
        },
      ),

      /**
       * Вход в веб через Telegram Login Widget (D-05, 19.3.1). Выключен, пока не задан
       * TELEGRAM_LOGIN_WIDGET_ENABLED=true: до этого эндпоинт отвечает 404.
       */
      signInTelegramWidget: createAuthEndpoint(
        '/sign-in/telegram-widget',
        { method: 'POST', body: LoginWidgetPayload },
        async (ctx) => {
          const settings = requireSettings(opts)
          if (!settings.loginWidget.enabled) {
            throw new APIError('NOT_FOUND', {
              message: 'Вход через Telegram на сайте не включён',
              code: 'telegram.login_widget_disabled',
            })
          }
          const botToken = requireToken(opts)
          let result: Awaited<ReturnType<typeof authenticateViaLoginWidget>>
          try {
            result = await authenticateViaLoginWidget(ctx.body, botToken, {
              maxAgeSeconds: settings.loginWidget.maxAgeSeconds,
            })
          } catch (e) {
            if (e instanceof TelegramAuthError) {
              console.warn('[telegram] widget sign-in rejected:', e.message)
              throw new APIError('UNAUTHORIZED', {
                message: 'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.',
                code: 'telegram.invalid',
              })
            }
            throw e
          }
          const user = await ctx.context.internalAdapter.findUserById(String(result.userId))
          if (!user)
            throw new APIError('UNAUTHORIZED', {
              message: 'Пользователь не найден',
              code: 'user.not_found',
            })
          const session = await ctx.context.internalAdapter.createSession(user.id)
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ userId: result.userId, isNewUser: result.isNewUser })
        },
      ),

      /** Привязать Telegram к текущему (email) аккаунту. 409 при конфликте (Task 3.9.8). */
      linkTelegram: createAuthEndpoint(
        '/link/telegram',
        {
          method: 'POST',
          body: z.object({ initData: z.string().min(1) }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const botToken = requireToken(opts)
          const settings = requireSettings(opts)
          const userId = Number(ctx.context.session.user.id)
          try {
            const { linkedTelegramId } = await linkTelegramToUser(
              userId,
              ctx.body.initData,
              botToken,
              { maxAgeSeconds: settings.initDataMaxAgeSeconds },
            )
            return ctx.json({ linked: true, telegramUserId: String(linkedTelegramId) })
          } catch (e) {
            if (e instanceof TelegramAuthError) {
              console.warn('[telegram] link rejected:', e.message)
              throw new APIError('UNAUTHORIZED', {
                message: 'Не удалось подтвердить Telegram-аккаунт',
                code: 'telegram.invalid',
              })
            }
            if (e instanceof AccountAlreadyLinkedError) {
              throw new APIError('CONFLICT', { message: e.message, code: 'account.already_linked' })
            }
            if (e instanceof AccountLinkedToOtherUserError) {
              throw new APIError('CONFLICT', {
                message: 'Этот Telegram уже привязан к другому аккаунту',
                code: 'account.linked_to_other_user',
              })
            }
            throw e
          }
        },
      ),
    },
  } satisfies BetterAuthPlugin
}
