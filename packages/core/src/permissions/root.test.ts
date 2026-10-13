import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { ForbiddenError } from './errors'
import { assertRootAdmin, isRootAdmin, requireRootAdminUser } from './root'

describe('root admin policy (19.3.1)', () => {
  describe('pure checks', () => {
    it('only users.isRootAdmin = true is root', () => {
      expect(isRootAdmin({ isRootAdmin: true })).toBe(true)
      expect(isRootAdmin({ isRootAdmin: false })).toBe(false)
      expect(isRootAdmin(null)).toBe(false)
      expect(isRootAdmin(undefined)).toBe(false)
    })

    it('requireRootAdminUser throws forbidden.root_only', () => {
      expect(() => requireRootAdminUser({ isRootAdmin: true })).not.toThrow()
      expect(() => requireRootAdminUser({ isRootAdmin: false })).toThrow(ForbiddenError)
      try {
        requireRootAdminUser(null)
      } catch (e) {
        expect((e as ForbiddenError).code).toBe('forbidden.root_only')
      }
    })
  })

  describe('assertRootAdmin (reads the flag from the database every call)', () => {
    let rootId: number, ownerId: number

    beforeEach(async () => {
      await db.delete(organizations)
      await db.delete(users)
      rootId = (
        await db
          .insert(users)
          .values({ email: `root-${Math.random()}@t.by`, isRootAdmin: true })
          .returning()
      )[0]!.id
      ownerId = (
        await db
          .insert(users)
          .values({ email: `owner-${Math.random()}@t.by` })
          .returning()
      )[0]!.id
      await organizationService.create({ userId: ownerId }, { name: 'Owner org' })
    })

    it('root passes and gets its user row', async () => {
      const user = await assertRootAdmin({ userId: rootId })
      expect(user.id).toBe(rootId)
    })

    it('organization owner is not root', async () => {
      await expect(assertRootAdmin({ userId: ownerId })).rejects.toThrow(ForbiddenError)
    })

    it('unknown user is not root', async () => {
      await expect(assertRootAdmin({ userId: 2_000_000_000 })).rejects.toThrow(ForbiddenError)
    })

    it('revoking the flag takes effect on the next call (no cached role)', async () => {
      await assertRootAdmin({ userId: rootId })
      await db.update(users).set({ isRootAdmin: false }).where(eq(users.id, rootId))
      await expect(assertRootAdmin({ userId: rootId })).rejects.toThrow(ForbiddenError)
    })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
