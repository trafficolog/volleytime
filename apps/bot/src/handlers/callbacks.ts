import { GrammyError, InlineKeyboard, type Bot } from 'grammy'
import type { InlineKeyboardButton, MessageEntity } from 'grammy/types'

import type { BotContext } from '../context'
import { callWeb } from '../web-client'

import { UNAVAILABLE_TEXT } from './games'

/**
 * Inline-кнопки бота (20.3.3). `callback_data` — только `<действие>:<id события>` (≤ 64 байт по
 * лимиту Bot API; здесь ≤ 14). Идентификатору из `callback_data` не доверяем: web находит запись и
 * предложение по Telegram id нажавшего, поэтому чужое событие даёт `not_found`.
 *   cx — «Не смогу»: спросить подтверждение; cy — подтвердить отмену; cn — оставить запись;
 *   oa — «Беру место»: принять предложение из листа ожидания.
 */
export const CALLBACK_RE = /^(cx|cy|cn|oa):(\d{1,10})$/

/** D-14: оплаченные места освобождаются без автоматического возврата (как у организатора). */
export const CANCEL_QUESTION =
  '❓ Отменить запись?\nОплаченные места освободятся без возврата денег: возврат — отдельное действие организатора.'
export const CANCEL_DONE = '✅ Запись отменена.'
export const CANCEL_DENIED = '⚠️ Отменить запись уже нельзя — напишите организатору.'
export const NOT_FOUND = '⚠️ Запись не найдена.'
export const OFFER_DONE = '✅ Место подтверждено.'
export const OFFER_EXPIRED = '⌛ Время на подтверждение вышло — место ушло дальше.'
export const OFFER_CLOSED = '⚠️ Запись на игру закрыта.'
export const OFFER_NOT_FOUND = '⚠️ Предложение не найдено.'
const STALE = 'Кнопка устарела, откройте /my'
const TOO_FAST = 'Слишком часто, подождите немного'

type CancelResult = 'cancelled' | 'already_cancelled' | 'not_found' | 'not_allowed'
type AcceptResult = 'accepted' | 'expired' | 'closed' | 'not_found'

/** Ограничение частоты нажатий на пользователя: 8 за 10 с (защита web и Bot API от флуда). */
const hits = new Map<number, number[]>()
export function callbackRateLimited(userId: number, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => t > now - 10_000)
  if (recent.length >= 8) {
    hits.set(userId, recent)
    return true
  }
  recent.push(now)
  hits.set(userId, recent)
  if (hits.size > 5000)
    for (const [k, v] of hits) if (v.every((t) => t <= now - 10_000)) hits.delete(k)
  return false
}
export function resetCallbackLimiter(): void {
  hits.clear()
}

const hasCallback = (b: InlineKeyboardButton) => 'callback_data' in b

/** Строки клавиатуры без callback-кнопок (ссылки «Открыть» сохраняются). */
function linkRows(rows: InlineKeyboardButton[][] | undefined): InlineKeyboardButton[][] {
  return (rows ?? []).filter((row) => !row.some(hasCallback))
}

async function editMessage(
  ctx: BotContext,
  text: string,
  entities: MessageEntity[] | undefined,
  rows: InlineKeyboardButton[][],
): Promise<void> {
  try {
    await ctx.editMessageText(text, {
      ...(entities?.length ? { entities } : {}),
      reply_markup: new InlineKeyboard(rows),
    })
  } catch (e) {
    // повторное нажатие устаревшей кнопки: сообщение уже в нужном виде
    if (e instanceof GrammyError && /message is not modified/i.test(e.description)) return
    throw e
  }
}

export function registerCallbackHandler(bot: Bot<BotContext>): void {
  bot.on('callback_query:data', async (ctx) => {
    const m = CALLBACK_RE.exec(ctx.callbackQuery.data)
    const msg = ctx.callbackQuery.message
    // только личный чат с самим пользователем и сообщение с текстом, которое мы можем править
    if (
      !m ||
      !msg ||
      !('text' in msg) ||
      msg.text === undefined ||
      msg.chat.type !== 'private' ||
      msg.chat.id !== ctx.from.id
    ) {
      await ctx.answerCallbackQuery({ text: STALE })
      return
    }
    if (callbackRateLimited(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: TOO_FAST })
      return
    }
    const action = m[1]!
    const eventId = Number(m[2])
    if (!Number.isSafeInteger(eventId) || eventId <= 0 || eventId > 2_147_483_647) {
      await ctx.answerCallbackQuery({ text: STALE })
      return
    }
    const text = msg.text
    const rows = msg.reply_markup?.inline_keyboard
    const base = msg.text.endsWith(`\n\n${CANCEL_QUESTION}`)
      ? msg.text.slice(0, -`\n\n${CANCEL_QUESTION}`.length)
      : msg.text
    const settled = (line: string) => text.endsWith(line)
    const finish = async (line: string, toast: string) => {
      await ctx.answerCallbackQuery({ text: toast })
      if (!settled(line)) await editMessage(ctx, `${base}\n\n${line}`, msg.entities, linkRows(rows))
    }

    if (action === 'cx') {
      await ctx.answerCallbackQuery()
      if (text.endsWith(CANCEL_QUESTION)) return
      await editMessage(ctx, `${base}\n\n${CANCEL_QUESTION}`, msg.entities, [
        ...linkRows(rows),
        [
          { text: 'Да, отменить', callback_data: `cy:${eventId}` },
          { text: 'Нет', callback_data: `cn:${eventId}` },
        ],
      ])
      return
    }
    if (action === 'cn') {
      await ctx.answerCallbackQuery({ text: 'Запись сохранена' })
      await editMessage(ctx, base, msg.entities, [
        ...linkRows(rows),
        [{ text: 'Отменить запись', callback_data: `cx:${eventId}` }],
      ])
      return
    }
    if (action === 'cy') {
      const res = await callWeb<{ result: CancelResult }>('cancel-booking', {
        method: 'POST',
        body: { telegramId: String(ctx.from.id), eventId },
      })
      if (!res) return void (await ctx.answerCallbackQuery({ text: UNAVAILABLE_TEXT }))
      if (res.result === 'cancelled' || res.result === 'already_cancelled')
        return finish(CANCEL_DONE, 'Запись отменена')
      if (res.result === 'not_allowed') return finish(CANCEL_DENIED, 'Отмена недоступна')
      return finish(NOT_FOUND, 'Запись не найдена')
    }
    // oa
    const res = await callWeb<{ result: AcceptResult }>('accept-offer', {
      method: 'POST',
      body: { telegramId: String(ctx.from.id), eventId },
    })
    if (!res) return void (await ctx.answerCallbackQuery({ text: UNAVAILABLE_TEXT }))
    if (res.result === 'accepted') return finish(OFFER_DONE, 'Место подтверждено')
    if (res.result === 'expired') return finish(OFFER_EXPIRED, 'Время вышло')
    if (res.result === 'closed') return finish(OFFER_CLOSED, 'Запись закрыта')
    return finish(OFFER_NOT_FOUND, 'Предложение не найдено')
  })
}
