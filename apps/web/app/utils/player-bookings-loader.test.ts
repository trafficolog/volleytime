import { describe, expect, it } from 'vitest'

import { createPlayerBookingsLoader, runPlayerBookingCancellation } from './player-bookings-loader'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('player bookings list', () => {
  it('keeps B/past when A/upcoming resolves after switching group and filter', async () => {
    let orgId = 1
    let filter: 'upcoming' | 'past' = 'upcoming'
    const older = deferred<string[]>()
    const loader = createPlayerBookingsLoader(
      () => orgId,
      () => filter,
      (id, segment) =>
        id === 1 && segment === 'upcoming' ? older.promise : Promise.resolve(['B past']),
    )

    const staleA = loader()
    orgId = 2
    filter = 'past'
    const currentB = await loader()
    older.resolve(['A upcoming'])

    expect(currentB).toEqual({ stale: false, bookings: ['B past'] })
    expect(await staleA).toEqual({ stale: true })
  })

  it('preserves the row and skips reload when the server rejects cancellation', async () => {
    const rows = ['confirmed']
    let reloaded = false
    const result = await runPlayerBookingCancellation(
      {
        id: 4,
        status: 'confirmed',
        startsAt: '2026-09-26T18:00:00Z',
        cancellationDeadlineHours: 12,
      },
      new Date('2026-09-24T12:00:00Z'),
      async () => {
        throw new Error('booking.deadline_passed')
      },
      () => true,
      () => {
        rows.pop()
        reloaded = true
      },
    )

    expect(result.kind).toBe('error')
    expect(rows).toEqual(['confirmed'])
    expect(reloaded).toBe(false)
  })

  it('reloads after successful cancellation and blocks a locally expired deadline', async () => {
    const booking = {
      id: 4,
      status: 'waitlisted',
      startsAt: '2026-09-26T18:00:00Z',
      cancellationDeadlineHours: 12,
    }
    let posts = 0
    let reloads = 0
    const send = async () => {
      posts++
    }
    const reload = () => {
      reloads++
    }

    expect(
      await runPlayerBookingCancellation(
        booking,
        new Date('2026-09-24T12:00:00Z'),
        send,
        () => true,
        reload,
      ),
    ).toEqual({ kind: 'success' })
    expect(
      await runPlayerBookingCancellation(
        booking,
        new Date('2026-09-26T06:00:01Z'),
        send,
        () => true,
        reload,
      ),
    ).toEqual({ kind: 'blocked' })
    expect(posts).toBe(1)
    expect(reloads).toBe(1)
  })
})
