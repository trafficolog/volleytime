import { describe, expect, it } from 'vitest'

import { createSubscriptionViewLoader } from './subscription-view-loader'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('subscription view loading', () => {
  it('discards an older organization response after group switch', async () => {
    let orgId = 1
    const old = deferred<string[]>()
    const loader = createSubscriptionViewLoader(
      () => orgId,
      () => false,
      (id) => (id === 1 ? old.promise : Promise.resolve(['B subscription'])),
      async () => [],
    )
    const first = loader()
    orgId = 2
    const second = await loader()
    old.resolve(['A subscription'])

    expect(second).toEqual({ stale: false, subscriptions: ['B subscription'], plans: [] })
    expect(await first).toEqual({ stale: true })
  })

  it('discards an older same-organization refresh, including a late plans response', async () => {
    const oldPlans = deferred<string[]>()
    const oldPlansStarted = deferred<void>()
    let calls = 0
    const loader = createSubscriptionViewLoader(
      () => 1,
      () => true,
      async () => [calls++ === 0 ? 'old balance' : 'new balance'],
      async () => {
        if (calls !== 1) return ['new plan']
        oldPlansStarted.resolve()
        return oldPlans.promise
      },
    )
    const first = loader()
    await oldPlansStarted.promise
    const second = await loader()
    oldPlans.resolve(['old plan'])

    expect(second).toEqual({
      stale: false,
      subscriptions: ['new balance'],
      plans: ['new plan'],
    })
    expect(await first).toEqual({ stale: true })
  })
})
