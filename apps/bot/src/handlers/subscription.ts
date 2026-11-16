import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { env } from '../env'
import { callWeb } from '../web-client'

import { esc, formatDate, short } from './format'
import { UNAVAILABLE_TEXT } from './games'
import { MENU_SUBS } from './menu'

/** Ответ web `subscriptions`: действующий абонемент игрока в одной из его групп (21.4.9). */
export interface SubscriptionRow {
  organizationId: number
  organizationName: string
  timeZone: string
  planName: string
  remaining: number
  total: number
  /** `null` — бессрочный. */
  expiresAt: string | null
}

export const NO_SUBSCRIPTIONS_TEXT =
  'Действующих абонементов нет.\nАбонемент можно оформить в приложении.'

function sessions(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'занятие'
  return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'занятия' : 'занятий'
}

/** Экран абонементов Mini App группы (доступ проверяет сам Mini App). */
export const subscriptionsUrl = (organizationId: number) =>
  `${env.WEB_URL}/m/orgs/${organizationId}/subscriptions`

export function buildSubscriptionsMessage(rows: SubscriptionRow[]): {
  text: string
  keyboard?: InlineKeyboard
} {
  if (rows.length === 0) return { text: NO_SUBSCRIPTIONS_TEXT }
  const lines = ['<b>Мой абонемент</b>']
  const keyboard = new InlineKeyboard()
  const linked = new Set<number>()
  for (const s of rows) {
    const until = s.expiresAt ? `до ${formatDate(s.expiresAt, s.timeZone)}` : 'бессрочно'
    lines.push(
      `<b>${esc(s.organizationName)}</b> — ${esc(s.planName)}`,
      `<i>Осталось ${s.remaining} ${sessions(s.remaining)} из ${s.total} · ${until}</i>`,
    )
    if (!linked.has(s.organizationId)) {
      linked.add(s.organizationId)
      keyboard
        .webApp(`Абонементы: ${short(s.organizationName, 22)}`, subscriptionsUrl(s.organizationId))
        .row()
    }
  }
  return { text: lines.join('\n'), keyboard }
}

export async function sendSubscriptions(ctx: BotContext): Promise<void> {
  if (!ctx.from) return
  const res = await callWeb<{ subscriptions: SubscriptionRow[] }>('subscriptions', {
    query: { telegramId: String(ctx.from.id) },
  })
  if (!res) {
    await ctx.reply(UNAVAILABLE_TEXT)
    return
  }
  const { text, keyboard } = buildSubscriptionsMessage(res.subscriptions)
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard })
}

export function registerSubscriptionHandler(bot: Bot<BotContext>): void {
  bot.hears(MENU_SUBS, async (ctx) => {
    if (ctx.chat.type === 'private') await sendSubscriptions(ctx)
  })
}
