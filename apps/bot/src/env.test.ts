import { describe, expect, it } from 'vitest'

import { secretsMatch } from './env'

describe('secretsMatch (8.8.2)', () => {
  it('accepts equal secrets only', () => {
    expect(secretsMatch('s3cret', 's3cret')).toBe(true)
    expect(secretsMatch('s3cret', 's3crex')).toBe(false)
    expect(secretsMatch('s3cret', 'short')).toBe(false)
    expect(secretsMatch('s3cret', undefined)).toBe(false)
    expect(secretsMatch('s3cret', '')).toBe(false)
  })
})
