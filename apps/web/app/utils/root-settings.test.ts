import type { PlatformSettingKey, PlatformSettingsResponse } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  formFromSettings,
  historyRow,
  parseFieldInput,
  sectionChanges,
  sectionDirty,
  sectionErrors,
  sectionFromQuery,
} from './root-settings'

const view = (value: unknown, def: unknown, version = 0) => ({
  value,
  default: def,
  version,
  updatedAt: null,
  updatedBy: null,
})

function response(over: Partial<Record<PlatformSettingKey, ReturnType<typeof view>>> = {}) {
  return {
    settings: {
      'general.platformName': view('Volley Time', 'Volley Time'),
      'general.supportContact': view(null, null),
      'eventBalance.newOrganizationGrant': view(5, 5),
      'events.maxPublishedPerDay': view(null, null),
      'bot.callbackLimit': view(8, 8),
      'bot.callbackWindowSeconds': view(10, 10),
      ...over,
    },
    readonly: {},
    applyDelaySeconds: 30,
  } as unknown as PlatformSettingsResponse
}

describe('root settings form', () => {
  it('builds the form from the response, empty for null values', () => {
    expect(formFromSettings(response())).toEqual({
      'general.platformName': 'Volley Time',
      'general.supportContact': '',
      'eventBalance.newOrganizationGrant': '5',
      'events.maxPublishedPerDay': '',
      'bot.callbackLimit': '8',
      'bot.callbackWindowSeconds': '10',
    })
  })

  it('parses inputs: numbers, empty daily limit and empty contact as null, text as is', () => {
    expect(parseFieldInput('bot.callbackLimit', ' 12 ')).toBe(12)
    expect(parseFieldInput('bot.callbackLimit', 'abc')).toBe('abc')
    expect(parseFieldInput('bot.callbackLimit', '')).toBe('')
    expect(parseFieldInput('events.maxPublishedPerDay', '')).toBeNull()
    expect(parseFieldInput('events.maxPublishedPerDay', '3')).toBe(3)
    expect(parseFieldInput('general.supportContact', '  ')).toBeNull()
    expect(parseFieldInput('general.platformName', ' Volley ')).toBe(' Volley ')
  })

  it('sends only changed keys of the section with their versions', () => {
    const data = response({ 'bot.callbackLimit': view(9, 8, 3) })
    const form = formFromSettings(data)
    expect(sectionDirty('limits', form, data)).toBe(false)
    expect(sectionChanges('limits', form, data)).toEqual([])
    form['bot.callbackLimit'] = '12'
    form['events.maxPublishedPerDay'] = '2'
    expect(sectionChanges('limits', form, data)).toEqual([
      { key: 'events.maxPublishedPerDay', value: 2, version: 0 },
      { key: 'bot.callbackLimit', value: 12, version: 3 },
    ])
    // другой раздел не затрагивается
    expect(sectionChanges('general', form, data)).toEqual([])
  })

  it('clearing the daily limit sends null; clearing the contact sends null', () => {
    const data = response({
      'events.maxPublishedPerDay': view(4, null, 1),
      'general.supportContact': view('@help', null, 1),
    })
    const form = formFromSettings(data)
    form['events.maxPublishedPerDay'] = ''
    form['general.supportContact'] = ''
    expect(sectionChanges('limits', form, data)).toEqual([
      { key: 'events.maxPublishedPerDay', value: null, version: 1 },
    ])
    expect(sectionChanges('general', form, data)).toEqual([
      { key: 'general.supportContact', value: null, version: 1 },
    ])
  })

  it('validates fields with the registry bounds', () => {
    const form = formFromSettings(response())
    expect(sectionErrors('limits', form)).toEqual({})
    Object.assign(form, {
      'eventBalance.newOrganizationGrant': '0',
      'events.maxPublishedPerDay': '51',
      'bot.callbackLimit': '1.5',
      'bot.callbackWindowSeconds': '',
      'general.platformName': '   ',
    })
    expect(Object.keys(sectionErrors('limits', form)).sort()).toEqual([
      'bot.callbackLimit',
      'bot.callbackWindowSeconds',
      'eventBalance.newOrganizationGrant',
      'events.maxPublishedPerDay',
    ])
    expect(Object.keys(sectionErrors('general', form))).toEqual(['general.platformName'])
  })

  it('reads the section from the query, unknown means general', () => {
    expect(sectionFromQuery('limits')).toBe('limits')
    expect(sectionFromQuery(['security', 'x'])).toBe('security')
    expect(sectionFromQuery('secrets')).toBe('general')
    expect(sectionFromQuery(undefined)).toBe('general')
  })

  it('labels history rows with the field name, actor and readable values', () => {
    expect(
      historyRow({
        id: 1,
        createdAt: '2026-11-20T10:00:00.000Z',
        actor: { id: 1, name: 'Root' },
        key: 'events.maxPublishedPerDay',
        oldValue: null,
        newValue: 3,
      }),
    ).toMatchObject({
      label: 'Макс. опубликованных событий в день на группу',
      who: 'Root',
      from: 'без лимита',
      to: '3',
    })
  })
})
