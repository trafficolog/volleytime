export type MiniEntryResult =
  { kind: 'navigate'; to: string } | { kind: 'telegram_error' | 'browser_error' }

export async function enterMiniApp(input: {
  isTelegram: boolean
  authenticate: () => Promise<unknown>
  fetchSession: () => Promise<boolean>
  targetRoute: () => Promise<string>
}): Promise<MiniEntryResult> {
  try {
    if (input.isTelegram) await input.authenticate()
    else if (!(await input.fetchSession())) {
      return { kind: 'navigate', to: '/auth/login?redirect=/m/' }
    }
    return { kind: 'navigate', to: await input.targetRoute() }
  } catch {
    return { kind: input.isTelegram ? 'telegram_error' : 'browser_error' }
  }
}
