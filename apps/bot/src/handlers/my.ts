import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { callWeb } from '../web-client'

import { esc, formatWhen, short } from './format'
import { eventUrl, UNAVAILABLE_TEXT } from './games'
import { MENU_MY } from './menu'

export interface MyBookingRow {
  eventId: number
  bookingId: number
  title: string
  startsAt: string
  timeZone: string
  organizationName: string
  venueName: string | null
  status: 'confirmed' | 'pending_payment' | 'waitlisted' | 'attended' | 'no_show'
  seats: number
}

export const NO_BOOKINGS_TEXT = 'Предстоящих записей нет.\nВыберите событие в /games.'

const STATUS_LABEL: Record<MyBookingRow['status'], string> = {
  confirmed: '✅ вы в составе',
  pending_payment: '💳 ждёт оплаты',
  waitlisted: '📋 лист ожидания',
  attended: '✅ были',
  no_show: '✅ отмечено',
}

/** `callback_data` кнопки отмены: по id события web находит только запись самого пользователя. */
export const cancelAskData = (eventId: number) => `cx:${eventId}`

export function buildMyMessage(rows: MyBookingRow[]): { text: string; keyboard?: InlineKeyboard } {
  if (rows.length === 0) return { text: NO_BOOKINGS_TEXT }
  const lines = ['<b>Мои записи</b>']
  const keyboard = new InlineKeyboard()
  for (const b of rows) {
    const seats = b.seats > 1 ? ` · мест: ${b.seats}` : ''
    lines.push(
      `<b>${esc(b.title)}</b> — ${esc(formatWhen(b.startsAt, b.timeZone))}`,
      `<i>${esc(b.venueName ?? b.organizationName)} · ${STATUS_LABEL[b.status]}${seats}</i>`,
    )
    keyboard.webApp(`Открыть: ${short(b.title, 22)}`, eventUrl(b.eventId))
    if (b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'waitlisted')
      keyboard.text('Отменить', cancelAskData(b.eventId))
    keyboard.row()
  }
  return { text: lines.join('\n'), keyboard }
}

export async function sendMy(ctx: BotContext): Promise<void> {
  if (!ctx.from) return
  const res = await callWeb<{ bookings: MyBookingRow[] }>('my', {
    query: { telegramId: String(ctx.from.id) },
  })
  if (!res) {
    await ctx.reply(UNAVAILABLE_TEXT)
    return
  }
  const { text, keyboard } = buildMyMessage(res.bookings)
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard })
}

export function registerMyHandler(bot: Bot<BotContext>): void {
  bot.chatType('private').command('my', sendMy)
  bot.hears(MENU_MY, async (ctx) => {
    if (ctx.chat.type === 'private') await sendMy(ctx)
  })
}
