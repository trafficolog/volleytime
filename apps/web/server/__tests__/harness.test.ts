import { describe, expect, it } from 'vitest'

import { routeFromRelativeFile } from './harness'

describe('routeFromRelativeFile', () => {
  it.each([
    'organizations/[orgId]/events/[eventId]/index.get.ts',
    'organizations\\[orgId]\\events\\[eventId]\\index.get.ts',
  ])('maps nested Nitro route on either path separator: %s', (relativeFile) => {
    expect(routeFromRelativeFile(relativeFile)).toEqual({
      method: 'get',
      route: '/api/organizations/:orgId/events/:eventId',
    })
  })
})
