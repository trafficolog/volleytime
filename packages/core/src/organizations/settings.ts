import { eq, organizations, type Organization, type PlayerLevelCode } from '@volley-time/db'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { isInviteModeEnabled } from '../events/join-mode-capability'
import { isSplitPricingEnabled } from '../events/pricing-capability'
import { recordGroupAddressChange } from '../group-page/address'
import { GroupPageModerationLockedError } from '../group-page/errors'
import { readModeration } from '../group-page/moderation'
import { GroupLevelsInput } from '../levels/schemas'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  OrganizationArchivedError,
  OrganizationInvalidSettingsError,
  OrganizationNotFoundError,
  SlugTakenError,
} from './errors'

/** Срок отмены: тот же верхний предел, что был у события (720 ч = 30 суток). */
export const MAX_CANCELLATION_DEADLINE_HOURS = 720

const optionalText = z
  .string()
  .trim()
  .max(100)
  .nullable()
  .transform((v) => (v === '' ? null : v))

/**
 * PATCH настроек группы (19.2.2). Все поля необязательны; неизвестные ключи запрещены,
 * чтобы опечатка не превращалась в тихий no-op.
 */
export const UpdateOrganizationSettingsInput = z
  .object({
    subscriptionsEnabled: z.boolean(),
    maxSeatsPerBooking: z.number().int().min(1).max(10),
    defaultPriceMode: z.enum(['fixed', 'split']),
    defaultJoinMode: z.enum(['open', 'invite']),
    cancellationAllowed: z.boolean(),
    cancellationDeadlineHours: z
      .number()
      .int()
      .min(0)
      .max(MAX_CANCELLATION_DEADLINE_HOURS)
      .nullable(),
    seoIndex: z.boolean(),
    /** Публичная страница группы `/g/<slug>` (24.1.2): выключена — 404. */
    publicPageEnabled: z.boolean(),
    city: optionalText,
    district: optionalText,
    levels: GroupLevelsInput,
    /**
     * Slug группы — второй сегмент адреса `/{город}/{группа}` (24.2.1). Алфавит `slugify`, без
     * `--`; уникален глобально (тогда и в пределах города), занятый — 409 `organization.slug_taken`.
     * Прежний адрес отвечает 301 (история адресов).
     */
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'Slug: a-z, 0-9 and hyphens')
      .refine((v) => !v.includes('--'), 'Slug: no double hyphens'),
  })
  .partial()
  .strict()
export type UpdateOrganizationSettingsInput = z.input<typeof UpdateOrganizationSettingsInput>

export interface OrganizationSettings {
  subscriptionsEnabled: boolean
  maxSeatsPerBooking: number
  defaultPriceMode: 'fixed' | 'split'
  defaultJoinMode: 'open' | 'invite'
  cancellationAllowed: boolean
  /** NULL = отмена до начала события. */
  cancellationDeadlineHours: number | null
  seoIndex: boolean
  publicPageEnabled: boolean
  city: string | null
  district: string | null
  /** Уровни группы (19.2.3) в порядке шкалы В1–В4+; пустой список — не указаны. */
  levels: PlayerLevelCode[]
  /** Slug группы в адресе страницы `/{город}/{группа}` (24.2.1). */
  slug: string
}

const SETTING_KEYS = [
  'subscriptionsEnabled',
  'maxSeatsPerBooking',
  'defaultPriceMode',
  'defaultJoinMode',
  'cancellationAllowed',
  'cancellationDeadlineHours',
  'seoIndex',
  'publicPageEnabled',
  'city',
  'district',
  'levels',
  'slug',
] as const satisfies readonly (keyof OrganizationSettings & keyof Organization)[]

