import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertLocalHosts,
  assertLocalUrl,
  inviteFixturePlan,
  pickEvent,
  renderHtml,
  renderMarkdown,
  resolvePath,
  selectScreens,
  validateMap,
} from './visual-reference-lib.mjs'

const root = join(__dirname, '..', '..')
const map = JSON.parse(readFileSync(join(__dirname, 'visual-reference-map.json'), 'utf8'))

type M = { version: number; screens: Record<string, unknown>[] }
const valid = (): M => structuredClone(map)

describe('visual reference map', () => {
  it('shipped map is valid', () => {
    expect(validateMap(map)).toEqual([])
  })

  it('every referenced screenshot exists in the reference export', () => {
    const missing = map.screens
      .flatMap((s: { references: string[] }) => s.references)
      .filter((r: string) => !existsSync(join(root, 'docs/design/reference-v3/screenshots', r)))
    expect(missing).toEqual([])
  })

  it('covers mini app 390x820 and cabinet 1440x900', () => {
    expect(map.viewports.miniapp).toEqual({ width: 390, height: 820 })
    expect(map.viewports.cabinet).toEqual({ width: 1440, height: 900 })
  })

  it.each([
    ['unknown viewport', (m: M) => (m.screens[0].viewport = 'tablet'), 'viewport'],
    ['duplicate id', (m: M) => (m.screens[1].id = m.screens[0].id), 'повторяющийся id'],
    ['bad reference path', (m: M) => (m.screens[0].references = ['../x.png']), 'reference'],
    ['no references', (m: M) => (m.screens[0].references = []), 'reference'],
    ['unknown role', (m: M) => (m.screens[0].role = 'root'), 'role'],
    ['missing org', (m: M) => delete m.screens[0].org, '{org}'],
    ['missing event', (m: M) => delete m.screens[1].event, '{event}'],
    ['bad path', (m: M) => (m.screens[0].path = 'm/orgs'), 'path'],
    ['bad steps', (m: M) => (m.screens[0].steps = [{ tap: 'x' }]), 'steps'],
    ['bad crop', (m: M) => (m.screens[0].referenceCrop = { x: 1 }), 'referenceCrop'],
    ['bad version', (m: M) => (m.version = 2), 'version'],
  ])('rejects %s', (_name, mutate, expected) => {
    const m = valid()
    mutate(m)
    expect(validateMap(m).join('\n')).toContain(expected)
  })

  it('M-08 invite states (20.4.7, D-06): four screens with approved jpg references', () => {
    const states = ['none', 'requested', 'invited', 'expired']
    const screens = map.screens.filter((s: { inviteState?: string }) => s.inviteState)
    expect(screens.map((s: { inviteState: string }) => s.inviteState)).toEqual(states)
    for (const s of screens) {
      expect(s.role).toBe('player')
      expect(s.references[0]).toBe(`3-miniapp-player/m08-invite-${s.inviteState}.jpg`)
    }
    const m = valid()
    m.screens.find((s) => s.inviteState)!.inviteState = 'bogus'
    expect(validateMap(m).join('\n')).toContain('inviteState')
    const noEvent = valid()
    delete noEvent.screens.find((s) => s.inviteState)!.event
    expect(validateMap(noEvent).join('\n')).toContain('{event}')
  })

  it('invite fixture plan: what each state needs in the DB', () => {
    const startsAt = new Date('2026-06-01T17:00:00Z')
    const now = new Date('2026-05-29T16:00:00Z')
    expect(inviteFixturePlan('none', { now, startsAt })).toEqual({
      request: null,
      inviteExpiresAt: null,
    })
    expect(inviteFixturePlan('requested', { now, startsAt })).toEqual({
      request: 'pending',
      inviteExpiresAt: null,
    })
    expect(inviteFixturePlan('invited', { now, startsAt })).toEqual({
      request: 'approved',
      inviteExpiresAt: startsAt,
    })
    const expired = inviteFixturePlan('expired', { now, startsAt })
    expect(expired.request).toBe('approved')
    expect(expired.inviteExpiresAt!.getTime()).toBeLessThan(now.getTime())
    expect(() => inviteFixturePlan('x', { now, startsAt })).toThrow()
  })

  it('public event screens (20.6.1): {slug} needs publicEvent with a known org', () => {
    const screen = map.screens.find((s: { id: string }) => s.id === 'public-event')
    expect(screen.role).toBe('anonymous')
    expect(resolvePath(screen.path, { slug: '0123456789ab' })).toBe('/e/0123456789ab')
    expect(() => resolvePath(screen.path, {})).toThrow(/slug/)
    const noEvent = valid()
    const target = noEvent.screens.find((s) => s.id === 'public-event')!
    delete target.publicEvent
    expect(validateMap(noEvent).join('\n')).toContain('publicEvent')
    const badOrg = valid()
    ;(badOrg.screens.find((s) => s.id === 'public-event')!.publicEvent as { org: string }).org =
      'zz'
    expect(validateMap(badOrg).join('\n')).toContain('publicEvent')
  })

  it('rejects anonymous route that needs a group', () => {
    const m = valid()
    m.screens[0].role = 'anonymous'
    expect(validateMap(m).join('\n')).toContain('anonymous')
  })

  it('rejects non-object input', () => {
    expect(validateMap(null)).not.toEqual([])
    expect(validateMap({ version: 1, screens: [] })).not.toEqual([])
  })
})

