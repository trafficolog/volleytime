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
import {
  loginWidgetEnabledFromEnv,
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
  /** Флаг Login Widget; по умолчанию — из окружения. Проверяется первым (404 при выключенном). */
  isLoginWidgetEnabled?: () => boolean
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

const WIDGET_PATH = '/sign-in/telegram-widget'
const WIDGET_DISABLED = {
  message: 'Вход через Telegram на сайте не включён',
  code: 'telegram.login_widget_disabled',
}

const INVALID_TELEGRAM_SIGN_IN =
  'Не удалось подтвердить вход через Telegram. Откройте приложение заново из чата с ботом.'

/**
 * Telegram Mini App вход как плагин better-auth (Task 3.9.4).
 * Единственный источник сессий — better-auth: эндпоинт создаёт стандартную сессию и cookie.
 */
export function telegramPlugin(opts: TelegramPluginOptions) {
  const widgetEnabled = () => (opts.isLoginWidgetEnabled ?? loginWidgetEnabledFromEnv)()
  return {
    id: 'telegram',
    /**
     * Выключенный Login Widget отвечает 404 до разбора тела (иначе не-JSON дал бы 400 и выдал
     * существование эндпоинта) и до проверки конфигурации (19.3.1 review).
     */
    onRequest: async (request: Request) => {
      if (request.method !== 'POST') return
      if (!new URL(request.url).pathname.endsWith(WIDGET_PATH)) return
      if (widgetEnabled()) return
      return { response: Response.json(WIDGET_DISABLED, { status: 404 }) }
    },
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
       * TELEGRAM_LOGIN_WIDGET_ENABLED=true: до этого эндпоинт отвечает 404 на любой запрос —
       * тело не разбирается, конфигурация не проверяется. Поэтому схема тела свободная,
       * а LoginWidgetPayload разбирается внутри, после проверки флага.
       */
      signInTelegramWidget: createAuthEndpoint(
        WIDGET_PATH,
        { method: 'POST', body: z.unknown().optional() },
        async (ctx) => {
          // повтор гейта onRequest для вызовов через auth.api без HTTP
          if (!widgetEnabled()) throw new APIError('NOT_FOUND', WIDGET_DISABLED)
          const settings = requireSettings(opts)
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
