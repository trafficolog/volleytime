/**
 * Вход в веб через Telegram (D-05, 20.5.1): только JS-колбэк `Telegram.Login.auth`.
 * Не `data-auth-url` (данные в URL) и не `data-onauth` (eval, запрещён CSP).
 */
export const TELEGRAM_WIDGET_ENDPOINT = '/api/auth/sign-in/telegram-widget'
export const TELEGRAM_WIDGET_SCRIPT = 'https://telegram.org/js/telegram-widget.js?22'

/** Часть API telegram-widget.js, которую мы используем. */
export interface TelegramWindow {
  Telegram?: {
    Login?: {
      auth: (
        options: { bot_id: number; request_access: boolean | 'write' },
        callback: (user: Record<string, unknown> | false) => void,
      ) => void
    }
  }
}

export type WidgetSignInResult = { kind: 'ok' } | { kind: 'error' }

/**
 * Отправляет данные виджета как есть: подпись покрывает все поля, в том числе добавленные
 * Telegram позже, поэтому поля не отбираются. Данные идут в теле POST, не в URL.
 */
export async function signInWithTelegramWidget(
  user: unknown,
  post: (body: Record<string, unknown>) => Promise<unknown>,
): Promise<WidgetSignInResult> {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return { kind: 'error' }
  try {
    await post(user as Record<string, unknown>)
    return { kind: 'ok' }
  } catch {
    return { kind: 'error' }
  }
}