function isSlugUniqueViolation(error: unknown): boolean {
  for (let e = error as { code?: string; message?: string; cause?: unknown } | undefined; e;) {
    if (e.code === '23505' && /organizations_slug_unique/.test(e.message ?? '')) return true
    e = e.cause as typeof e
  }
  return false
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function pickSettings(org: Organization): OrganizationSettings {
  return {
    subscriptionsEnabled: org.subscriptionsEnabled,
    maxSeatsPerBooking: org.maxSeatsPerBooking,
    defaultPriceMode: org.defaultPriceMode,
    defaultJoinMode: org.defaultJoinMode,
    cancellationAllowed: org.cancellationAllowed,
    cancellationDeadlineHours: org.cancellationDeadlineHours,
    seoIndex: org.seoIndex,
    publicPageEnabled: org.publicPageEnabled,
    city: org.city,
    district: org.district,
    levels: org.levels,
    slug: org.slug,
  }
}

export const organizationSettingsService = {
  async get(ctx: ServiceContext, orgId: number): Promise<OrganizationSettings> {
    const org = await getDb(ctx).query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })
    if (!org) throw new OrganizationNotFoundError(orgId)
    return pickSettings(org)
  },

  /**
   * Изменить настройки группы. Меняет только значения по умолчанию для будущих событий:
   * созданные события хранят снимок и не затрагиваются (D-02). История — audit_log
   * `organization.settings_updated` с изменёнными полями (было/стало); без изменений записи нет.
   */
  async update(
    ctx: ServiceContext,
    orgId: number,
    input: UpdateOrganizationSettingsInput,
  ): Promise<OrganizationSettings> {
    const data = UpdateOrganizationSettingsInput.parse(input)
    if (Object.keys(data).length === 0) {
      throw new OrganizationInvalidSettingsError('At least one setting is required')
    }
    // умолчание split бессмысленно, пока события split создавать нельзя (та же возможность, что в events.create)
    if (
      data.defaultPriceMode === 'split' &&
      !isSplitPricingEnabled(process.env.EVENT_SPLIT_PRICING_ENABLED)
    ) {
      throw new OrganizationInvalidSettingsError('Split pricing is not enabled')
    }
    // то же для записи по приглашению (EVENT_INVITE_MODE_ENABLED, 20.1.3)
    if (
      data.defaultJoinMode === 'invite' &&
      !isInviteModeEnabled(process.env.EVENT_INVITE_MODE_ENABLED)
    ) {
      throw new OrganizationInvalidSettingsError('Invite-only booking is not enabled')
    }
    return inTransaction(ctx, async (tx) => {
      // FOR UPDATE: события, создаваемые параллельно, читают группу FOR SHARE — снимок согласован
      const [existing] = await getDb(tx)
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!existing) throw new OrganizationNotFoundError(orgId)
      if (existing.status === 'archived') throw new OrganizationArchivedError()

      const before = pickSettings(existing)
      const changed = SETTING_KEYS.filter(
        (key) => data[key] !== undefined && !sameValue(data[key], before[key]),
      )
      if (changed.length === 0) return before

      // решение root по странице группы (24.1.3) блокирует переключатель индексации владельца
      if (changed.includes('seoIndex') && (await readModeration(getDb(tx), orgId))) {
        throw new GroupPageModerationLockedError()
      }

      const patch = Object.fromEntries(changed.map((key) => [key, data[key]]))
      if (changed.includes('slug')) {
        const [taken] = await getDb(tx)
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, data.slug!))
        if (taken) throw new SlugTakenError(data.slug!)
      }
      let updated: Organization | undefined
      try {
        ;[updated] = await getDb(tx)
          .update(organizations)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(organizations.id, orgId))
          .returning()
      } catch (error) {
        // гонка двух групп за один slug: побеждает уникальный индекс
        if (data.slug && isSlugUniqueViolation(error)) throw new SlugTakenError(data.slug)
        throw error
      }
      // смена города или slug (24.2.1): прежний адрес страницы отвечает 301
      if (changed.includes('city') || changed.includes('slug'))
        await recordGroupAddressChange(tx, orgId, before, pickSettings(updated!))
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: Object.fromEntries(changed.map((key) => [key, before[key]])),
        newValue: patch,
      })
      return pickSettings(updated!)
    })
  },
}
