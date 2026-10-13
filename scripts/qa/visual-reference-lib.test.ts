import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertLocalUrl,
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

  it('accepts only local urls', () => {
    expect(() => assertLocalUrl('http://localhost:3000', 'x')).not.toThrow()
    expect(() => assertLocalUrl('postgresql://u:p@127.0.0.1:5432/db', 'x')).not.toThrow()
    expect(() => assertLocalUrl('https://volleytime.by', 'x')).toThrow()
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

  it('html escapes titles and has an editable differences list', () => {
    const html = renderHtml(run)
    expect(html).toContain('Игрок &lt;главная&gt;')
    expect(html).toContain('contenteditable')
    expect(html).toContain('src="refs/a.png"')
  })
})
