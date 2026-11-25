import { and, desc, eq, groupPageAddresses, organizations, sql } from '@volley-time/db'
import { citySlug, cityNameBySlug, groupPagePath } from '@volley-time/shared'

import { getDb, systemContext, type ServiceContext } from '../shared/context'

import { GROUP_SLUG_RE, publicGroup } from './public'

/**
 * Адрес страницы группы (24.2.1, D-26): действующий `/{город}/{группа}` (или `/g/<slug>` без города
 * справочника) и история прежних адресов для 301.
 */

/** Ключ адреса в истории: slug города справочника (`''` — без города) и slug группы. */
const addressKey = (slug: string, city: string | null) => ({
  citySlug: citySlug(city) ?? '',
  groupSlug: slug,
})

/**
 * Записать смену адреса (смена города или slug владельцем) в той же транзакции, что и саму смену.
 * Прежний адрес уходит в историю (если его уже держала другая группа — переходит к этой: адрес
 * освободился позже); новый адрес из истории удаляется — действующий адрес не перенаправляется.
 */
export async function recordGroupAddressChange(
  ctx: ServiceContext,
  organizationId: number,
  before: { slug: string; city: string | null },
  after: { slug: string; city: string | null },
): Promise<void> {
  if (groupPagePath(before.slug, before.city) === groupPagePath(after.slug, after.city)) return
  const db = getDb(ctx)
  const prev = addressKey(before.slug, before.city)
  const next = addressKey(after.slug, after.city)
  await db
    .delete(groupPageAddresses)
    .where(
      and(
        eq(groupPageAddresses.citySlug, next.citySlug),
        eq(groupPageAddresses.groupSlug, next.groupSlug),
      ),
    )
  await db
    .insert(groupPageAddresses)
    .values({ ...prev, organizationId })
    .onConflictDoUpdate({
      target: [groupPageAddresses.citySlug, groupPageAddresses.groupSlug],
      set: { organizationId, createdAt: new Date() },
    })
}

/** Ответ на запрос адреса: страница здесь, переехала (301) или её нет (404). */
export type GroupAddressResolution = { kind: 'current' } | { kind: 'moved'; path: string } | null

/**
 * Разобрать адрес страницы группы. `city` — первый сегмент `/{город}/{группа}` или `null` для
 * `/g/<slug>`. Скрытая root, неопубликованная, неактивная и удалённая группа — `null` по любому
 * адресу (24.1.3). Порядок: действующий адрес группы → история прежних адресов → группа с этим
 * slug (slug уникален глобально, поэтому `/g/<slug>` и адрес с неверным городом ведут на неё).
 */
export async function resolveGroupAddress(
  city: string | null,
  group: string,
  ctx: ServiceContext = systemContext(),
): Promise<GroupAddressResolution> {
  if (!GROUP_SLUG_RE.test(group)) return null
  if (city !== null && !cityNameBySlug(city)) return null
  const requested = city === null ? `/g/${group}` : `/${city}/${group}`
  const db = getDb(ctx)
  const located = (o: { slug: string; city: string | null }): GroupAddressResolution => {
    const path = groupPagePath(o.slug, o.city)
    return path === requested ? { kind: 'current' } : { kind: 'moved', path }
  }
  const [current] = await db
    .select({ slug: organizations.slug, city: organizations.city })
    .from(organizations)
    .where(and(eq(organizations.slug, group), publicGroup))
    .limit(1)
  if (current && groupPagePath(current.slug, current.city) === requested) return { kind: 'current' }

  const [old] = await db
    .select({ slug: organizations.slug, city: organizations.city })
    .from(groupPageAddresses)
    .innerJoin(organizations, eq(organizations.id, groupPageAddresses.organizationId))
    .where(
      and(
        eq(groupPageAddresses.groupSlug, group),
        city === null ? sql`true` : eq(groupPageAddresses.citySlug, city),
        publicGroup,
      ),
    )
    .orderBy(desc(groupPageAddresses.createdAt))
    .limit(1)
  // slug, который сейчас носит другая группа, ведёт на неё: действующий slug важнее истории
  if (old && !(city === null && current)) return located(old)
  return current ? located(current) : null
}
