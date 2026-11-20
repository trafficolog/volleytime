import { describe, expect, it } from 'vitest'

import { eventBalanceCard } from './cabinet-shell'
import {
  formatIsoDateRu,
  lowBalanceWarning,
  supportLine,
  unlimitedBanner,
} from './event-balance-billing'

/** Task 22.3.1: безлимит событий в кабинете и контакт поддержки. Дата «сегодня» — по Минску. */
describe('unlimited balance in the cabinet', () => {
  const summary = { balance: 7, unlimited: { until: '2026-12-31' } }
  const at = (iso: string) => new Date(iso)

  it('formats the last day as DD.MM.YYYY', () => {
    expect(formatIsoDateRu('2026-12-31')).toBe('31.12.2026')
  })

  it('shows the banner with the kept balance and no warning far from the end', () => {
    expect(unlimitedBanner(summary, at('2026-12-20T10:00:00Z'))).toEqual({
      title: 'Безлимит событий до 31.12.2026',
      kept: 'на балансе 7 событий — сохранится после',
      ending: null,
    })
  })

  it('warns from 3 days before the last day (Minsk day), including the last day itself', () => {
    expect(unlimitedBanner(summary, at('2026-12-27T20:59:00Z'))!.ending).toBeNull() // 27.12 по Минску
    expect(unlimitedBanner(summary, at('2026-12-27T21:00:00Z'))!.ending).toBe(
      'Безлимит заканчивается 31.12.2026', // 28.12 по Минску: за 3 дня
    )
    expect(unlimitedBanner(summary, at('2026-12-31T12:00:00Z'))!.ending).toBe(
      'Безлимит заканчивается 31.12.2026',
    )
  })

  it('no banner without unlimited', () => {
    expect(unlimitedBanner({ balance: 3, unlimited: null })).toBeNull()
    expect(unlimitedBanner({ balance: 3 })).toBeNull()
    expect(unlimitedBanner(null)).toBeNull()
  })

  it('hides the low-balance warning while unlimited, keeps it otherwise', () => {
    expect(
      lowBalanceWarning({ balance: 0, low: true, unlimited: { until: '2026-12-31' } }),
    ).toBeNull()
    expect(lowBalanceWarning({ balance: 0, low: true, unlimited: null })).toContain(
      'Баланс исчерпан',
    )
    expect(lowBalanceWarning({ balance: 4, low: true })).toContain('осталось 4')
  })

  it('the sidebar and Mini App badge says unlimited and drops the low flag', () => {
    expect(eventBalanceCard({ balance: 2, low: true, unlimited: { until: '2026-12-31' } })).toEqual(
      { value: '2', caption: 'безлимит до 31.12.2026', low: false },
    )
    expect(eventBalanceCard({ balance: 2, low: true, unlimited: null }).low).toBe(true)
  })

  it('the support line appears only with a contact', () => {
    expect(supportLine('@volleytime_support')).toBe('Вопросы по оплате — @volleytime_support')
    expect(supportLine(null)).toBeNull()
    expect(supportLine(undefined)).toBeNull()
    expect(supportLine('')).toBeNull()
  })
})
