import { eq, organizations, type Organization } from '@volley-time/db'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { isSplitPricingEnabled } from '../events/pricing-capability'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  OrganizationArchivedError,
  OrganizationInvalidSettingsError,
  OrganizationNotFoundError,
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
    city: optionalText,
    district: optionalText,
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
  city: string | null
  district: string | null
}

const SETTING_KEYS = [
  'subscriptionsEnabled',
  'maxSeatsPerBooking',
  'defaultPriceMode',
  'defaultJoinMode',
  'cancellationAllowed',
  'cancellationDeadlineHours',
  'seoIndex',
  'city',
  'district',
] as const satisfies readonly (keyof OrganizationSettings & keyof Organization)[]

export function pickSettings(org: Organization): OrganizationSettings {
  return {
    subscriptionsEnabled: org.subscriptionsEnabled,
    maxSeatsPerBooking: org.maxSeatsPerBooking,
    defaultPriceMode: org.defaultPriceMode,
    defaultJoinMode: org.defaultJoinMode,
    cancellationAllowed: org.cancellationAllowed,
    cancellationDeadlineHours: org.cancellationDeadlineHours,
    seoIndex: org.seoIndex,
    city: org.city,
    district: org.district,
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
        (key) => data[key] !== undefined && data[key] !== before[key],
      )
      if (changed.length === 0) return before

      const patch = Object.fromEntries(changed.map((key) => [key, data[key]]))
      const [updated] = await getDb(tx)
        .update(organizations)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning()
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
