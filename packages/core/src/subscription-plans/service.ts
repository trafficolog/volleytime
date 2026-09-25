import { and, eq, subscriptionPlans, type SubscriptionPlan } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { organizationService } from '../organizations/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { resolveOrgCurrency } from '../shared/currency'

import { PlanNotFoundError } from './errors'
import {
  CreatePlanInput,
  UpdatePlanInput,
  type CreatePlanInput as CreateInput,
  type UpdatePlanInput as UpdateInput,
} from './schemas'

export const planService = {
  async create(ctx: ServiceContext, input: CreateInput): Promise<SubscriptionPlan> {
    const data = CreatePlanInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      await organizationService.requireSubscriptionsEnabled(tx, data.organizationId)
      const [plan] = await getDb(tx)
        .insert(subscriptionPlans)
        .values({
          organizationId: data.organizationId,
          name: data.name,
          description: data.description ?? null,
          totalSessions: data.totalSessions,
          validityDays: data.validityDays ?? null,
          price: data.price,
          currency: await resolveOrgCurrency(tx, data.organizationId, data.currency),
        })
        .returning()
      await auditService.record(tx, {
        organizationId: plan!.organizationId,
        action: AUDIT_ACTIONS.PLAN_CREATED,
        entityType: 'plan',
        entityId: plan!.id,
        newValue: { name: plan!.name, totalSessions: plan!.totalSessions, price: plan!.price },
      })
      return plan!
    })
  },

  async getById(ctx: ServiceContext, planId: number): Promise<SubscriptionPlan> {
    const p = await getDb(ctx).query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    })
    if (!p) throw new PlanNotFoundError(planId)
    return p
  },

  async listByOrg(ctx: ServiceContext, orgId: number, includeArchived = false) {
    const db = getDb(ctx)
    const where = includeArchived
      ? eq(subscriptionPlans.organizationId, orgId)
      : and(eq(subscriptionPlans.organizationId, orgId), eq(subscriptionPlans.status, 'active'))
    return db.query.subscriptionPlans.findMany({
      where,
      orderBy: (p, { asc }) => [asc(p.price)],
    })
  },

  async update(ctx: ServiceContext, planId: number, input: UpdateInput) {
    const data = UpdatePlanInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, planId)
      const [updated] = await getDb(tx)
        .update(subscriptionPlans)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, planId))
        .returning()
      await auditService.record(tx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.PLAN_UPDATED,
        entityType: 'plan',
        entityId: planId,
        newValue: data,
      })
      return updated!
    })
  },

  async archive(ctx: ServiceContext, planId: number) {
    return inTransaction(ctx, async (tx) => {
      const existing = await this.getById(tx, planId)
      const [archived] = await getDb(tx)
        .update(subscriptionPlans)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, planId))
        .returning()
      await auditService.record(tx, {
        organizationId: existing.organizationId,
        action: AUDIT_ACTIONS.PLAN_ARCHIVED,
        entityType: 'plan',
        entityId: planId,
      })
      return archived!
    })
  },
}
