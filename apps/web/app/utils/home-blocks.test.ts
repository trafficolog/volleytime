import { defaultPlayerFeatures, type PlayerFeatures } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  HOME_BLOCKS,
  homeFeaturesLink,
  showHomeFeaturesLink,
  visibleHomeBlocks,
  type HomeBlockData,
} from './home-blocks'

const none = (): PlayerFeatures =>
  Object.fromEntries(Object.keys(defaultPlayerFeatures()).map((k) => [k, false])) as PlayerFeatures
const allData: HomeBlockData = {
  teams: { x: 1 },
  warmup: { x: 1 },
  afterGame: { x: 1 },
  coach: { x: 1 },
  wrapped: { x: 1 },
}

describe('visibleHomeBlocks (23.2.1)', () => {
  it('is empty without data, whatever the flags are', () => {
    expect(visibleHomeBlocks(defaultPlayerFeatures(), {})).toEqual([])
    expect(visibleHomeBlocks(none(), {})).toEqual([])
  })

  it('shows every block in the layout order when flags are on and data is present', () => {
    expect(visibleHomeBlocks(defaultPlayerFeatures(), allData).map((b) => b.id)).toEqual(
      HOME_BLOCKS.map((b) => b.id),
    )
  })

  it('hides a block whose flag is off even when data is present', () => {
    expect(visibleHomeBlocks(none(), allData)).toEqual([])
    const ids = visibleHomeBlocks({ ...defaultPlayerFeatures(), warmup: false }, allData).map(
      (b) => b.id,
    )
    expect(ids).not.toContain('warmup')
    expect(ids).toContain('teams')
  })

  it('treats null, undefined and empty arrays as no data', () => {
    const features = defaultPlayerFeatures()
    expect(
      visibleHomeBlocks(features, { teams: null, warmup: undefined, coach: [], wrapped: [] }),
    ).toEqual([])
    expect(visibleHomeBlocks(features, { teams: [1] }).map((b) => b.id)).toEqual(['teams'])
    expect(visibleHomeBlocks(features, { teams: 0 }).map((b) => b.id)).toEqual(['teams'])
  })

  it('passes the injected data through to the block', () => {
    const [block] = visibleHomeBlocks(defaultPlayerFeatures(), { coach: { week: 3 } })
    expect(block).toEqual({ id: 'coach', flags: ['coach'], data: { week: 3 } })
  })

  it('shows «После игры» for either self or mvp and reports only the enabled flags', () => {
    const data: HomeBlockData = { afterGame: { x: 1 } }
    expect(visibleHomeBlocks({ ...none(), self: true }, data)[0]?.flags).toEqual(['self'])
    expect(visibleHomeBlocks({ ...none(), mvp: true }, data)[0]?.flags).toEqual(['mvp'])
    expect(visibleHomeBlocks({ ...none(), self: true, mvp: true }, data)[0]?.flags).toEqual([
      'self',
      'mvp',
    ])
    expect(visibleHomeBlocks({ ...none(), cal: true, streak: true }, data)).toEqual([])
  })

  it('ignores flags that own no block (cal, streak)', () => {
    expect(visibleHomeBlocks({ ...none(), cal: true, streak: true }, allData)).toEqual([])
  })
})

describe('home features link', () => {
  it('points to «Что показывать» of the group', () => {
    expect(homeFeaturesLink(30)).toBe('/m/orgs/30/features')
  })

  it('is hidden only when every flag is off', () => {
    expect(showHomeFeaturesLink(defaultPlayerFeatures())).toBe(true)
    expect(showHomeFeaturesLink({ ...none(), wrapped: true })).toBe(true)
    expect(showHomeFeaturesLink(none())).toBe(false)
  })
})
