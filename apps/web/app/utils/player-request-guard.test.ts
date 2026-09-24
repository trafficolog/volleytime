import { describe, expect, it } from 'vitest'

import { createPlayerRequestGuard } from './player-request-guard'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('player route request guard', () => {
  it('discards a late response from the previous organization', async () => {
    let orgId = 1
    let shown = ''
    const guard = createPlayerRequestGuard(() => orgId)
    const older = deferred<string>()
    const oldRequest = guard.begin()
    const oldCompletion = older.promise.then((value) => {
      if (oldRequest.isCurrent()) shown = value
    })

    orgId = 2
    const newRequest = guard.begin()
    if (newRequest.isCurrent()) shown = 'Группа Б'
    older.resolve('Группа А')
    await oldCompletion

    expect(shown).toBe('Группа Б')
    expect(oldRequest.isCurrent()).toBe(false)
  })

  it('discards an older refresh of the same route', () => {
    const guard = createPlayerRequestGuard(() => 'org:1:dashboard')
    const first = guard.begin()
    const second = guard.begin()

    expect(first.isCurrent()).toBe(false)
    expect(second.isCurrent()).toBe(true)
  })
})
