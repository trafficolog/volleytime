import {
  and,
  asc,
  eq,
  events,
  gt,
  groupPageModeration,
  inArray,
  isNull,
  organizationGroupPages,
  organizations,
  playerLevels,
  sql,
  venues,
} from '@volley-time/db'
import {
  buildPublicGroupPage,
  cityKey,
  GROUP_PAGE_SCHEDULE_EVENTS,
  type PublicCatalogView,
  type PublicGroupPageView,
} from '@volley-time/shared'

import { getDb, systemContext, type ServiceContext } from '../shared/context'

/** Slug группы в адресе `/g/<slug>`: тот же алфавит, что выдаёт `slugify`; иное — сразу 404. */
export const GROUP_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

/**
 * Группа видна публично: активна, не удалена (21.2.17), владелец включил публичную страницу
 * (`publicPageEnabled`, 24.1.2) и root её не скрыл (24.1.3: скрытая неотличима от
 * неопубликованной). Индексируемость — отдельно, по `seoIndex` и решению root.
 */
const publicGroup = and(
  eq(organizations.status, 'active'),
  isNull(organizations.deletedAt),
  eq(organizations.publicPageEnabled, true),
  sql`NOT EXISTS (SELECT 1 FROM ${groupPageModeration} gpm
    WHERE gpm.organization_id = ${organizations.id} AND gpm.state = 'hidden')`,
)

async function levelTitles(db: ReturnType<typeof getDb>, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return []
  const rows = await db
    .select({ code: playerLevels.code, title: playerLevels.title })
    .from(playerLevels)
    .orderBy(asc(playerLevels.sortOrder))
  const title = new Map(rows.map((r) => [r.code as string, r.title]))
  return codes.map((c) => title.get(c) ?? c)
}

/**
 * Публичная страница группы по slug (24.1.2, W-14), без авторизации. Скрытая группа (выключена
 * страница, не `active`, удалена) и неизвестный slug неотличимы: `null`. Отдаются только публичные
 * поля: без участников, состава, оплат и цен событий; в расписании — только открытые события
 * (решение владельца 2026-11-23: «по приглашению» на странице группы не показываются).
 */
export async function readPublicGroupPage(
  slug: string,
  now = new Date(),
  ctx: ServiceContext = systemContext(),
): Promise<PublicGroupPageView | null> {
  if (!GROUP_SLUG_RE.test(slug)) return null
  const db = getDb(ctx)
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, slug), publicGroup))
    .limit(1)
  if (!org) return null
  const [[page], [moderated], venueRows, eventRows, levels] = await Promise.all([
    db
      .select()
      .from(organizationGroupPages)
      .where(eq(organizationGroupPages.organizationId, org.id)),
    db
      .select({ state: groupPageModeration.state })
      .from(groupPageModeration)
      .where(eq(groupPageModeration.organizationId, org.id)),
    db
      .select({ id: venues.id, name: venues.name, address: venues.address })
      .from(venues)
      .where(and(eq(venues.organizationId, org.id), eq(venues.status, 'active'))),
    db
      .select({
        title: events.title,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        status: events.status,
        publicSlug: events.publicSlug,
        locationText: events.locationText,
        venueName: venues.name,
        venueAddress: venues.address,
      })
      .from(events)
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(
        and(
          eq(events.organizationId, org.id),
          inArray(events.status, ['published', 'closed']),
          eq(events.joinMode, 'open'),
          gt(events.startsAt, now),
        ),
      )
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(GROUP_PAGE_SCHEDULE_EVENTS),
    levelTitles(db, org.levels),
  ])
  const built = buildPublicGroupPage({
    content: page
      ? {
          sections: page.sections,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
        }
      : undefined,
    group: {
      name: org.name,
      city: org.city,
      district: org.district,
      defaultJoinMode: org.defaultJoinMode,
    },
    levels,
    activeVenues: venueRows,
    events: eventRows.map((e) => ({
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      status: e.status as 'published' | 'closed',
      publicSlug: e.publicSlug,
      place: { name: e.venueName ?? e.locationText, address: e.venueAddress ?? null },
    })),
  })
  const updatedAt = page && page.updatedAt > org.updatedAt ? page.updatedAt : org.updatedAt
  return {
    slug: org.slug,
    // решение root `noindex` перекрывает `seoIndex` владельца (24.1.3)
    indexable: org.seoIndex && !moderated,
    updatedAt: updatedAt.toISOString(),
    meta: built.meta,
    group: {
      id: org.id,
      name: org.name,
      city: org.city,
      district: org.district,
      levels,
      logoUpdatedAt: org.logoUpdatedAt?.toISOString() ?? null,
      shortLink: org.shortLink,
      timezone: org.defaultTimezone,
    },
    sections: built.sections,
  }
}

