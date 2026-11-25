import { describe, expect, it } from 'vitest'

import {
  cityCatalogPath,
  cityNameBySlug,
  citySlug,
  GROUP_PAGE_CITY_SLUGS,
  groupPagePath,
} from './address'
import { GROUP_PAGE_CITY_REGIONS } from './moderation'

describe('group page address (24.1.2 → 24.2.1, D-26)', () => {
  it('maps catalog cities to latin slugs', () => {
    expect(citySlug('Минск')).toBe('minsk')
    expect(citySlug('Пинск')).toBe('pinsk')
    expect(citySlug('Марьина Горка')).toBe('marina-gorka')
    expect(citySlug('Могилёв')).toBe('mogilev')
  })

  it('ignores case, spaces and ё; cities outside the catalog have no slug', () => {
    expect(citySlug('  минск ')).toBe('minsk')
    expect(citySlug('Могилев')).toBe('mogilev')
    expect(citySlug('марьина   горка')).toBe('marina-gorka')
    expect(citySlug('Вильнюс')).toBeNull()
    expect(citySlug('')).toBeNull()
    expect(citySlug(null)).toBeNull()
  })

  it('gives every catalog city a unique slug and resolves it back', () => {
    const all = GROUP_PAGE_CITY_REGIONS.flatMap(([, cities]) => cities)
    expect(GROUP_PAGE_CITY_SLUGS.length).toBe(all.length)
    expect(new Set(GROUP_PAGE_CITY_SLUGS).size).toBe(all.length)
    for (const name of all) expect(cityNameBySlug(citySlug(name)!)).toBe(name)
    for (const s of GROUP_PAGE_CITY_SLUGS) expect(s).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/)
    expect(cityNameBySlug('MINSK')).toBeNull()
    expect(cityNameBySlug('nowhere')).toBeNull()
  })

  it('builds /{city}/{group} for catalog cities, legacy /g/<slug> otherwise', () => {
    expect(groupPagePath('vt-minsk', 'Минск')).toBe('/minsk/vt-minsk')
    expect(groupPagePath('vt', 'Вильнюс')).toBe('/g/vt')
    expect(groupPagePath('vt', null)).toBe('/g/vt')
  })

  it('builds the city catalog path', () => {
    expect(cityCatalogPath('Пинск')).toBe('/pinsk')
    expect(cityCatalogPath('Вильнюс')).toBe(
      '/volleyball/%D0%92%D0%B8%D0%BB%D1%8C%D0%BD%D1%8E%D1%81',
    )
  })
})
