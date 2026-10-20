import {
  and,
  db,
  desc,
  eq,
  events,
  gt,
  inArray,
  isNull,
  ne,
  lt,
  or,
  organizationMembers,
  organizations,
  organizationTelegramChats,
  telegramChatLinkCodes,
  venues,
  type OrganizationTelegramChat,
} from '@volley-time/db'
import { buildBotStartAppDeeplink, buildStartParam } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { takenSeats } from '../bookings/seats'
import { EventNotFoundError } from '../events/errors'
import { DeliveryError, notifierService } from '../notifier'
import {
  actorUserId,
  getDb,
  inTransaction,
  systemContext,
  type ServiceContext,
} from '../shared/context'

import { buildEventAnnouncement } from './announcement'
import {
  formatLinkCode,
  generateLinkCode,
  hashLinkCode,
  LINK_CODE_TTL_MS,
  normalizeLinkCode,
} from './code'
import {
  TelegramChatDeliveryFailedError,
  TelegramChatEventNotAnnounceableError,
  TelegramChatGroupHasChatError,
  TelegramChatInvalidError,
  TelegramChatNotLinkedError,
  TelegramChatRateLimitedError,
} from './errors'
import {
  ChatMembershipInput,
  ClaimChatLinkInput,
  type ChatMembershipInput as MembershipInput,
  type ClaimChatLinkInput as ClaimInput,
} from './schemas'

/** Причины недействительной (но не снятой) привязки; исключение бота привязку снимает. */
type InvalidReason = 'no_rights' | 'migrated'
type FailureReason = InvalidReason | 'bot_removed'

/** Состояние привязки для организатора: без Telegram id чата и администратора, без кода. */
export interface ChatLinkStatusView {
  link: {
    status: 'active' | 'invalid'
    title: string
    chatType: 'group' | 'supergroup'
    invalidReason: InvalidReason | null
    botCanPost: boolean
    linkedAt: Date
    permissionsCheckedAt: Date
  } | null
  /** Выданный и ещё не использованный код: сам код после выдачи не показывается. */
  pendingCode: { expiresAt: Date } | null
  /** Последняя снятая привязка, если действующей нет: организатор видит, почему чат отвязан. */
  released: { reason: 'organizer' | 'bot_removed'; at: Date } | null
}

export type ClaimResult =
  | { outcome: 'linked'; organizationName: string; botCanPost: boolean }
  | { outcome: 'code_invalid' | 'chat_taken' | 'group_has_chat' | 'rejected' }

const OPEN = (chats: typeof organizationTelegramChats) =>
  or(eq(chats.status, 'active'), eq(chats.status, 'invalid'))

const view = (row: OrganizationTelegramChat): NonNullable<ChatLinkStatusView['link']> => ({
  status: row.status === 'invalid' ? 'invalid' : 'active',
  title: row.title,
  chatType: row.chatType as 'group' | 'supergroup',
  invalidReason: (row.invalidReason as InvalidReason | null) ?? null,
  botCanPost: row.botCanPost,
  linkedAt: row.linkedAt,
  permissionsCheckedAt: row.permissionsCheckedAt,
})

async function openLink(
  db_: ReturnType<typeof getDb>,
  organizationId: number,
): Promise<OrganizationTelegramChat | null> {
  const [row] = await db_
    .select()
    .from(organizationTelegramChats)
    .where(
      and(
        eq(organizationTelegramChats.organizationId, organizationId),
        OPEN(organizationTelegramChats),
      ),
    )
  return row ?? null
}

/**
 * Снять привязку (организатором или исключением бота): строка остаётся историей с причиной, чат и
 * группа освобождаются, неиспользованные коды группы отзываются.
 */
async function releaseLink(
  db_: ReturnType<typeof getDb>,
  link: OrganizationTelegramChat,
  reason: 'organizer' | 'bot_removed',
  actor: ServiceContext,
): Promise<void> {
  const now = new Date()
  // уже снятая привязка (параллельная отвязка или исключение бота) не меняется и не пишет аудит
  const updated = await db_
    .update(organizationTelegramChats)
    .set({
      status: 'unlinked',
      invalidReason: null,
      unlinkReason: reason,
      botCanPost: reason === 'bot_removed' ? false : link.botCanPost,
      unlinkedAt: now,
      unlinkedByUserId: reason === 'organizer' ? actorUserId(actor) : null,
      statusChangedAt: now,
    })
    .where(
      and(
        eq(organizationTelegramChats.id, link.id),
        ne(organizationTelegramChats.status, 'unlinked'),
      ),
    )
    .returning({ id: organizationTelegramChats.id })
  if (updated.length === 0) return
  await db_
    .delete(telegramChatLinkCodes)
    .where(
      and(
        eq(telegramChatLinkCodes.organizationId, link.organizationId),
        isNull(telegramChatLinkCodes.consumedAt),
      ),
    )
  await auditService.record(
    { ...actor, db: db_ },
    {
      organizationId: link.organizationId,
      action: AUDIT_ACTIONS.TELEGRAM_CHAT_UNLINKED,
      entityType: 'telegram_chat',
      entityId: link.id,
      oldValue: { status: link.status, invalidReason: link.invalidReason },
      newValue: { reason },
    },
  )
}

