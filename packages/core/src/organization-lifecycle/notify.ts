import { db, eq, organizations, users, type OrganizationOwnershipTransfer } from '@volley-time/db'

import { DeliveryError } from '../notifier/delivery-error'
import { notifierService } from '../notifier/service'

/**
 * Итог отправки личной ссылки передачи получателю ботом (21.4.7, решение владельца 2026-11-11).
 * `no_telegram` — у получателя нет чата с ботом; `blocked` — бот заблокирован или чат недоступен;
 * `failed` — прочий сбой (лимит, таймаут, 5xx). Владелец видит «бот не доставил» и отправляет
 * ссылку сам, как до 21.4.7.
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
  let result: BotDelivery
  try {
    const ok = await notifierService.deliver(transfer.toUserId, 'ownership_transfer_link', {
      organizationId: transfer.organizationId,
      organizationName,
      fromName: fromName ?? undefined,
      // срок ссылки форматируется в часовом поясе группы (enrichParams)
      eventDate: transfer.expiresAt.toISOString(),
      transferUrl: url,
    })
    result = ok ? { status: 'delivered' } : { status: 'not_delivered', reason: 'no_telegram' }
  } catch (e) {
    result = {
      status: 'not_delivered',
      reason: e instanceof DeliveryError && e.kind === 'blocked' ? 'blocked' : 'failed',
    }
  }
  // без ссылки, токена и текста сообщения
  console.info('[ownership-transfer] bot delivery', {
    transferId: transfer.id,
    status: result.status,
    reason: result.status === 'not_delivered' ? result.reason : undefined,
  })
  return result
}

export type TransferOutcome = 'accepted' | 'cancelled' | 'expired'

const OUTCOME_TYPE = {
  accepted: 'ownership_transfer_accepted',
  cancelled: 'ownership_transfer_cancelled',
  expired: 'ownership_transfer_expired',
} as const

/**
 * Уведомить прежнего owner об исходе передачи. Вызывать только после коммита; получатель — только
 * `fromUserId` самой передачи. Токена здесь нет и быть не может. Сбой бота не пробрасывается.
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
    const [to] = await db
      .select({ name: users.name, username: users.telegramUsername })
      .from(users)
      .where(eq(users.id, t.toUserId))
    await notifierService.send(t.fromUserId, OUTCOME_TYPE[outcome], {
      organizationId: t.organizationId,
      organizationName: row?.orgName,
      toName: to?.name ?? (to?.username ? `@${to.username}` : undefined),
    })
  } catch (e) {
    console.error('[ownership-transfer] outcome notification failed', {
      outcome,
      transferId: t.id,
      error: e instanceof Error ? e.name : 'unknown',
    })
  }
}
