import { auditLog, closeDb, db, eq, organizationLogos, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '../audit/actions'
import { OrganizationArchivedError, OrganizationNotFoundError } from '../organizations/errors'
import { organizationService } from '../organizations/service'

import {
  LogoInvalidError,
  LogoNotFoundError,
  ShortLinkInvalidError,
  ShortLinkReservedError,
  ShortLinkTakenError,
} from './errors'
import { organizationBrandingService as service } from './service'

const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  Buffer.alloc(17, 1),
])
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a464946', 'hex'), Buffer.alloc(40, 2)])

let ownerId: number
let orgId: number
let otherOrgId: number
const ctx = () => ({ userId: ownerId })

const orgRow = async (id = orgId) =>
  (await db.select().from(organizations).where(eq(organizations.id, id)))[0]!
const audit = (action: string) => db.select().from(auditLog).where(eq(auditLog.action, action))

describe('organizationBrandingService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `brand-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(ctx(), { name: 'Branding A' })).id
    otherOrgId = (await organizationService.create(ctx(), { name: 'Branding B' })).id
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('logo', () => {
    it('stores the bytes, type, size and version, and reads them back unchanged', async () => {
      const saved = await service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG })
      expect(saved.mimeType).toBe('image/png')
      expect(saved.sizeBytes).toBe(PNG.length)
      const org = await orgRow()
      expect(org.logoUpdatedAt?.getTime()).toBe(saved.logoUpdatedAt.getTime())
      const file = await service.getLogo(ctx(), orgId)
      expect(Buffer.compare(file.data, PNG)).toBe(0)
      expect(file.mimeType).toBe('image/png')
      expect(file.updatedAt.getTime()).toBe(saved.logoUpdatedAt.getTime())
    })

    it('replaces the logo, changes the version and keeps one row per group', async () => {
      const first = await service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG })
      await new Promise((r) => setTimeout(r, 5))
      const second = await service.setLogo(ctx(), orgId, { declaredType: 'image/jpeg', data: JPEG })
      expect(second.logoUpdatedAt.getTime()).toBeGreaterThan(first.logoUpdatedAt.getTime())
      const rows = await db.select().from(organizationLogos)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.mimeType).toBe('image/jpeg')
      expect((await service.getLogo(ctx(), orgId)).data.equals(JPEG)).toBe(true)
    })

    it('never mixes groups: each group reads only its own logo', async () => {
      await service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG })
      await expect(service.getLogo(ctx(), otherOrgId)).rejects.toBeInstanceOf(LogoNotFoundError)
      await service.setLogo(ctx(), otherOrgId, { declaredType: 'image/jpeg', data: JPEG })
      expect((await service.getLogo(ctx(), orgId)).data.equals(PNG)).toBe(true)
      expect((await service.getLogo(ctx(), otherOrgId)).data.equals(JPEG)).toBe(true)
    })

    it('rejects invalid files before writing anything', async () => {
      await expect(
        service.setLogo(ctx(), orgId, {
          declaredType: 'image/svg+xml',
          data: Buffer.from('<svg><script>alert(1)</script></svg>'),
        }),
      ).rejects.toBeInstanceOf(LogoInvalidError)
      await expect(
        service.setLogo(ctx(), orgId, { declaredType: 'image/jpeg', data: PNG }),
      ).rejects.toBeInstanceOf(LogoInvalidError)
      expect(await db.select().from(organizationLogos)).toHaveLength(0)
      expect((await orgRow()).logoUpdatedAt).toBeNull()
      expect(await audit(AUDIT_ACTIONS.ORG_LOGO_UPDATED)).toHaveLength(0)
    })

    it('removes the logo, clears the version and rejects a second removal', async () => {
      await service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG })
      await service.removeLogo(ctx(), orgId)
      expect((await orgRow()).logoUpdatedAt).toBeNull()
      await expect(service.getLogo(ctx(), orgId)).rejects.toBeInstanceOf(LogoNotFoundError)
      await expect(service.removeLogo(ctx(), orgId)).rejects.toBeInstanceOf(LogoNotFoundError)
    })

    it('writes audit entries without the bytes', async () => {
      await service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG })
      await service.setLogo(ctx(), orgId, { declaredType: 'image/jpeg', data: JPEG })
      await service.removeLogo(ctx(), orgId)
      const updated = await audit(AUDIT_ACTIONS.ORG_LOGO_UPDATED)
      expect(updated).toHaveLength(2)
      expect(updated[0]!.userId).toBe(ownerId)
      expect(updated[0]!.organizationId).toBe(orgId)
      expect(updated[0]!.newValue).toEqual({ mimeType: 'image/png', sizeBytes: PNG.length })
      expect(updated[1]!.oldValue).toEqual({ mimeType: 'image/png', sizeBytes: PNG.length })
      const removed = await audit(AUDIT_ACTIONS.ORG_LOGO_REMOVED)
      expect(removed).toHaveLength(1)
      expect(JSON.stringify([...updated, ...removed])).not.toContain('"data"')
    })

    it('refuses an archived or missing group', async () => {
      await organizationService.archive(ctx(), orgId)
      await expect(
        service.setLogo(ctx(), orgId, { declaredType: 'image/png', data: PNG }),
      ).rejects.toBeInstanceOf(OrganizationArchivedError)
      await expect(
        service.setLogo(ctx(), 999_999, { declaredType: 'image/png', data: PNG }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError)
    })
  })

  describe('short link', () => {
    it('sets, changes and clears the value, independent of slug', async () => {
      const before = await orgRow()
      expect(before.shortLink).toBeNull()
      expect(await service.setShortLink(ctx(), orgId, { shortLink: 'VT-Minsk' })).toEqual({
        shortLink: 'vt-minsk',
      })
      expect((await orgRow()).shortLink).toBe('vt-minsk')
      expect((await orgRow()).slug).toBe(before.slug)
      await service.setShortLink(ctx(), orgId, { shortLink: 'vt-brest' })
      expect((await orgRow()).shortLink).toBe('vt-brest')
      await service.setShortLink(ctx(), orgId, { shortLink: null })
      expect((await orgRow()).shortLink).toBeNull()
      // освобождённый адрес можно занять другой группе
      await service.setShortLink(ctx(), otherOrgId, { shortLink: 'vt-brest' })
    })

    it('rejects invalid format and reserved words with distinct errors', async () => {
      for (const shortLink of ['ab', 'a--b', 'a_b', 'абв', '']) {
        await expect(service.setShortLink(ctx(), orgId, { shortLink })).rejects.toBeInstanceOf(
          ShortLinkInvalidError,
        )
      }
      for (const shortLink of ['app', 'api', 'admin', 'login', 'API', 'Auth', 'dev']) {
        await expect(service.setShortLink(ctx(), orgId, { shortLink })).rejects.toBeInstanceOf(
          ShortLinkReservedError,
        )
      }
      // однобуквенные `m` и `e` короче минимума: отклоняются форматом
      for (const shortLink of ['m', 'e']) {
        await expect(service.setShortLink(ctx(), orgId, { shortLink })).rejects.toBeInstanceOf(
          ShortLinkInvalidError,
        )
      }
      expect((await orgRow()).shortLink).toBeNull()
    })

    it('rejects an address taken by another group, case-insensitively', async () => {
      await service.setShortLink(ctx(), orgId, { shortLink: 'taken-name' })
      await expect(
        service.setShortLink(ctx(), otherOrgId, { shortLink: 'Taken-Name' }),
      ).rejects.toBeInstanceOf(ShortLinkTakenError)
      expect((await orgRow(otherOrgId)).shortLink).toBeNull()
      // тот же адрес у той же группы — не конфликт
      await service.setShortLink(ctx(), orgId, { shortLink: 'taken-name' })
    })

    it('race: two groups claim one address at once, exactly one wins', async () => {
      const results = await Promise.allSettled([
        service.setShortLink(ctx(), orgId, { shortLink: 'race-name' }),
        service.setShortLink(ctx(), otherOrgId, { shortLink: 'race-name' }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.reason).toBeInstanceOf(ShortLinkTakenError)
      const winners = await db
        .select()
        .from(organizations)
        .where(eq(organizations.shortLink, 'race-name'))
      expect(winners).toHaveLength(1)
    })

    it('writes audit with the author and the old and new value; no-op writes nothing', async () => {
      await service.setShortLink(ctx(), orgId, { shortLink: 'audit-one' })
      await service.setShortLink(ctx(), orgId, { shortLink: 'audit-one' })
      await service.setShortLink(ctx(), orgId, { shortLink: null })
      const rows = await audit(AUDIT_ACTIONS.ORG_SHORT_LINK_UPDATED)
      expect(rows).toHaveLength(2)
      expect(rows[0]!.userId).toBe(ownerId)
      expect(rows[0]!.oldValue).toEqual({ shortLink: null })
      expect(rows[0]!.newValue).toEqual({ shortLink: 'audit-one' })
      expect(rows[1]!.oldValue).toEqual({ shortLink: 'audit-one' })
      expect(rows[1]!.newValue).toEqual({ shortLink: null })
    })

    it('pre-check reports available, taken, reserved and invalid without writing', async () => {
      await service.setShortLink(ctx(), orgId, { shortLink: 'pre-taken' })
      expect(await service.checkShortLink(ctx(), otherOrgId, 'Pre-Free')).toEqual({
        status: 'available',
        value: 'pre-free',
      })
      expect((await service.checkShortLink(ctx(), otherOrgId, 'PRE-taken')).status).toBe('taken')
      // собственный адрес группы доступен
      expect((await service.checkShortLink(ctx(), orgId, 'pre-taken')).status).toBe('available')
      expect((await service.checkShortLink(ctx(), orgId, 'admin')).status).toBe('reserved')
      for (const bad of ['', 'ab', 'a--b', '-abc', 'абв']) {
        expect((await service.checkShortLink(ctx(), orgId, bad)).status, bad).toBe('invalid')
      }
      expect((await orgRow(otherOrgId)).shortLink).toBeNull()
      expect(await audit(AUDIT_ACTIONS.ORG_SHORT_LINK_UPDATED)).toHaveLength(1)
    })

    it('refuses an archived or missing group', async () => {
      await organizationService.archive(ctx(), orgId)
      await expect(
        service.setShortLink(ctx(), orgId, { shortLink: 'archived-one' }),
      ).rejects.toBeInstanceOf(OrganizationArchivedError)
      await expect(
        service.setShortLink(ctx(), 999_999, { shortLink: 'missing-one' }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError)
    })
  })
})
