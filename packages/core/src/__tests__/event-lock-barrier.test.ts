import { db } from '@volley-time/db'
import type * as DbModule from '@volley-time/db'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { behindEventLock } from './event-lock-barrier'

vi.mock('@volley-time/db', async (original) => ({
  ...(await original<typeof DbModule>()),
  db: { transaction: vi.fn(), execute: vi.fn() },
}))

afterEach(() => vi.clearAllMocks())
describe('event lock barrier failure cleanup', () => {
  it.each([false, true])(
    'joins pending operations after post-ready blocker rejection (barrier fails=%s)',
    async (barrierFails) => {
      const blockerFailure = new Error('blocker commit failed')
      vi.mocked(db.transaction).mockImplementation(async (operation) => {
        await operation({ execute: async () => [{ pid: 1 }] } as never)
        throw blockerFailure
      })
      if (barrierFails)
        vi.mocked(db.execute).mockRejectedValue(new Error('barrier observation failed'))
      else vi.mocked(db.execute).mockResolvedValue([{ pid: 2 }] as never)
      let release!: () => void
      const pending = new Promise<void>((resolve) => {
        release = resolve
      })
      let completed = false
      let failure: unknown
      const result = behindEventLock(71, [() => pending])
        .catch((error) => {
          failure = error
        })
        .finally(() => {
          completed = true
        })
      // The transaction reaches its post-ready rejection while the owned operation remains pending.
      await new Promise((resolve) => setImmediate(resolve))
      expect(completed).toBe(false)
      release()
      await result
      if (barrierFails) expect(String(failure)).toContain('barrier observation failed')
      else expect(failure).toBe(blockerFailure)
    },
  )
})
