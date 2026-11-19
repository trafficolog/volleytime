import type { PlatformGrantRow } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  GRANT_CATEGORY_LABELS,
  GRANT_PRESETS,
  balanceAfterLabel,
  grantBody,
  grantErrorMessage,
  grantFormErrors,
  grantRowView,
  parseGrantUnits,
} from './root-grants'

const KEY = '00000000-0000-4000-8000-000000000001'

describe('parseGrantUnits', () => {
  it('accepts whole numbers 1..1000 only', () => {
    expect(parseGrantUnits('1')).toBe(1)
    expect(parseGrantUnits(' 1000 ')).toBe(1000)
    for (const raw of ['', '0', '-3', '1001', '1.5', '1,5', 'abc', '١٢', '1e2', '+5']) {
      expect(parseGrantUnits(raw), raw).toBeNull()
    }
  })
})

describe('grantFormErrors', () => {
  it('requires a reason and valid units', () => {
    expect(grantFormErrors({ units: '10', category: 'promo', comment: 'Промо' })).toEqual({})
    expect(grantFormErrors({ units: '', category: 'promo', comment: 'Промо' })).toHaveProperty(
      'units',
    )
    expect(grantFormErrors({ units: '5000', category: 'promo', comment: 'Промо' })).toHaveProperty(
      'units',
    )
    for (const comment of ['', '   ', 'ab', 'x'.repeat(501)]) {
      expect(grantFormErrors({ units: '5', category: 'promo', comment }), comment).toHaveProperty(
        'comment',
      )
    }
  })
})

describe('grantBody', () => {
  it('trims the reason and carries the idempotency key', () => {
    expect(
      grantBody({ units: ' 7 ', category: 'bugfix', comment: '  Багфикс #142 ' }, KEY),
    ).toEqual({ units: 7, category: 'bugfix', comment: 'Багфикс #142', idempotencyKey: KEY })
  })
})

describe('labels', () => {
  it('uses the mock presets and Russian categories without the word credits (D-10)', () => {
    expect(GRANT_PRESETS).toEqual([1, 5, 10, 30])
    expect(GRANT_CATEGORY_LABELS).toEqual({
      promo: 'Промо',
      compensation: 'Компенсация',
      bugfix: 'Багфикс',
      manual: 'Вручную',
    })
    expect(balanceAfterLabel(32, 10)).toBe('42 события')
    expect(balanceAfterLabel(0, 1)).toBe('1 событие')
    expect(balanceAfterLabel(5, 0)).toBe('5 событий')
    expect(JSON.stringify([GRANT_CATEGORY_LABELS, balanceAfterLabel(1, 1)])).not.toMatch(/credit/i)
  })
})

describe('grantErrorMessage', () => {
  it('maps known codes and falls back safely', () => {
    expect(grantErrorMessage('organization.not_found')).toMatch(/не найдена/)
    expect(grantErrorMessage('platform.grant_org_deleted')).toMatch(/удалена/)
    expect(grantErrorMessage('platform.grant_idempotency_conflict')).toMatch(/Обновите/)
    expect(grantErrorMessage('validation_failed')).toMatch(/Проверьте/)
    expect(grantErrorMessage(undefined)).toMatch(/Не удалось/)
  })
})

describe('grantRowView', () => {
  const row: PlatformGrantRow = {
    id: 9,
    createdAt: '2026-11-19T09:02:00.000Z',
    organization: { id: 3, name: 'СОК Витебск' },
    delta: 10,
    balanceAfter: 42,
    category: 'promo',
    comment: 'Промо за фидбек',
    actor: { id: 1, name: 'Root', email: 'root@vt.by' },
  }
  it('formats the row with a fixed time zone', () => {
    expect(grantRowView(row, 'UTC')).toEqual({
      id: 9,
      time: '19.11 09:02',
      isoTime: '2026-11-19T09:02:00.000Z',
      organization: 'СОК Витебск',
      organizationId: 3,
      amount: '+10',
      reason: 'Промо: Промо за фидбек',
      actor: 'Root',
    })
  })
  it('handles CLI grants without category, comment or actor name', () => {
    const view = grantRowView(
      { ...row, category: null, comment: null, actor: { id: 4, name: '', email: 'a@b.by' } },
      'UTC',
    )
    expect(view.reason).toBe('—')
    expect(view.actor).toBe('a@b.by')
    expect(grantRowView({ ...row, comment: 'Только текст', category: null }, 'UTC').reason).toBe(
      'Только текст',
    )
    expect(grantRowView({ ...row, actor: null }, 'UTC').actor).toBe('system')
  })
})