/**
 * Индексируемые публичные группы: страница включена, `seoIndex` и нет решения root (ни `noindex`,
 * ни `hidden`, 24.1.3) — для sitemap и каталога.
 */
const indexableGroup = and(
  publicGroup,
  eq(organizations.seoIndex, true),
  sql`NOT EXISTS (SELECT 1 FROM ${groupPageModeration} gpx
    WHERE gpx.organization_id = ${organizations.id})`,
)

/** Каталог «Волейбол в городе {город}»: только индексируемые группы; нет групп — `null`. */
export async function readPublicCatalog(
  city: string,
  ctx: ServiceContext = systemContext(),
): Promise<PublicCatalogView | null> {
  const key = cityKey(city)
  if (!key || key.length > 100) return null
  const db = getDb(ctx)
  const rows = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      city: organizations.city,
      district: organizations.district,
      levels: organizations.levels,
      logoUpdatedAt: organizations.logoUpdatedAt,
    })
    .from(organizations)
    .where(
      and(
        indexableGroup,
        sql`lower(regexp_replace(btrim(${organizations.city}), '\\s+', ' ', 'g')) = ${key}`,
      ),
    )
    .orderBy(asc(organizations.name), asc(organizations.id))
  if (rows.length === 0) return null
  const groups = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      district: r.district,
      levels: await levelTitles(db, r.levels),
      logoUpdatedAt: r.logoUpdatedAt?.toISOString() ?? null,
    })),
  )
  return { city: rows[0]!.city!.trim().replace(/\s+/g, ' '), groups }
}

export interface SitemapEntry {
  path: string
  lastmod: string
}

/** sitemap.xml: индексируемые страницы групп и каталоги их городов; noindex-групп в нём нет. */
export async function listPublicSitemap(
  ctx: ServiceContext = systemContext(),
): Promise<SitemapEntry[]> {
  const db = getDb(ctx)
  const rows = await db
    .select({
      slug: organizations.slug,
      city: organizations.city,
      orgUpdatedAt: organizations.updatedAt,
      pageUpdatedAt: organizationGroupPages.updatedAt,
    })
    .from(organizations)
    .leftJoin(organizationGroupPages, eq(organizationGroupPages.organizationId, organizations.id))
    .where(indexableGroup)
    .orderBy(asc(organizations.slug))
  const entries: SitemapEntry[] = []
  const cities = new Map<string, { name: string; lastmod: Date }>()
  for (const r of rows) {
    const lastmod =
      r.pageUpdatedAt && r.pageUpdatedAt > r.orgUpdatedAt ? r.pageUpdatedAt : r.orgUpdatedAt
    entries.push({ path: `/g/${r.slug}`, lastmod: lastmod.toISOString() })
    const name = r.city?.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = cityKey(name)
    const prev = cities.get(key)
    if (!prev || prev.lastmod < lastmod) cities.set(key, { name: prev?.name ?? name, lastmod })
  }
  for (const { name, lastmod } of cities.values())
    entries.push({
      path: `/volleyball/${encodeURIComponent(name)}`,
      lastmod: lastmod.toISOString(),
    })
  return entries
}

/** Короткая ссылка `volleytime.by/<имя>` (21.2.16) → slug публичной страницы группы; иначе null. */
export async function resolvePublicShortLink(
  name: string,
  ctx: ServiceContext = systemContext(),
): Promise<string | null> {
  const [row] = await getDb(ctx)
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(and(eq(organizations.shortLink, name.toLowerCase()), publicGroup))
    .limit(1)
  return row?.slug ?? null
}
