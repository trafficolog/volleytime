import { eq, organizations } from '@volley-time/db'

import { getDb, type ServiceContext } from './context'

export class CurrencyMismatchError extends Error {
  code = 'money.currency_mismatch'
  override name = 'CurrencyMismatchError'
  constructor(expected: string, got: string) {
    super(`Currency ${got} does not match organization currency ${expected}`)
  }
}

/** Валюта операции = валюте организации (Task 6.8.8). Расхождение → CurrencyMismatchError. */
export async function resolveOrgCurrency(
  ctx: ServiceContext,
  orgId: number,
  requested?: string,
): Promise<string> {
  const org = await getDb(ctx).query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { defaultCurrency: true },
  })
  const currency = org?.defaultCurrency ?? 'BYN'
  if (requested && requested.toUpperCase() !== currency) {
    throw new CurrencyMismatchError(currency, requested)
  }
  return currency
}
