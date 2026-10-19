import { describe, expect, it } from 'vitest'

import { buildEventAnnouncement, formatAnnounceWhen } from './announcement'

const base = {
  title: 'Основа',
  startsAt: new Date('2026-05-28T17:00:00Z'), // 20:00 в Минске
  timeZone: 'Europe/Minsk',
  placeName: 'Школа №24',
  capacity: 14,
  taken: 9,
  deeplink: 'https://t.me/volleytime_test_bot?startapp=event_77',
}

describe('event announcement (20.3.4)', () => {
  it('formats the date like the mockup in the group time zone', () => {
    expect(formatAnnounceWhen(base.startsAt, 'Europe/Minsk')).toBe('Чт · 28 мая · 20:00')
    expect(formatAnnounceWhen(base.startsAt, 'Asia/Vladivostok')).toBe('Пт · 29 мая · 03:00')
  })

  it('renders date, place and free seats like the mockup', () => {
    expect(buildEventAnnouncement(base).text).toBe(
      '<b>Чт · 28 мая · 20:00</b>\nОснова · Школа №24\n<i>Свободно 5 из 14 мест.</i>',
    )
  })

  it('says there are no seats instead of a negative number', () => {
    expect(buildEventAnnouncement({ ...base, taken: 14 }).text).toContain('<i>Мест нет.</i>')
    expect(buildEventAnnouncement({ ...base, taken: 20 }).text).toContain('<i>Мест нет.</i>')
  })

  it('has only url deeplink buttons: no web_app and no callback actions in a group chat', () => {
    const { keyboard } = buildEventAnnouncement(base)
    expect(keyboard!.flat().map((b) => b.text)).toEqual(['Записаться', 'Открыть тренировку'])
    for (const b of keyboard!.flat()) {
      expect(b.url).toBe(base.deeplink)
      expect(b.webAppUrl).toBeUndefined()
      expect(b.callbackData).toBeUndefined()
    }
  })

  it('escapes user text so a title cannot inject markup', () => {
    const text = buildEventAnnouncement({
      ...base,
      title: '<b>X</b> & Co',
      placeName: '<i>Зал',
    }).text
    expect(text).toContain('&lt;b&gt;X&lt;/b&gt; &amp; Co · &lt;i&gt;Зал')
    expect(text).not.toContain('<b>X</b>')
  })
})
