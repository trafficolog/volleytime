import {
  and,
  eq,
  organizationNotificationSettings,
  organizations,
  type DbOrTx,
} from '@volley-time/db'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { isCriticalNotification } from '../notifier/feed-types'
import type { NotificationType } from '../notifier/templates'
import { OrganizationNotFoundError } from '../organizations/errors'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import { NotificationMandatoryError, NotificationSettingsEmptyError } from './errors'

/** Типы, которые организатор может выключить (21.2.14): напоминания игрокам. */
export const TOGGLEABLE_NOTIFICATION_TYPES = ['reminder_24h', 'reminder_2h'] as const
export type ToggleableNotificationType = (typeof TOGGLEABLE_NOTIFICATION_TYPES)[number]

/**
 * Обязательные типы, которые подраздел «Уведомления» показывает включёнными и недоступными.
 * Критичными (`isCriticalNotification`) остаются также отклонение оплаты и отмена события: их
 * тоже нельзя выключить, ни через интерфейс, ни через API.
 */
export const MANDATORY_NOTIFICATION_TYPES = ['waitlist_offer', 'payment_confirmed'] as const

export interface GroupNotificationSetting {
  type: ToggleableNotificationType | (typeof MANDATORY_NOTIFICATION_TYPES)[number]
  enabled: boolean
  mandatory: boolean
}

/** PATCH: только переключаемые типы; неизвестные ключи запрещены, обязательные дают свою ошибку. */
export const UpdateGroupNotificationsInput = z
  .object({ reminder_24h: z.boolean(), reminder_2h: z.boolean() })
  .partial()
  .strict()

/** Включён ли тип для группы. Нет строки — включён (поведение до 21.2.14); критичные — всегда. */
export async function isGroupNotificationEnabled(
  db: DbOrTx,
  organizationId: number,
  type: NotificationType,
): Promise<boolean> {
  if (isCriticalNotification(type)) return true
  if (!(TOGGLEABLE_NOTIFICATION_TYPES as readonly string[]).includes(type)) return true
  const [row] = await db
    .select({ enabled: organizationNotificationSettings.enabled })
    .from(organizationNotificationSettings)
    .where(
      and(
        eq(organizationNotificationSettings.organizationId, organizationId),
        eq(organizationNotificationSettings.type, type),
      ),
    )
  return row?.enabled ?? true
}

async function listFor(db: DbOrTx, orgId: number): Promise<GroupNotificationSetting[]> {
  const rows = await db
    .select()
    .from(organizationNotificationSettings)
    .where(eq(organizationNotificationSettings.organizationId, orgId))
  const explicit = new Map(rows.map((r) => [r.type, r.enabled]))
  return [
    ...TOGGLEABLE_NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: explicit.get(type) ?? true,
      mandatory: false,
    })),
    ...MANDATORY_NOTIFICATION_TYPES.map((type) => ({ type, enabled: true, mandatory: true })),
  ]
}

/**
 * Переключатели уведомлений группы (21.2.14). Все операции ограничены группой из контекста
 * запроса; выключенный тип не отправляется ботом игрокам этой группы (шаг `deliveryGate`
 * журнала доставки), лента в приложении не меняется.
 */
export const groupNotificationSettingsService = {
  async list(ctx: ServiceContext, orgId: number): Promise<GroupNotificationSetting[]> {
    return listFor(getDb(ctx), orgId)
  },

  async update(
    ctx: ServiceContext,
    orgId: number,
    input: unknown,
  ): Promise<GroupNotificationSetting[]> {
    if (input && typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (isCriticalNotification(key as NotificationType))
          throw new NotificationMandatoryError(key)
      }
    }
    const data = UpdateGroupNotificationsInput.parse(input ?? {})
    const entries = Object.entries(data) as [ToggleableNotificationType, boolean][]
    if (entries.length === 0) throw new NotificationSettingsEmptyError()

    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!org) throw new OrganizationNotFoundError(orgId)

      const before = new Map((await listFor(db, orgId)).map((s) => [s.type, s.enabled]))
      const changed = entries.filter(([type, enabled]) => before.get(type) !== enabled)
      for (const [type, enabled] of changed) {
        await db
          .insert(organizationNotificationSettings)
          .values({ organizationId: orgId, type, enabled })
          .onConflictDoUpdate({
            target: [
              organizationNotificationSettings.organizationId,
              organizationNotificationSettings.type,
            ],
            set: { enabled, updatedAt: new Date() },
          })
      }
      if (changed.length > 0) {
        await auditService.record(tx, {
          organizationId: orgId,
          action: AUDIT_ACTIONS.ORG_NOTIFICATIONS_UPDATED,
          entityType: 'organization',
          entityId: orgId,
          oldValue: Object.fromEntries(changed.map(([type]) => [type, before.get(type)])),
          newValue: Object.fromEntries(changed),
        })
      }
      return listFor(db, orgId)
    })
  },
}
