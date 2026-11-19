import type { PlatformAuditEntry } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  AUDIT_CATEGORY_OPTIONS,
  AUDIT_PERIOD_OPTIONS,
  auditCounter,
  auditDetails,
  auditEntryView,
  auditQuery,
} from './root-audit'

const entry = (over: Partial<PlatformAuditEntry> = {}): PlatformAuditEntry => ({
  id: 7,
  createdAt: '2026-11-18T11:22:08.000Z',
  action: 'plan.updated',
  entityType: 'plan',
  entityId: 12,
  actor: { id: 1, name: 'Ivan', email: 'ivan@t.by' },
  organization: { id: 3, name: 'Alpha' },
  oldValue: null,
  newValue: null,
  ...over,
})

describe('audit filters', () => {
  it('offers the four sections of the card and the periods', () => {
    expect(AUDIT_CATEGORY_OPTIONS.map((o) => o.value)).toEqual([
      '',
      'balance',
      'plans',
      'organizations',
      'settings',
    ])
    expect(AUDIT_PERIOD_OPTIONS.map((o) => o.value)).toEqual(['24h', '7d', '30d', 'all'])
    expect(AUDIT_PERIOD_OPTIONS.find((o) => o.value === '7d')?.label).toBe('Последние 7 дней')
  })

  it('builds a query without empty filters', () => {
    expect(auditQuery({ period: '7d', organizationId: '', category: '', q: '  ' })).toEqual({
      period: '7d',
      limit: 50,
    })
    expect(
      auditQuery({ period: 'all', organizationId: '3', category: 'plans', q: ' maria ' }, 120),
    ).toEqual({
      period: 'all',
      organizationId: 3,
      category: 'plans',
      q: 'maria',
      cursor: 120,
      limit: 50,
    })
  })
})

describe('auditCounter', () => {
  it('shows shown of total with a thousands separator', () => {
    expect(auditCounter(11, 1248)).toBe('Показано 11 из 1 248')
    expect(auditCounter(0, 0)).toBe('Записей нет')
  })
})

describe('auditEntryView', () => {
  it('formats time in the given zone and names actor and object', () => {
    const view = auditEntryView(entry(), 'Europe/Minsk')
    expect(view.time).toBe('18.11 14:22:08')
    expect(view.actor).toBe('Ivan')
    expect(view.target).toBe('Alpha')
    expect(view.object).toBe('plan #12')
    expect(view.action).toBe('plan.updated')
  })

  it('falls back to email, then to the system actor', () => {
    expect(auditEntryView(entry({ actor: { id: 1, name: '', email: 'a@t.by' } })).actor).toBe(
      'a@t.by',
    )
    expect(auditEntryView(entry({ actor: null })).actor).toBe('system')
    expect(auditEntryView(entry({ organization: null })).target).toBe('—')
  })
})

describe('auditDetails', () => {
  it('shows changed keys as old to new and new keys as key=value', () => {
    expect(auditDetails({ price: 10, name: 'A' }, { price: 15, name: 'A', archived: true })).toBe(
      'price: 10 → 15 · archived=true',
    )
  })

  it('handles missing values, nested objects and long text', () => {
    expect(auditDetails(null, null)).toBe('')
    expect(auditDetails(null, { reason: 'spam', meta: { a: 1 } })).toBe(
      'reason=spam · meta={"a":1}',
    )
    expect(auditDetails(null, 'plain')).toBe('plain')
    const long = auditDetails(null, { text: 'x'.repeat(400) })
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('…')).toBe(true)
  })
})
