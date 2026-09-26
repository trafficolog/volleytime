import { describe, expect, it } from 'vitest'

import {
  groupCreateHref,
  landingFaq,
  landingFeatures,
  landingSections,
  telegramBotHref,
} from './landing'

describe('MVP landing public contract', () => {
  it('keeps anonymous and unknown sessions on the recoverable login path', () => {
    expect(groupCreateHref(false)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(null)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(true)).toBe('/m/orgs/create')
  })

  it('renders only a configured valid bot', () => {
    expect(telegramBotHref('')).toBeNull()
    expect(telegramBotHref('bad/name')).toBeNull()
    expect(telegramBotHref('@VolleyTimeBot')).toBe('https://t.me/VolleyTimeBot')
  })

  it('has real anchor targets and MVP-only copy', () => {
    expect(landingSections.map((section) => section.id)).toEqual([
      'features',
      'how-it-works',
      'faq',
    ])
    expect(landingFaq).toHaveLength(4)
    expect(landingFeatures).toHaveLength(6)
    const copy = JSON.stringify([landingFaq, landingFeatures]).toLowerCase()
    for (const claim of ['credits', 'split', '30 минут', 'напоминания по расписанию']) {
      expect(copy).not.toContain(claim)
    }
  })
})
