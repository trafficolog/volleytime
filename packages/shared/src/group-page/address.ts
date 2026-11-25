import { slugify } from '../slug/slug'

import { GROUP_PAGE_CITY_REGIONS, moderationCityKey } from './moderation'

/**
 * Адрес публичной страницы группы (24.2.1, D-26): `/{город}/{группа}`, где город — slug районного
 * центра из справочника каталога (`GROUP_PAGE_CITY_REGIONS`), группа — `organizations.slug`.
 * Город вне справочника (или не задан) адреса с городом не получает: страница остаётся на
 * `/g/<slug>`, каталог — на `/volleyball/<город>`.
 */
const CITY_BY_KEY = new Map<string, { name: string; slug: string }>()
const CITY_BY_SLUG = new Map<string, string>()
for (const [, cities] of GROUP_PAGE_CITY_REGIONS)
  for (const name of cities) {
    const slug = slugify(name)
    CITY_BY_KEY.set(moderationCityKey(name), { name, slug })
    CITY_BY_SLUG.set(slug, name)
  }

/** Slug всех городов справочника (адрес каталога `/<slug>` и первый сегмент адреса группы). */
export const GROUP_PAGE_CITY_SLUGS: readonly string[] = [...CITY_BY_SLUG.keys()]

/** Slug города справочника по названию (`organizations.city`); вне справочника — `null`. */
export function citySlug(city: string | null | undefined): string | null {
  if (!city) return null
  return CITY_BY_KEY.get(moderationCityKey(city))?.slug ?? null
}

/** Название города справочника по slug адреса (строго строчными); неизвестный — `null`. */
export function cityNameBySlug(slug: string): string | null {
  return CITY_BY_SLUG.get(slug) ?? null
}

/** Канонический путь страницы группы: `/{город}/{группа}` или `/g/<slug>` без города справочника. */
export function groupPagePath(slug: string, city: string | null | undefined): string {
  const c = citySlug(city)
  return c ? `/${c}/${slug}` : `/g/${slug}`
}

/** Путь каталога города: `/<slug>` для города справочника, иначе `/volleyball/<город>`. */
export function cityCatalogPath(city: string): string {
  const c = citySlug(city)
  return c ? `/${c}` : `/volleyball/${encodeURIComponent(city.trim().replace(/\s+/g, ' '))}`
}
