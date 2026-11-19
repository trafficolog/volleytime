import type { PlatformEventBalancePackage, PlatformPackageHistoryEntry } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  PACKAGE_BADGE_LABELS,
  type PackageForm,
  formatPackageMoney,
  historyDetails,
  historyEntryView,
  packageCreateBody,
  packageDuplicateBody,
  packageErrorMessage,
  packageFormErrors,
  packagePatchBody,
  packagePreview,
  packageRowView,
  packageToForm,
  parsePackagePrice,
  parsePackageUnits,
  pricePerEventLabel,
  revenueLabel,
  unattributedView,
} from './root-packages'

const pkg = (extra: Partial<PlatformEventBalancePackage> = {}): PlatformEventBalancePackage => ({
  id: 2,
  code: 'events_30',
  units: 30,
  amount: 12_000,
  currency: 'BYN',
  badge: 'popular',
  visible: true,
  archivedAt: null,
  sortOrder: 20,
  version: 3,
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-19T10:00:00.000Z',
  pricePerEvent: 400,
  sales: [{ currency: 'BYN', sold: 7, revenue: 84_000 }],
  ...extra,
})

const entry = (
  action: PlatformPackageHistoryEntry['action'],
  oldValue: unknown,
  newValue: unknown,
): PlatformPackageHistoryEntry => ({
  id: 9,
  createdAt: '2026-11-19T09:02:00.000Z',
  action,
  packageId: 2,
  packageCode: 'events_30',
  actor: { id: 1, name: 'Root', email: 'root@vt.test' },
  oldValue,
  newValue,
})

describe('package labels (R-02, D-10, D-18)', () => {
  it('uses fixed badge captions; the discount badge is not a computed percentage', () => {
    expect(PACKAGE_BADGE_LABELS).toEqual({
      popular: 'Популярный',
      discount: 'Скидка',
      best_price: 'Лучшая цена',
    })
    expect(packageRowView(pkg({ badge: 'discount' })).badge).toBe('Скидка')
    expect(packageRowView(pkg({ badge: null })).badge).toBeNull()
  })

  it('formats money in Br with whole amounts without kopecks and the price per event with them', () => {
    expect(formatPackageMoney(5000)).toBe('50 Br')
    expect(formatPackageMoney(5050)).toBe('50,50 Br')
    expect(formatPackageMoney(0)).toBe('0 Br')
    expect(formatPackageMoney(100_000_00)).toBe('100 000 Br')
    expect(formatPackageMoney(100, 'USD')).toBe('1 USD')
    expect(pricePerEventLabel(500)).toBe('5,00 Br за событие')
    expect(pricePerEventLabel(350)).toBe('3,50 Br за событие')
  })

  it('never writes the word credit and uses event wording', () => {
    const row = packageRowView(pkg())
    expect(JSON.stringify(row).toLowerCase()).not.toContain('credit')
    expect(row.unitsCaption).toBe('событий')
    expect(packageRowView(pkg({ units: 1 })).unitsCaption).toBe('событие')
    expect(packageRowView(pkg({ units: 2 })).unitsCaption).toBe('события')
  })
})

describe('package rows', () => {
  it('shows price, price per event, sold and revenue from the snapshot-based sales', () => {
    expect(packageRowView(pkg())).toMatchObject({
      price: '120 Br',
      perEvent: '4,00 Br за событие',
      sold: '7',
      revenue: '+840 Br',
      hasRevenue: true,
      draft: false,
      archived: false,
    })
  })

  it('marks a hidden non-archived package as a draft and an archived one as archived', () => {
    expect(packageRowView(pkg({ visible: false })).draft).toBe(true)
    const archived = packageRowView(pkg({ visible: false, archivedAt: '2026-11-19T10:00:00.000Z' }))
    expect(archived).toMatchObject({ draft: false, archived: true })
  })

  it('shows a dash for no revenue, keeps currencies apart and describes the unattributed row', () => {
    expect(packageRowView(pkg({ sales: [] }))).toMatchObject({
      sold: '0',
      revenue: '—',
      hasRevenue: false,
    })
    expect(
      revenueLabel([
        { currency: 'BYN', sold: 1, revenue: 5000 },
        { currency: 'USD', sold: 1, revenue: 100 },
      ]),
    ).toBe('+50 Br · +1 USD')
    expect(unattributedView([])).toEqual({ sold: '0', revenue: '—', any: false })
    expect(unattributedView([{ currency: 'BYN', sold: 2, revenue: 16_000 }])).toEqual({
      sold: '2',
      revenue: '+160 Br',
      any: true,
    })
  })
})

