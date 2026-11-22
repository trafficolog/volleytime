import {
  and,
  asc,
  eq,
  events,
  gt,
  inArray,
  organizationGroupPages,
  organizations,
  venues,
  type Organization,
  type OrganizationGroupPage,
} from '@volley-time/db'
import {
  checkGroupPageMeta,
  defaultGroupPageContent,
  defaultJoinText,
  defaultMetaDescription,
  defaultMetaTitle,
  GROUP_PAGE_SCHEDULE_EVENTS,
  GroupPageContent,
  type GroupPageContentInput,
  type GroupPageSection,
  type GroupPageView,
} from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationArchivedError, OrganizationNotFoundError } from '../organizations/errors'
import { actorUserId, getDb, inTransaction, type ServiceContext } from '../shared/context'

import { GroupPageVenueInvalidError } from './errors'

type Db = ReturnType<typeof getDb>

function contentOf(row: OrganizationGroupPage | undefined): GroupPageContent {
  if (!row) return defaultGroupPageContent()
  const raw = {
    sections: row.sections as GroupPageSection[],
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
  }
  // jsonb не хранит порядок ключей: разбор схемой возвращает канонический вид (сравнение no-op,
  // стабильный ответ). Строка, записанная по прежним правилам, отдаётся как есть.
  const parsed = GroupPageContent.safeParse(raw)
  return parsed.success ? parsed.data : raw
}

async function buildView(
  db: Db,
  org: Organization,
  row: OrganizationGroupPage | undefined,
  now: Date,
): Promise<GroupPageView> {
  const content = contentOf(row)
  const [venueRows, eventRows] = await Promise.all([
    db
      .select({ id: venues.id, name: venues.name, address: venues.address })
      .from(venues)
      .where(and(eq(venues.organizationId, org.id), eq(venues.status, 'active')))
      .orderBy(asc(venues.id)),
    db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        status: events.status,
        joinMode: events.joinMode,
        venueId: events.venueId,
        publicSlug: events.publicSlug,
      })
      .from(events)
      .where(
        and(
          eq(events.organizationId, org.id),
          inArray(events.status, ['published', 'closed']),
          gt(events.startsAt, now),
        ),
      )
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(GROUP_PAGE_SCHEDULE_EVENTS),
  ])
  const join = content.sections.find((s) => s.kind === 'join')
  const resolved = {
    metaTitle: content.metaTitle ?? defaultMetaTitle(org.name, org.city),
    metaDescription: content.metaDescription ?? defaultMetaDescription(org.name, org.city),
    joinText: (join && 'text' in join && join.text) || defaultJoinText(org.defaultJoinMode),
  }
  return {
    content,
    isDefault: !row,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    seoIndex: org.seoIndex,
    group: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      city: org.city,
      district: org.district,
      levels: org.levels,
      defaultJoinMode: org.defaultJoinMode,
      timezone: org.defaultTimezone,
      logoUpdatedAt: org.logoUpdatedAt?.toISOString() ?? null,
    },
    venues: venueRows,
    upcomingEvents: eventRows.map((e) => ({
      ...e,
      status: e.status as 'published' | 'closed',
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
    })),
    resolved,
    warnings: checkGroupPageMeta({
      title: resolved.metaTitle,
      description: resolved.metaDescription,
      city: org.city,
    }),
  }
}

/**
 * Страница группы (24.1.1, W-13, D-24). Права проверяет API: чтение — владелец и организатор,
 * правка — только владелец. Сервис принимает уже авторизованный `orgId` (tenant из маршрута).
 */
export const groupPageService = {
  async get(ctx: ServiceContext, orgId: number, now = new Date()): Promise<GroupPageView> {
    const db = getDb(ctx)
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
    if (!org) throw new OrganizationNotFoundError(orgId)
    const [row] = await db
      .select()
      .from(organizationGroupPages)
      .where(eq(organizationGroupPages.organizationId, orgId))
    return buildView(db, org, row, now)
  },

  /**
   * Полная замена содержимого (PUT). Мета-предупреждения сохранение не блокируют (D-24).
   * Залы секции «Зал» — только активные залы этой группы. Без изменений — ни записи, ни аудита;
   * иначе `organization.group_page_updated` с именами изменённых полей (тексты в журнал не пишутся).
   */
  async update(
    ctx: ServiceContext,
    orgId: number,
    input: GroupPageContentInput,
    now = new Date(),
  ): Promise<GroupPageView> {
    const data = GroupPageContent.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      // FOR UPDATE по группе сериализует параллельные сохранения одной страницы
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for('update')
      if (!org) throw new OrganizationNotFoundError(orgId)
      if (org.status === 'archived') throw new OrganizationArchivedError()

      const venueSection = data.sections.find((s) => s.kind === 'venues')
      const venueIds = venueSection && 'venueIds' in venueSection ? venueSection.venueIds : []
      if (venueIds.length > 0) {
        const found = await db
          .select({ id: venues.id })
          .from(venues)
          .where(
            and(
              eq(venues.organizationId, orgId),
              eq(venues.status, 'active'),
              inArray(venues.id, venueIds),
            ),
          )
        const ok = new Set(found.map((v) => v.id))
        const bad = venueIds.filter((id) => !ok.has(id))
        if (bad.length > 0) throw new GroupPageVenueInvalidError(bad)
      }

      const [existing] = await db
        .select()
        .from(organizationGroupPages)
        .where(eq(organizationGroupPages.organizationId, orgId))
      const before = contentOf(existing)
      const changed = (['sections', 'metaTitle', 'metaDescription'] as const).filter(
        (k) => JSON.stringify(before[k]) !== JSON.stringify(data[k]),
      )
      if (existing && changed.length === 0) return buildView(db, org, existing, now)

      const values = {
        sections: data.sections,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        updatedByUserId: actorUserId(ctx),
        updatedAt: new Date(),
      }
      const [row] = await db
        .insert(organizationGroupPages)
        .values({ organizationId: orgId, ...values })
        .onConflictDoUpdate({ target: organizationGroupPages.organizationId, set: values })
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.ORG_GROUP_PAGE_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        oldValue: null,
        newValue: { changed: existing ? changed : ['created', ...changed] },
      })
      return buildView(db, org, row, now)
    })
  },
}
