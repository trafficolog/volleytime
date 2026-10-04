import { describe, expect, it } from 'vitest'

import { splitRollbackFixture } from './split-rollback-shell-fixture'

describe('owned rollback subprocess lifecycle', () => {
  it.each(['timeout', 'close'] as const)(
    'joins and stops a blocked owned shell tree on %s',
    async (cause) => {
      const fixture = await splitRollbackFixture()
      let entered!: () => void
      let release!: () => void
      const ready = new Promise<void>((resolve) => {
        entered = resolve
      })
      const blocked = new Promise<string>((resolve) => {
        release = () => resolve('')
      })
      fixture.hook = async () => {
        entered()
        return blocked
      }
      // The fixture budget is deliberately shorter than the test's budget.
      const run = fixture.run(undefined, 1000).then(
        () => 'returned',
        (error: unknown) => String(error),
      )
      try {
        await ready
        const result =
          cause === 'close'
            ? Promise.all([fixture.close(), run]).then(([, outcome]) => outcome)
            : run
        const outcome = await Promise.race([
          result,
          new Promise<string>((resolve) => setTimeout(() => resolve('still running'), 2000)),
        ])
        expect(outcome).toContain(cause === 'close' ? 'closed' : 'timed out')
      } finally {
        release()
        await run
        if (cause !== 'close') await fixture.close()
      }
    },
  )
})
