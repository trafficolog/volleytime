import { db, eq, organizations, users, type OrganizationOwnershipTransfer } from '@volley-time/db'

import { AUDIT_ACTIONS, type AuditAction } from '../audit/actions'
import { auditService } from '../audit/service'
import { DeliveryError } from '../notifier/delivery-error'
import { notifierService } from '../notifier/service'
import type { NotificationType, TemplateParams } from '../notifier/templates'
import { systemContext } from '../shared/context'

/**
 * Итог отправки сообщения бота по передаче (21.4.7, 21.4.20; решение владельца 2026-11-11).
 * `no_telegram` — у адресата нет чата с ботом; `blocked` — бот заблокирован или чат недоступен;
 * `failed` — прочий сбой (лимит, таймаут, 5xx). Для ссылки получателю владелец видит «бот не
 * доставил» и отправляет ссылку сам, как до 21.4.7.
 */
export type BotDeliveryReason = 'no_telegram' | 'blocked' | 'failed'
export type BotDelivery =
  { status: 'delivered' } | { status: 'not_delivered'; reason: BotDeliveryReason }

const REASONS: readonly string[] = ['no_telegram', 'blocked', 'failed']

/** Разбор записи журнала в состояние; незнакомое значение — «не доставлено», а не «доставлено». */
export function parseBotDelivery(value: unknown): BotDelivery | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { status?: unknown; reason?: unknown }
  if (v.status === 'delivered') return { status: 'delivered' }
  if (v.status === 'not_delivered')
    return {
      status: 'not_delivered',
      reason: REASONS.includes(v.reason as string) ? (v.reason as BotDeliveryReason) : 'failed',
    }
  return null
}

/** Прямая отправка в личный чат с разбором исхода; ошибка доставки не пробрасывается. */
async function deliverDirect(
  userId: number,
  type: NotificationType,
  params: TemplateParams,
): Promise<BotDelivery> {
  try {
    const ok = await notifierService.deliver(userId, type, params)
    return ok ? { status: 'delivered' } : { status: 'not_delivered', reason: 'no_telegram' }
  } catch (e) {
    return {
      status: 'not_delivered',
      reason: e instanceof DeliveryError && e.kind === 'blocked' ? 'blocked' : 'failed',
    }
  }
}

/** Только факт и статус доставки: без ссылки, токена и текста сообщения. */
function logDelivery(fields: Record<string, unknown>, result: BotDelivery): void {
  console.info('[ownership-transfer] bot delivery', {
    ...fields,
    status: result.status,
    reason: result.status === 'not_delivered' ? result.reason : undefined,
  })
}

/**
 * Прямая отправка ссылки в личный чат получателя. Токен живёт только в памяти этого запроса и в
 * самом сообщении: ни ленты уведомлений, ни очереди, ни журнала, ни логов. Лог — только факт и
 * статус доставки. Ошибка доставки не пробрасывается: передача уже создана.
 */
export async function sendTransferLink(
  transfer: Pick<OrganizationOwnershipTransfer, 'id' | 'organizationId' | 'toUserId' | 'expiresAt'>,
  fromName: string | null,
  organizationName: string,
  url: string,
): Promise<BotDelivery> {
  const result = await deliverDirect(transfer.toUserId, 'ownership_transfer_link', {
    organizationId: transfer.organizationId,
    organizationName,
    fromName: fromName ?? undefined,
    // срок ссылки форматируется в часовом поясе группы (enrichParams)
    eventDate: transfer.expiresAt.toISOString(),
    transferUrl: url,
  })
  logDelivery({ transferId: transfer.id }, result)
  return result
}

export type TransferOutcome = 'accepted' | 'cancelled' | 'expired'
type Addressee = 'owner' | 'recipient'

/**
 * Кому и что уходит при исходе (21.4.7, 21.4.20): прежнему owner — всегда; получателю — при отмене
 * и истечении (о принятии он знает сам). Действие журнала однозначно задаёт адресата.
 */
const OUTCOME_MESSAGES: Record<
  TransferOutcome,
  { to: Addressee; type: NotificationType; action: AuditAction }[]
> = {
  accepted: [
    {
      to: 'owner',
      type: 'ownership_transfer_accepted',
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_BOT_DELIVERY_ACCEPTED_OWNER,
    },
  ],
  cancelled: [
    {
      to: 'owner',
      type: 'ownership_transfer_cancelled',
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_BOT_DELIVERY_CANCELLED_OWNER,
    },
    {
      to: 'recipient',
      type: 'ownership_transfer_cancelled_recipient',
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_BOT_DELIVERY_CANCELLED_RECIPIENT,
    },
  ],
  expired: [
    {
      to: 'owner',
      type: 'ownership_transfer_expired',
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_BOT_DELIVERY_EXPIRED_OWNER,
    },
    {
      to: 'recipient',
      type: 'ownership_transfer_expired_recipient',
      action: AUDIT_ACTIONS.OWNERSHIP_TRANSFER_BOT_DELIVERY_EXPIRED_RECIPIENT,
    },
  ],
}

async function nameOf(userId: number): Promise<string | undefined> {
  const [u] = await db
    .select({ name: users.name, username: users.telegramUsername })
    .from(users)
    .where(eq(users.id, userId))
  return u?.name ?? (u?.username ? `@${u.username}` : undefined)
}

/**
 * Уведомить участников передачи об исходе. Вызывать только после коммита перехода (переход из
 * `pending` случается один раз, поэтому и сообщение одно). Адресаты — только `fromUserId` и
 * `toUserId` самой передачи. Токена здесь нет и быть не может. Итог доставки каждого сообщения
 * пишется в `audit_log` как `{ status, reason }`; уже записанный итог не отправляется повторно.
 * Сбой бота и журнала не пробрасывается.
 */
export async function notifyTransferOutcome(
  outcome: TransferOutcome,
  t: Pick<OrganizationOwnershipTransfer, 'id' | 'organizationId' | 'fromUserId' | 'toUserId'>,
): Promise<void> {
  try {
    const [row] = await db
      .select({ orgName: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, t.organizationId))
    const params: TemplateParams = {
      organizationId: t.organizationId,
      organizationName: row?.orgName,
      toName: await nameOf(t.toUserId),
      fromName: await nameOf(t.fromUserId),
    }
    const ctx = systemContext()
    for (const m of OUTCOME_MESSAGES[outcome]) {
      // Однократность гарантирует переход pending → итог под блокировкой строки (UPDATE … WHERE
      // status = 'pending' в транзакции вызывающего); проверка журнала — вторичная защита от повтора.
      if (await auditService.latest(ctx, 'ownership_transfer', t.id, m.action)) continue
      const userId = m.to === 'owner' ? t.fromUserId : t.toUserId
      const result = await deliverDirect(userId, m.type, params)
      logDelivery({ transferId: t.id, outcome, to: m.to }, result)
      await auditService.log(ctx, {
        organizationId: t.organizationId,
        action: m.action,
        entityType: 'ownership_transfer',
        entityId: t.id,
        newValue: result,
      })
    }
  } catch (e) {
    console.error('[ownership-transfer] outcome notification failed', {
      outcome,
      transferId: t.id,
      error: e instanceof Error ? e.name : 'unknown',
    })
  }
}