describe('route helpers', () => {
  it('resolves placeholders', () => {
    expect(resolvePath('/m/orgs/{org}/events/{event}', { orgId: 3, eventId: 9 })).toBe(
      '/m/orgs/3/events/9',
    )
    expect(() => resolvePath('/m/orgs/{org}', {})).toThrow()
  })

  it('picks nearest upcoming event, else latest past', () => {
    const now = new Date('2026-10-13T12:00:00Z')
    const events = [
      { id: 1, title: 'Основа', status: 'finished', startsAt: '2026-10-10T17:00:00Z' },
      { id: 2, title: 'Основа', status: 'published', startsAt: '2026-10-20T17:00:00Z' },
      { id: 3, title: 'Основа', status: 'published', startsAt: '2026-10-14T17:00:00Z' },
      { id: 4, title: 'Микст', status: 'published', startsAt: '2026-10-13T17:00:00Z' },
    ]
    expect(pickEvent(events, { title: 'Основа', status: 'published' }, now)?.id).toBe(3)
    expect(pickEvent(events, { title: 'Основа', status: 'finished' }, now)?.id).toBe(1)
    expect(pickEvent(events, { title: 'Нет' }, now)).toBeNull()
  })

  it('selects screens by ids and viewport', () => {
    expect(selectScreens(map, { routes: ['player-home'] })).toHaveLength(1)
    expect(selectScreens(map, { viewport: 'cabinet' }).every((s) => s.viewport === 'cabinet')).toBe(
      true,
    )
    expect(() => selectScreens(map, { routes: ['nope'] })).toThrow('nope')
  })

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000/',
    'http://[::1]:3000',
    'postgresql://postgres:postgres@localhost:5432/db',
    'postgresql://postgres:postgres@127.0.0.1:55471/db',
  ])('accepts local url %s', (url) => {
    expect(() => assertLocalUrl(url, 'x')).not.toThrow()
  })

  it.each([
    'https://volleytime.by',
    'http://localhost.evil.com:3000',
    'http://localhost:3000@evil.com',
    'postgresql://u@prod.example.com,@localhost:5432/db',
    'postgresql://u:p@localhost,prod.example.com/db',
    'postgresql://a@b@localhost/db',
    'not a url',
    'localhost:5432',
  ])('rejects non-local url %s', (url) => {
    expect(() => assertLocalUrl(url, 'x')).toThrow()
  })

  it('does not leak the raw url or password in errors', () => {
    const url = 'postgresql://u:s3cretpw@prod.example.com,@localhost/db'
    try {
      assertLocalUrl(url, 'DATABASE_URL')
    } catch (e) {
      expect((e as Error).message).not.toContain('s3cretpw')
    }
    try {
      assertLocalUrl('http://:s3cretpw@[bad', 'DATABASE_URL')
    } catch (e) {
      expect((e as Error).message).not.toContain('s3cretpw')
    }
  })

  it('checks every host of the db client', () => {
    expect(() => assertLocalHosts(['localhost'], 'x')).not.toThrow()
    expect(() => assertLocalHosts(['127.0.0.1', '::1'], 'x')).not.toThrow()
    expect(() => assertLocalHosts(['localhost', 'prod.example.com'], 'x')).toThrow()
    expect(() => assertLocalHosts([], 'x')).toThrow()
  })
})

describe('reports', () => {
  const run = {
    startedAt: '2026-10-13T00:00:00Z',
    baseUrl: 'http://localhost:3000',
    commit: 'abc1234',
    themes: ['light'],
    results: [
      {
        id: 'player-home',
        title: 'Игрок <главная>',
        theme: 'light',
        role: 'player',
        viewportSize: '390x820',
        url: '/m/orgs/1',
        capture: 'captures/player-home.light.png',
        references: ['refs/a.png'],
        diffPercent: 12.34,
        diffImage: 'diffs/player-home.light.png',
      },
    ],
  }

  it('markdown has capture, reference, diff and an empty differences list', () => {
    const md = renderMarkdown(run)
    expect(md).toContain('![capture](captures/player-home.light.png)')
    expect(md).toContain('![reference](refs/a.png)')
    expect(md).toContain('Pixel diff: 12.3%')
    expect(md).toContain('### Differences')
  })

  it('shows warning alongside capture', () => {
    const w = { ...run, results: [{ ...run.results[0], warning: 'редирект' }] }
    expect(renderMarkdown(w)).toContain('**Warning:** редирект')
    expect(renderHtml(w)).toContain('Warning: редирект')
  })

  it('html escapes titles and has an editable differences list', () => {
    const html = renderHtml(run)
    expect(html).toContain('Игрок &lt;главная&gt;')
    expect(html).toContain('contenteditable')
    expect(html).toContain('src="refs/a.png"')
  })
})
