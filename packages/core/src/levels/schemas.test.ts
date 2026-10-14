import { describe, expect, it } from 'vitest'

import { CreateEventInput, UpdateEventInput } from '../events/schemas'
import { SetMemberLevelInput } from '../members/schemas'

import { GroupLevelsInput, LevelCode, sortLevels } from './schemas'

describe('level schemas (unit, 19.2.3)', () => {
  it('LevelCode accepts only the five codes; A/B/C and display titles are rejected', () => {
    for (const ok of ['v1', 'v2', 'v3', 'v4', 'v4_plus']) expect(LevelCode.parse(ok)).toBe(ok)
    for (const bad of ['A', 'B', 'C', 'В1', 'v5', 'V1', '', null, 1]) {
      expect(LevelCode.safeParse(bad).success).toBe(false)
    }
  })

  it('sortLevels orders by the scale and drops duplicates', () => {
    expect(sortLevels(['v4_plus', 'v1', 'v3', 'v1'])).toEqual(['v1', 'v3', 'v4_plus'])
    expect(sortLevels([])).toEqual([])
  })

  it('GroupLevelsInput normalises, allows empty and bounds the size', () => {
    expect(GroupLevelsInput.parse(['v4', 'v2', 'v4'])).toEqual(['v2', 'v4'])
    expect(GroupLevelsInput.parse([])).toEqual([])
    expect(GroupLevelsInput.safeParse(['v1', 'nope']).success).toBe(false)
    expect(GroupLevelsInput.safeParse(['v1', 'v2', 'v3', 'v4', 'v4_plus', 'v1']).success).toBe(
      false,
    )
    expect(GroupLevelsInput.safeParse('v1').success).toBe(false)
  })

  it('SetMemberLevelInput requires level, allows null and forbids extra keys', () => {
    expect(SetMemberLevelInput.parse({ level: 'v3' })).toEqual({ level: 'v3' })
    expect(SetMemberLevelInput.parse({ level: null })).toEqual({ level: null })
    expect(SetMemberLevelInput.safeParse({}).success).toBe(false)
    expect(SetMemberLevelInput.safeParse({ level: 'v3', role: 'owner' }).success).toBe(false)
  })

  it('event level is optional/nullable on create and update', () => {
    const base = {
      title: 'Игра',
      startsAt: '2030-01-01T10:00:00Z',
      endsAt: '2030-01-01T12:00:00Z',
      capacity: 10,
    }
    expect(CreateEventInput.parse(base).level).toBeUndefined()
    expect(CreateEventInput.parse({ ...base, level: 'v2' }).level).toBe('v2')
    expect(CreateEventInput.safeParse({ ...base, level: 'B' }).success).toBe(false)
    expect(UpdateEventInput.parse({ level: null }).level).toBeNull()
    expect(UpdateEventInput.safeParse({ level: 'x' }).success).toBe(false)
  })
})
