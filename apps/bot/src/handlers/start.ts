import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { env } from '../env'

import { parseDeeplink } from './deeplink'

export interface InvitePreview {
  status: 'valid' | 'revoked' | 'expired' | 'exhausted' | 'not_found'
  organizationName: string | null
  membersCount: number
  inviterName: string | null
}

const INVALID_REASON: Record<string, string> = {
  revoked: 'Организатор отозвал эту ссылку.',
  expired: 'Срок действия ссылки истёк.',
  exhausted: 'По ссылке уже вступило максимальное число участников.',
  not_found: 'Приглашение не найдено.',
}

/**
 * Контекст приглашения из web по внутреннему секрету (Task 8.8.10).
 * Ошибка/таймаут → null: бот отвечает обычным текстом.
 */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const res = await fetch(
      `${env.WEB_URL}/api/internal/invites/${encodeURIComponent(token)}/preview`,
      {
        headers: { 'x-internal-secret': env.INTERNAL_SECRET },
        signal: AbortSignal.timeout(3000),
      },
    )
    if (!res.ok) return null
    return (await res.json()) as InvitePreview
  } catch {
    return null
  }
}

/** Приветственный текст по имени, deeplink и (необязательному) превью приглашения. */
export function buildStartMessage(
  firstName: string,
  startParam: string | undefined,
  preview?: InvitePreview | null,
): string {
  const dl = parseDeeplink(startParam)
  if (dl.kind === 'org_invite') {
    if (preview && preview.status !== 'valid') {
      return (
        `Привет, ${firstName}! 🏐\n\n` +
        `${INVALID_REASON[preview.status] ?? 'Приглашение недействительно.'}\n` +
        `Попроси организатора прислать новую ссылку.`
      )
    }
    if (preview?.organizationName) {
      const who = preview.inviterName
        ? `<b>${preview.inviterName}</b> приглашает`
        : 'Тебя приглашают'
      return (
        `Привет, ${firstName}! 🏐\n\n` +
        `${who} тебя в группу <b>${preview.organizationName}</b>` +
        (preview.membersCount ? ` (${preview.membersCount} участников)` : '') +
        `.\nОткрой приложение, чтобы принять приглашение.`
      )
    }
    return (
      `Привет, ${firstName}! 🏐\n\n` +
      `Тебя пригласили в организацию на Volley Time.\n` +
      `Открой приложение, чтобы принять приглашение и присоединиться.`
    )
  }
  if (dl.kind === 'event') {
    return (
      `Привет, ${firstName}! 🏐\n\n` +
      `Тебя приглашают на событие. Открой приложение, чтобы посмотреть детали и записаться.`
    )
  }
  return (
    `Привет, ${firstName}! 🏐\n\n` +
    `Volley Time — платформа для организации волейбольных тренировок и игр.\n\n` +
    `Нажми кнопку ниже, чтобы открыть приложение.`
  )
}

/** URL Mini App с опциональным deeplink-контекстом. */
export function buildMiniAppUrl(startParam: string | undefined): string {
  const base = `${env.WEB_URL}/m/`
  const dl = parseDeeplink(startParam)
  // startapp читается Mini App как start_param (8.8.3)
  if (dl.kind === 'org_invite') return `${base}?startapp=org_${encodeURIComponent(dl.token)}`
  if (dl.kind === 'event') return `${base}?startapp=event_${dl.eventId}`
  return base
}

export function registerStartHandler(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    const user = ctx.from
    if (!user) {
      await ctx.reply('Не удалось определить пользователя')
      return
    }
    const startParam = ctx.match || undefined
    const dl = parseDeeplink(startParam)
    const preview = dl.kind === 'org_invite' ? await fetchInvitePreview(dl.token) : null
    const text = buildStartMessage(user.first_name, startParam, preview)
    const keyboard = new InlineKeyboard().webApp(
      preview?.status === 'valid' ? '🏐 Открыть приглашение' : '🏐 Открыть Volley Time',
      buildMiniAppUrl(startParam),
    )
    await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'HTML' })
  })
}
