import { beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

beforeAll(() => {
  // Nitro auto-import в юнит-тесте
  ;(globalThis as Record<string, unknown>).createError = (o: Record<string, unknown>) =>
    Object.assign(new Error(String(o.statusMessage)), o)
})

describe('handleServiceError (4.9.11)', async () => {
  const { handleServiceError } = await import('./handle-errors')
  const { OrganizationNotFoundError } = await import('@volley-time/core')

  const catchErr = (e: unknown) => {
    try {
      handleServiceError(e)
    } catch (err) {
      return err as { statusCode: number; data: Record<string, unknown>; message: string }
    }
    throw new Error('did not throw')
  }

  it('ZodError → 422 with compact issues, no raw dump', () => {
    const r = z.object({ name: z.string().min(2) }).safeParse({ name: 'x' })
    const err = catchErr(r.error)
    expect(err.statusCode).toBe(422)
    expect(err.data.code).toBe('validation_failed')
    expect(err.data.issues).toEqual([{ path: 'name', message: expect.any(String) }])
  })

  it('unknown error (SQL) → 500 without details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = catchErr(new Error('select * from "organization_members" where status = foo'))
    expect(err.statusCode).toBe(500)
    expect(JSON.stringify(err.data)).not.toContain('select')
    expect(err.message).not.toContain('select')
    spy.mockRestore()
  })

  it('domain error keeps mapped status', () => {
    expect(catchErr(new OrganizationNotFoundError(1)).statusCode).toBe(404)
  })

  it('http error passes through', () => {
    const h = Object.assign(new Error('x'), { statusCode: 403 })
    expect(catchErr(h).statusCode).toBe(403)
  })
})
