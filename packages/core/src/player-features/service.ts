import { and, eq, userFeatures, type DbOrTx } from '@volley-time/db'
import {
  featureForNotificationKind,
  PLAYER_FEATURES,
  resolvePlayerFeatures,
  type PlayerFeatures,
} from '@volley-time/shared'
import { z } from 'zod'

import { isCriticalNotification } from '../notifier/feed-types'
import type { NotificationType } from '../notifier/templates'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

/**
 * PATCH: только восемь флагов спецификации P-12, значения строго boolean, неизвестные ключи
 * (в том числе расписание, запись и оплата) запрещены: эти функции выключить нельзя.
 */
export const UpdatePlayerFeaturesInput = z
  .object(Object.fromEntries(PLAYER_FEATURES.map((f) => [f, z.boolean()])))
  .partial()
  .strict()

async function load(db: DbOrTx, userId: number): Promise<PlayerFeatures> {
  const rows = await db
    .select({ feature: userFeatures.feature, enabled: userFeatures.enabled })
    .from(userFeatures)
    .where(eq(userFeatures.userId, userId))
  return resolvePlayerFeatures(rows)
}

/**
 * Личные функции игрока (23.1.1, P-12). Флаги принадлежат пользователю и не зависят от группы;
 * строки нет — функция включена. Данные выключенной функции не удаляются.
 */
export const playerFeaturesService = {
  async get(ctx: ServiceContext): Promise<PlayerFeatures> {
    return load(getDb(ctx), ctx.userId)
  },

  async update(ctx: ServiceContext, input: unknown): Promise<PlayerFeatures> {
    const data = UpdatePlayerFeaturesInput.parse(input)
    const entries = Object.entries(data) as [string, boolean][]
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      for (const [feature, enabled] of entries) {
        await db
          .insert(userFeatures)
          .values({ userId: ctx.userId, feature, enabled })
          .onConflictDoUpdate({
            target: [userFeatures.userId, userFeatures.feature],
            set: { enabled, updatedAt: new Date() },
          })
      }
      return load(db, ctx.userId)
    })
  },
}

/**
 * Закрыта ли доставка типа в бот флагом игрока (решение владельца 2026-11-22, D-23). Критичные типы
 * не отключаются никогда; тип без флага не гейтится. Лента Mini App от этого не меняется.
 */
export async function isPlayerFeatureOffForNotification(
  db: DbOrTx,
  userId: number,
  kind: string,
): Promise<boolean> {
  if (isCriticalNotification(kind as NotificationType)) return false
  const feature = featureForNotificationKind(kind)
  if (!feature) return false
  const [row] = await db
    .select({ enabled: userFeatures.enabled })
    .from(userFeatures)
    .where(and(eq(userFeatures.userId, userId), eq(userFeatures.feature, feature)))
  return row?.enabled === false
}
