import type { PlatformGroupPageComplaint, PlatformGroupPageRow } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  ageText,
  botPreview,
  citiesKpis,
  cityInScope,
  complaintPreset,
  complaintsKpis,
  formatWhen,
  historyEntryText,
  moderationFacts,
  reporterText,
  resolutionText,
  rowActions,
  searchKey,
} from './root-group-pages'

const NOW = Date.parse('2026-11-23T12:00:00.000Z')
const row = (state: PlatformGroupPageRow['state']): PlatformGroupPageRow => ({
  organizationId: 1,
  name: 'Группа',
  slug: 'g',
  city: 'Минск',
  state,
  moderation: null,
  newComplaints: 0,
  updatedAt: '2026-11-01T00:00:00.000Z',
})

describe('moderationFacts', () => {
  it('hide: 404, no search, no catalog, Telegram signup stays', () => {
    expect(moderationFacts('hidden', 'Минск')).toEqual([
      { ok: false, text: 'Открывается по ссылке · 404' },
      { ok: false, text: 'В поиске и sitemap' },
      { ok: false, text: 'В каталоге «Минск»' },
      { ok: true, text: 'Запись в Telegram' },
    ])
  })
  it('noindex: still opens by link', () => {
    expect(moderationFacts('noindex', null)[0]).toEqual({ ok: true, text: 'Открывается по ссылке' })
    expect(moderationFacts('noindex', null)[2]!.text).toBe('В каталоге города')
  })
})

describe('botPreview', () => {
  it('mirrors the bot templates and has no reply button', () => {
    const hidden = botPreview('hidden', 'Волей', 'Спам или контакты в заголовках', ' Уберите ник ')
    expect(hidden).toMatchObject({
      title: '⛔ Страница группы скрыта',
      line: '«Волей» · по ссылке теперь не открывается',
      reason: 'Причина: Спам или контакты в заголовках',
      note: 'Уберите ник',
      button: 'Открыть кабинет',
    })
    expect(botPreview('noindex', 'Волей', null, '').title).toBe('🔍 Страница закрыта от поиска')
    expect(botPreview('noindex', 'Волей', null, '').reason).toBe('Причина: —')
  })
})

describe('rowActions', () => {
  it('offers the actions by state; noindex over owner noindex is disabled', () => {
    expect(rowActions(row('index'))).toMatchObject({ restore: false, noindex: true, hide: true })
    expect(rowActions(row('own'))).toMatchObject({
      noindex: true,
      noindexDisabled: true,
      hide: true,
    })
    expect(rowActions(row('noindex'))).toMatchObject({
      restore: true,
      restoreLabel: 'Вернуть индексацию',
      noindex: false,
      hide: true,
    })
    expect(rowActions(row('hidden'))).toMatchObject({
      restore: true,
      restoreLabel: 'Вернуть',
      hide: false,
    })
  })
})

describe('formatting', () => {
  it('formats the time in Minsk regardless of the runner zone', () => {
    expect(formatWhen('2026-05-20T15:40:00.000Z')).toBe('20 мая, 18:40')
  })
  it('ageText: minutes, hours, days', () => {
    expect(ageText('2026-11-23T11:58:00.000Z', NOW)).toBe('2 мин')
    expect(ageText('2026-11-23T06:00:00.000Z', NOW)).toBe('6 ч')
    expect(ageText('2026-11-20T12:00:00.000Z', NOW)).toBe('3 д')
    expect(ageText('2026-11-24T12:00:00.000Z', NOW)).toBe('1 мин')
  })
  it('searchKey ignores case, spaces and ё', () => {
    expect(searchKey('  Могилёв ')).toBe(searchKey('могилев'))
  })
})

describe('kpis', () => {
  it('cities', () => {
    const kpis = citiesKpis({
      cities: 120,
      citiesWithPages: 14,
      pages: 20,
      indexed: 15,
      noindex: 2,
      hidden: 1,
    })
    expect(kpis[0]).toEqual(['Городов в каталоге', '120', '14 со страницами'])
    expect(kpis[1]).toEqual(['Страниц групп', '20', '15 в поиске'])
    expect(kpis[2]![1]).toBe('2')
    expect(kpis[3]![1]).toBe('1')
  })
  it('complaints: open, oldest, solved in 30 days, average hours, limited', () => {
    expect(
      complaintsKpis(
        {
          open: 4,
          oldestOpenAt: '2026-11-20T12:00:00.000Z',
          closed30d: 6,
          avgHoursToClose30d: 11.4,
          limited30d: 14,
        },
        NOW,
      ),
    ).toEqual([
      ['Новые', '4', 'старшая 3 д'],
      ['Решено за 30 дней', '6', 'среднее время 11 ч'],
      ['Отсечено лимитом', '14', 'больше 3 в сутки с устройства'],
    ])
    const empty = complaintsKpis(
      { open: 0, oldestOpenAt: null, closed30d: 0, avgHoursToClose30d: null, limited30d: 0 },
      NOW,
    )
    expect(empty[0]![2]).toBe('новых нет')
    expect(empty[1]![2]).toBe('нет решённых')
  })
})

describe('complaints', () => {
  it('source is «вход» for a signed-in reporter and «посетитель» otherwise', () => {
    expect(reporterText({ kind: 'user', id: 1, name: 'Лера', telegramUsername: 'lera_s' })).toEqual(
      { kind: 'вход', detail: '@lera_s' },
    )
    expect(reporterText({ kind: 'user', id: 1, name: 'Лера', telegramUsername: null }).detail).toBe(
      'Лера',
    )
    expect(reporterText({ kind: 'anonymous' })).toEqual({
      kind: 'посетитель',
      detail: 'без входа',
    })
  })
  it('presets a moderation reason from the complaint reason', () => {
    expect(complaintPreset('price')).toBe('price')
    expect(complaintPreset('fraud')).toBe('pay')
    expect(complaintPreset('other')).toBeNull()
  })
  it('resolution text', () => {
    const c = (resolution: PlatformGroupPageComplaint['resolution']) =>
      ({ resolution, resolvedAt: '2026-04-30T08:00:00.000Z' }) as PlatformGroupPageComplaint
    expect(resolutionText(c('no_violation'))).toBe('Отклонена · нарушений нет · 30 апреля')
    expect(resolutionText(c('hidden'))).toBe('Страница скрыта · 30 апреля')
    expect(resolutionText(c('noindex'))).toBe('Принудительный noindex · 30 апреля')
  })
})

describe('cityInScope and history', () => {
  const city = { name: 'А', pages: 0, indexed: 0, noindex: 0, hidden: 0, issues: 1 }
  it('filters cities by scope', () => {
    expect(cityInScope(city, 'all')).toBe(true)
    expect(cityInScope(city, 'pages')).toBe(false)
    expect(cityInScope(city, 'issues')).toBe(true)
  })
  it('history entry text', () => {
    const base = { at: 'x', note: null, actor: null, reasonCode: null }
    expect(historyEntryText({ ...base, kind: 'hidden', reasonTitle: 'Спам' })).toBe('Скрыта · Спам')
    expect(historyEntryText({ ...base, kind: 'restored', reasonTitle: null })).toContain('снято')
    expect(historyEntryText({ ...base, kind: 'complaint', reasonTitle: 'Другое' })).toBe(
      'Жалоба с публичной страницы · Другое',
    )
  })
})