export const telegramChatService = {
  /** Привязка группы и выданный код (для кабинета). */
  async status(ctx: ServiceContext, organizationId: number): Promise<ChatLinkStatusView> {
    const d = getDb(ctx)
    const row = await openLink(d, organizationId)
    const [code] = await d
      .select({ expiresAt: telegramChatLinkCodes.expiresAt })
      .from(telegramChatLinkCodes)
      .where(
        and(
          eq(telegramChatLinkCodes.organizationId, organizationId),
          isNull(telegramChatLinkCodes.consumedAt),
          gt(telegramChatLinkCodes.expiresAt, new Date()),
        ),
      )
    let released: ChatLinkStatusView['released'] = null
    if (!row) {
      const [last] = await d
        .select()
        .from(organizationTelegramChats)
        .where(
          and(
            eq(organizationTelegramChats.organizationId, organizationId),
            eq(organizationTelegramChats.status, 'unlinked'),
          ),
        )
        .orderBy(desc(organizationTelegramChats.unlinkedAt))
        .limit(1)
      if (last?.unlinkedAt)
        released = { reason: last.unlinkReason as 'organizer' | 'bot_removed', at: last.unlinkedAt }
    }
    return { link: row ? view(row) : null, pendingCode: code ?? null, released }
  },

  /**
   * Выдать одноразовый код привязки (организатор/владелец проверены маршрутом). Предыдущие
   * неиспользованные коды группы и просроченные отзываются. Сам код возвращается один раз; в базе —
   * хэш, в журнале — только срок.
   */
  async issueCode(
    ctx: ServiceContext,
    organizationId: number,
  ): Promise<{ code: string; expiresAt: Date }> {
    return inTransaction(ctx, async (tx) => {
      const d = getDb(tx)
      if (await openLink(d, organizationId)) throw new TelegramChatGroupHasChatError()
      const now = new Date()
      await d
        .delete(telegramChatLinkCodes)
        .where(
          and(
            eq(telegramChatLinkCodes.organizationId, organizationId),
            or(isNull(telegramChatLinkCodes.consumedAt), lt(telegramChatLinkCodes.expiresAt, now)),
          ),
        )
      const code = generateLinkCode()
      const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS)
      const [row] = await d
        .insert(telegramChatLinkCodes)
        .values({
          organizationId,
          createdByUserId: ctx.userId,
          codeHash: hashLinkCode(code),
          expiresAt,
        })
        .returning({ id: telegramChatLinkCodes.id })
      await auditService.record(tx, {
        organizationId,
        action: AUDIT_ACTIONS.TELEGRAM_CHAT_CODE_ISSUED,
        entityType: 'organization',
        entityId: organizationId,
        newValue: { codeId: row!.id, expiresAt },
      })
      return { code: formatLinkCode(code), expiresAt }
    })
  },

  /**
   * Бот принял код в групповом чате (администратора чата и право бота писать проверяет бот через
   * `getChatMember`). Код одноразовый (условный UPDATE), с TTL и привязан к группе, выдавшей его:
   * чужой, просроченный и повторный код привязки не создают. Код выдал действующий owner/organizer —
   * иначе (понижен, заблокирован, группа в архиве) он недействителен. Код сгорает при любом исходе,
   * кроме неверного/просроченного: привязан, не администратор (`verdict: 'rejected'`), чат занят
   * группой, у группы уже есть чат — опубликованный в чате код нельзя использовать повторно
   * (решение владельца 2026-10-20).
   */
  async claim(input: ClaimInput): Promise<ClaimResult> {
    const data = ClaimChatLinkInput.parse(input)
    const code = normalizeLinkCode(data.code)
    if (!code) return { outcome: 'code_invalid' }
    return db.transaction(async (tx): Promise<ClaimResult> => {
      const now = new Date()
      const [consumed] = await tx
        .update(telegramChatLinkCodes)
        .set({ consumedAt: now })
        .where(
          and(
            eq(telegramChatLinkCodes.codeHash, hashLinkCode(code)),
            isNull(telegramChatLinkCodes.consumedAt),
            gt(telegramChatLinkCodes.expiresAt, now),
          ),
        )
        .returning()
      if (!consumed) return { outcome: 'code_invalid' }
      if (data.verdict === 'rejected') return { outcome: 'rejected' }
      const orgId = consumed.organizationId
      const chatId = BigInt(data.chatId)

      const [issuer] = await tx
        .select({ name: organizations.name })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(
          and(
            eq(organizationMembers.organizationId, orgId),
            eq(organizationMembers.userId, consumed.createdByUserId),
            eq(organizationMembers.status, 'active'),
            inArray(organizationMembers.role, ['owner', 'organizer']),
            eq(organizations.status, 'active'),
          ),
        )
      if (!issuer) return { outcome: 'code_invalid' }

      // чат или группа заняты не отвязанной привязкой (в том числе недействительной): новая привязка
      // возможна только после отвязки; возвращение бота старую привязку не оживляет
      const [sameChat] = await tx
        .select({ organizationId: organizationTelegramChats.organizationId })
        .from(organizationTelegramChats)
        .where(
          and(
            eq(organizationTelegramChats.telegramChatId, chatId),
            OPEN(organizationTelegramChats),
          ),
        )
      if (sameChat) {
        return { outcome: sameChat.organizationId === orgId ? 'group_has_chat' : 'chat_taken' }
      }
      if (await openLink(tx, orgId)) return { outcome: 'group_has_chat' }

      const [inserted] = await tx
        .insert(organizationTelegramChats)
        .values({
          organizationId: orgId,
          telegramChatId: chatId,
          chatType: data.chatType,
          title: data.title,
          botCanPost: data.botCanPost,
          linkedByUserId: consumed.createdByUserId,
          confirmedByTelegramId: BigInt(data.confirmedByTelegramId),
        })
        .onConflictDoNothing()
        .returning({ id: organizationTelegramChats.id })
      if (!inserted) {
        // параллельная привязка выиграла уникальный индекс: чат или группа уже заняты
        const taken = await tx
          .select({ id: organizationTelegramChats.id })
          .from(organizationTelegramChats)
          .where(
            and(
              eq(organizationTelegramChats.telegramChatId, chatId),
              OPEN(organizationTelegramChats),
            ),
          )
        return { outcome: taken.length > 0 ? 'chat_taken' : 'group_has_chat' }
      }

      await auditService.record(
        { userId: consumed.createdByUserId, db: tx },
        {
          organizationId: orgId,
          action: AUDIT_ACTIONS.TELEGRAM_CHAT_LINKED,
          entityType: 'telegram_chat',
          entityId: inserted.id,
          newValue: { chatType: data.chatType, title: data.title, botCanPost: data.botCanPost },
        },
      )
      return { outcome: 'linked', organizationName: issuer.name, botCanPost: data.botCanPost }
    })
  },

  /**
   * `my_chat_member` бота в групповом чате: обновляет только существующую не отвязанную привязку
   * (нового чата это обновление не создаёт — привязку подтверждают код и администратор чата).
   * Исключение бота (`left`/`kicked`) снимает привязку и освобождает чат: возвращение бота её не
   * оживляет, нужен новый код. Потеря права писать делает привязку недействительной (`no_rights`),
   * возвращение права оживляет её; перенесённый в супергруппу чат (`migrated`) не оживает.
   */
  async syncBotMembership(input: MembershipInput): Promise<{ matched: boolean }> {
    const data = ChatMembershipInput.parse(input)
    const chatId = BigInt(data.chatId)
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(organizationTelegramChats)
        .where(
          and(
            eq(organizationTelegramChats.telegramChatId, chatId),
            OPEN(organizationTelegramChats),
          ),
        )
        .for('update')
      if (!row) return { matched: false }
      if (data.status === 'left' || data.status === 'kicked') {
        await releaseLink(tx, row, 'bot_removed', systemContext(tx))
        return { matched: true }
      }
      if (row.invalidReason === 'migrated') return { matched: true }
      const reason: InvalidReason | null = data.canPost ? null : 'no_rights'
      const now = new Date()
      const changed = reason !== row.invalidReason
      await tx
        .update(organizationTelegramChats)
        .set({
          status: reason ? 'invalid' : 'active',
          invalidReason: reason,
          botCanPost: data.canPost,
          title: data.title ?? row.title,
          permissionsCheckedAt: now,
          ...(changed ? { statusChangedAt: now } : {}),
        })
        .where(eq(organizationTelegramChats.id, row.id))
      if (changed) {
        await auditService.record(systemContext(tx), {
          organizationId: row.organizationId,
          action: AUDIT_ACTIONS.TELEGRAM_CHAT_STATUS_CHANGED,
          entityType: 'telegram_chat',
          entityId: row.id,
          oldValue: { status: row.status, invalidReason: row.invalidReason },
          newValue: { status: reason ? 'invalid' : 'active', invalidReason: reason },
        })
      }
      return { matched: true }
    })
  },

  /** Отвязать чат (организатор/владелец проверены маршрутом); повтор — `unlinked: false`. */
  async unlink(ctx: ServiceContext, organizationId: number): Promise<{ unlinked: boolean }> {
    return inTransaction(ctx, async (tx) => {
      const d = getDb(tx)
      const row = await openLink(d, organizationId)
      // неиспользованный код после отвязки не должен привязать чат «задним числом»
      await d
        .delete(telegramChatLinkCodes)
        .where(
          and(
            eq(telegramChatLinkCodes.organizationId, organizationId),
            isNull(telegramChatLinkCodes.consumedAt),
          ),
        )
      if (!row) return { unlinked: false }
      await releaseLink(d, row, 'organizer', tx)
      return { unlinked: true }
    })
  },

  /**
   * Анонс события в привязанный чат группы. Текст и кнопки строятся из данных события, а не из тела
   * запроса; событие должно принадлежать группе (чужое неотличимо от несуществующего), быть
   * опубликованным и не начавшимся. Чат — только действующий. Ошибки Bot API превращаются в понятные
   * коды (`telegram_chat.bot_removed|no_rights|migrated|rate_limited|delivery_failed`) и не несут
   * токенов; недоступный чат помечается недействительным, исключённый бот — снимает привязку.
   */
  async announceEvent(
    ctx: ServiceContext,
    organizationId: number,
    eventId: number,
    opts: { botUsername: string },
  ): Promise<{ announced: true }> {
    const d = getDb(ctx)
    const [row] = await d
      .select({
        event: events,
        timeZone: organizations.defaultTimezone,
        organizationName: organizations.name,
        venueName: venues.name,
      })
      .from(events)
      .innerJoin(organizations, eq(organizations.id, events.organizationId))
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(and(eq(events.id, eventId), eq(events.organizationId, organizationId)))
    if (!row) throw new EventNotFoundError(eventId)
    if (row.event.status !== 'published' || row.event.startsAt <= new Date())
      throw new TelegramChatEventNotAnnounceableError()

    const link = await openLink(d, organizationId)
    if (!link) throw new TelegramChatNotLinkedError()
    if (link.status === 'invalid')
      throw new TelegramChatInvalidError(link.invalidReason as InvalidReason)

    const message = buildEventAnnouncement({
      title: row.event.title,
      startsAt: row.event.startsAt,
      timeZone: row.timeZone,
      placeName: row.venueName ?? row.organizationName,
      capacity: row.event.capacity,
      taken: await takenSeats(d, eventId),
      deeplink: buildBotStartAppDeeplink(opts.botUsername, buildStartParam('event', eventId)),
    })

    try {
      await notifierService.sendToChat(String(link.telegramChatId), message)
    } catch (e) {
      throw await this.mapDeliveryFailure(link, e)
    }
    await auditService.record(ctx, {
      organizationId,
      action: AUDIT_ACTIONS.TELEGRAM_CHAT_ANNOUNCED,
      entityType: 'event',
      entityId: eventId,
      newValue: { chatLinkId: link.id },
    })
    return { announced: true }
  },

  /** Ошибка транспорта -> доменная ошибка; недоступный чат помечается недействительным или снимается. */
  async mapDeliveryFailure(link: OrganizationTelegramChat, e: unknown): Promise<Error> {
    if (e instanceof DeliveryError) {
      if (e.kind === 'rate_limited') return new TelegramChatRateLimitedError()
      if (e.kind === 'blocked') {
        const reason: FailureReason = e.reason ?? 'bot_removed'
        await this.markUnavailable(link, reason)
        return new TelegramChatInvalidError(reason)
      }
    }
    console.error('[telegram-chat] announce delivery failed', { linkId: link.id })
    return new TelegramChatDeliveryFailedError()
  },

  /** Исключённый бот снимает привязку (чат свободен), нет права / перенос — делают её недействительной. */
  async markUnavailable(link: OrganizationTelegramChat, reason: FailureReason): Promise<void> {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(organizationTelegramChats)
        .where(
          and(
            eq(organizationTelegramChats.id, link.id),
            eq(organizationTelegramChats.status, 'active'),
          ),
        )
        .for('update')
      if (!current) return
      if (reason === 'bot_removed') {
        await releaseLink(tx, current, 'bot_removed', systemContext(tx))
        return
      }
      const now = new Date()
      await tx
        .update(organizationTelegramChats)
        .set({
          status: 'invalid',
          invalidReason: reason,
          botCanPost: false,
          permissionsCheckedAt: now,
          statusChangedAt: now,
        })
        .where(eq(organizationTelegramChats.id, link.id))
      await auditService.record(systemContext(tx), {
        organizationId: link.organizationId,
        action: AUDIT_ACTIONS.TELEGRAM_CHAT_STATUS_CHANGED,
        entityType: 'telegram_chat',
        entityId: link.id,
        oldValue: { status: 'active', invalidReason: null },
        newValue: { status: 'invalid', invalidReason: reason },
      })
    })
  },
}
