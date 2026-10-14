/** Вход в веб через Telegram Login Widget (D-05, 20.5.1): только JS-callback, без `data-auth-url`. */
export const TELEGRAM_WIDGET_ENDPOINT = '/api/auth/sign-in/telegram-widget'
export const TELEGRAM_WIDGET_SCRIPT = 'https://telegram.org/js/telegram-widget.js?22'
/** Имя глобального callback из `data-onauth`: виджет вызывает его с подписанными данными. */
export const TELEGRAM_WIDGET_CALLBACK = 'vtTelegramLoginAuth'

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
