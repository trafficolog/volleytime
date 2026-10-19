import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { env } from '../env'
import { callWeb } from '../web-client'

import { esc, formatWhen, short } from './format'
import { MENU_GAMES } from './menu'

export interface GameRow {
  eventId: number
  title: string
  startsAt: string
  timeZone: string
  organizationName: string
  venueName: string | null
  capacity: number
  taken: number
}

export const NO_GAMES_TEXT =
  'Ближайших событий в ваших группах нет.\nКак только организатор откроет запись — пришлю уведомление.'
export const UNAVAILABLE_TEXT = 'Сервис временно недоступен, попробуйте чуть позже.'

/** Метка заполненности: 🔴 мест нет, 🟡 осталось мало (≥75%), 🟢 свободно (макет «Расписание»). */
export function occupancyMark(taken: number, capacity: number): string {
  if (capacity > 0 && taken >= capacity) return '🔴'
  return capacity > 0 && taken / capacity >= 0.75 ? '🟡' : '🟢'
}

export function eventUrl(eventId: number): string {
  return `${env.WEB_URL}/m/?startapp=event_${eventId}`
}

export function buildGamesMessage(games: GameRow[]): { text: string; keyboard?: InlineKeyboard } {
  if (games.length === 0) return { text: NO_GAMES_TEXT }
  const lines = ['<b>Ближайшие события</b>']
  const keyboard = new InlineKeyboard()
  for (const g of games) {
    const free = g.taken >= g.capacity ? 'мест нет' : `занято ${g.taken} из ${g.capacity}`
    lines.push(
      `${occupancyMark(g.taken, g.capacity)} <b>${esc(g.title)}</b> — ${esc(formatWhen(g.startsAt, g.timeZone))}`,
      `<i>${esc([g.venueName ?? g.organizationName, free].join(' · '))}</i>`,
    )
    keyboard.webApp(`Открыть: ${short(g.title)}`, eventUrl(g.eventId)).row()
  }
  return { text: lines.join('\n'), keyboard }
}

export async function sendGames(ctx: BotContext): Promise<void> {
  if (!ctx.from) return
  const res = await callWeb<{ games: GameRow[] }>('games', {
    query: { telegramId: String(ctx.from.id) },
  })
  if (!res) {
    await ctx.reply(UNAVAILABLE_TEXT)
    return
  }
  const { text, keyboard } = buildGamesMessage(res.games)
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard })
}

export function registerGamesHandler(bot: Bot<BotContext>): void {
  bot.command('games', sendGames)
  bot.hears(MENU_GAMES, async (ctx) => {
    if (ctx.chat.type === 'private') await sendGames(ctx)
  })
}
