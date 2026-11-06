import { and, eq, organizationPaymentMethods, organizations } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import {
  OrganizationArchivedError,
  OrganizationNotFoundError,
} from '../organizations/errors'
import { actorUserId, getDb, inTransaction, type ServiceContext } from '../shared/context'

import { PaymentMethodInvalidError } from './errors'
import {
  PAYMENT_METHOD_CODES,
  UpdatePaymentMethodInput,
  type PaymentMethodCode,
} from './schemas'

/** Способ оплаты группы для кабинета и экрана оплаты игрока. Полного номера карты нет нигде. */
export interface PaymentMethodView {
  method: PaymentMethodCode
  enabled: boolean
  /** Реквизиты — только у перевода. */
  bank: string | null
  cardLast4: string | null
  recipient: string | null
}

const DETAIL_KEYS = ['bank', 'cardLast4', 'recipient'] as const
const sameValue = (a: unknown, b: unknown) => a === b

type Row = typeof organizationPaymentMethods.$inferSelect

function view(method: PaymentMethodCode, row: Row | undefined): PaymentMethodView {
  // строки нет — способ включён без реквизитов (поведение до 21.2.11)
  return {
    method,
    enabled: row?.enabled ?? true,
    bank: row?.bank ?? null,
    cardLast4: row?.cardLast4 ?? null,
    recipient: row?.recipient ?? null,
  }
}

export const paymentMethodService = {
  /**
   * Способы группы. Управляющий видит оба с признаком `enabled`; остальные участники — только
   * включённые (выключенный игроку не показывается). Только чтение: запись и подтверждение
   * платежей этим не затрагиваются.
   */
  async list(
    ctx: ServiceContext,
    orgId: number,
    opts: { manager: boolean },
  ): Promise<PaymentMethodView[]> {
    const rows = await getDb(ctx)
      .select()
      .from(organizationPaymentMethods)
      .where(eq(organizationPaymentMethods.organizationId, orgId))
    const byMethod = new Map(rows.map((r) => [r.method, r]))
    const all = PAYMENT_METHOD_CODES.map((code) => view(code, byMethod.get(code)))
    return opts.manager ? all : all.filter((m) => m.enabled)
  },

  /**
   * Изменить способ оплаты (включение и реквизиты перевода). История — audit_log
   * `organization.payment_method_updated` с автором и изменёнными полями (было/стало);
   * без изменений записи нет. Затрагивает только то, что видит игрок на экране оплаты.
   */
  async update(
    ctx: ServiceContext,
    orgId: number,
    method: PaymentMethodCode,
    input: UpdatePaymentMethodInput,
  ): Promise<PaymentMethodView> {
    const data = UpdatePaymentMethodInput.parse(input)
    if (Object.keys(data).length === 0) {
      throw new PaymentMethodInvalidError('At least one field is required')
    }
    if (method === 'cash' && DETAIL_KEYS.some((key) => data[key] !== undefined)) {
      throw new PaymentMethodInvalidError('Cash has no requisites')
    }
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const [org] = await db
        .select({ id: organizations.id, status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!org) throw new OrganizationNotFoundError(orgId)
      if (org.status === 'archived') throw new OrganizationArchivedError()

      const [existing] = await db
        .select()
        .from(organizationPaymentMethods)
        .where(
          and(
            eq(organizationPaymentMethods.organizationId, orgId),
            eq(organizationPaymentMethods.method, method),
          ),
        )
      const before = view(method, existing)
      const keys = ['enabled', ...DETAIL_KEYS] as const
      const changed = keys.filter(
        (key) => data[key] !== undefined && !sameValue(data[key], before[key]),
      )
      if (changed.length === 0) return before

      const patch = Object.fromEntries(changed.map((key) => [key, data[key]]))
      const next = { ...before, ...patch }
      await db
        .insert(organizationPaymentMethods)
        .values({
          organizationId: orgId,
          method,
          enabled: next.enabled,
          bank: next.bank,
          cardLast4: next.cardLast4,
          recipient: next.recipient,
          updatedByUserId: actorUserId(ctx),
        })
        .onConflictDoUpdate({
          target: [organizationPaymentMethods.organizationId, organizationPaymentMethods.method],
          set: {
            enabled: next.enabled,
            bank: next.bank,
            cardLast4: next.cardLast4,
            recipient: next.recipient,
            updatedByUserId: actorUserId(ctx),
            updatedAt: new Date(),
          },
        })
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_PAYMENT_METHOD_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: { method, ...Object.fromEntries(changed.map((key) => [key, before[key]])) },
        newValue: { method, ...patch },
      })
      return next
    })
  },
}