describe('package form', () => {
  const form = (extra: Partial<PackageForm> = {}): PackageForm => ({
    units: '30',
    price: '120',
    badge: null,
    visible: false,
    ...extra,
  })

  it('parses price in major units with a comma or a dot, rejecting the rest', () => {
    expect(parsePackagePrice('120')).toBe(12_000)
    expect(parsePackagePrice('120,5')).toBe(12_050)
    expect(parsePackagePrice(' 0.29 ')).toBe(29)
    expect(parsePackagePrice('0')).toBe(0)
    expect(parsePackagePrice('100000')).toBe(10_000_000)
    for (const bad of ['', 'abc', '-1', '1,234', '100000,01', '1e3', '12 0']) {
      expect(parsePackagePrice(bad), bad).toBeNull()
    }
  })

  it('parses units as a whole number 1…10000', () => {
    expect(parsePackageUnits('1')).toBe(1)
    expect(parsePackageUnits('10000')).toBe(10_000)
    for (const bad of ['', '0', '10001', '1.5', '-3', 'x', '010000']) {
      expect(parsePackageUnits(bad), bad).toBeNull()
    }
  })

  it('reports field errors; editing ignores the (read-only) quantity', () => {
    expect(packageFormErrors(form())).toEqual({})
    expect(Object.keys(packageFormErrors(form({ units: '', price: 'x' })))).toEqual([
      'units',
      'price',
    ])
    expect(packageFormErrors(form({ units: '' }), true)).toEqual({})
    expect(Object.keys(packageFormErrors(form({ price: '' }), true))).toEqual(['price'])
  })

  it('builds request bodies: create, duplicate and a patch with only changed fields and the version', () => {
    expect(packageCreateBody(form({ badge: 'discount', visible: true }))).toEqual({
      units: 30,
      amount: 12_000,
      badge: 'discount',
      visible: true,
    })
    expect(packageDuplicateBody(form({ units: '60', price: '210' }))).toEqual({
      units: 60,
      amount: 21_000,
    })
    const source = pkg()
    expect(packagePatchBody(packageToForm(source), source)).toEqual({ version: 3 })
    expect(packagePatchBody(form({ price: '130', badge: null, visible: false }), source)).toEqual({
      version: 3,
      amount: 13_000,
      badge: null,
      visible: false,
    })
  })

  it('round-trips a package into the form and previews the card', () => {
    expect(packageToForm(pkg({ amount: 12_050 }))).toEqual({
      units: '30',
      price: '120,50',
      badge: 'popular',
      visible: true,
    })
    expect(packagePreview(form())).toEqual({
      units: '30',
      caption: 'событий',
      price: '120 Br',
      perEvent: '4,00 Br за событие',
    })
    expect(packagePreview(form({ units: 'x', price: '' }))).toEqual({
      units: '—',
      caption: 'событий',
      price: '—',
      perEvent: '—',
    })
  })
})

describe('error messages and history', () => {
  it('explains the package error codes and falls back for unknown ones', () => {
    expect(packageErrorMessage('event_balance_package.units_taken')).toContain(
      'количеством событий',
    )
    expect(packageErrorMessage('event_balance_package.stale')).toContain('другой администратор')
    expect(packageErrorMessage('boom')).toBe('Не удалось выполнить действие. Попробуйте ещё раз')
    expect(packageErrorMessage(undefined)).toBe('Не удалось выполнить действие. Попробуйте ещё раз')
  })

  it('describes each audit action from its old and new values', () => {
    expect(
      historyDetails(
        entry('event_balance_package.created', null, {
          units: 60,
          amount: 21_000,
          currency: 'BYN',
          duplicatedFromId: 2,
        }),
      ),
    ).toBe('60 событий · 210 Br · копия пакета №2')
    expect(
      historyDetails(
        entry(
          'event_balance_package.updated',
          { amount: 13_000, badge: null, sortOrder: 20 },
          { amount: 12_000, badge: 'discount', sortOrder: 21 },
        ),
      ),
    ).toBe('Цена: 130 Br → 120 Br · Бейдж: — → Скидка · Порядок: 20 → 21')
    expect(
      historyDetails(
        entry('event_balance_package.visibility_changed', { visible: true }, { visible: false }),
      ),
    ).toBe('Витрина: показан → скрыт')
    expect(historyDetails(entry('event_balance_package.archived', { visible: true }, null))).toBe(
      'Заявки пакета не изменены',
    )
  })

  it('builds a history row in a fixed time zone', () => {
    const view = historyEntryView(
      entry('event_balance_package.updated', { amount: 1 }, { amount: 2 }),
      'Europe/Minsk',
    )
    expect(view).toMatchObject({
      time: '19.11 12:02',
      isoTime: '2026-11-19T09:02:00.000Z',
      title: 'Параметры изменены',
      pkg: 'events_30',
      actor: 'Root',
    })
  })
})
