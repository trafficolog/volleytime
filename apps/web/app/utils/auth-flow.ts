import type { Ref } from 'vue'

import {
  resolveOrganizerEntry,
  safeAuthRedirect,
  type AuthOrg,
  type OrganizerEntry,
} from './auth-destination'

type SignInResult =
  | Exclude<OrganizerEntry, { kind: 'open' }>
  | { kind: 'navigate'; to: string }
  | { kind: 'invalid_code' }
  | { kind: 'load_error' }

type ContinuationInput = {
  session: () => Promise<boolean>
  fetchOrgs: () => Promise<readonly AuthOrg[]>
  redirect: unknown
}

export async function completeEmailSignIn(
  input: ContinuationInput & {
    verify: () => Promise<void>
  },
): Promise<SignInResult> {
  try {
    await input.verify()
  } catch {
    return { kind: 'invalid_code' }
  }
  return continueEmailSignIn(input)
}

export async function continueEmailSignIn(
  input: ContinuationInput,
): Promise<Exclude<SignInResult, { kind: 'invalid_code' }>> {
  try {
    if (!(await input.session())) return { kind: 'load_error' }
    const redirect = safeAuthRedirect(input.redirect)
    if (redirect) return { kind: 'navigate', to: redirect }
    const entry = resolveOrganizerEntry(await input.fetchOrgs())
    if (entry.kind === 'open') return { kind: 'navigate', to: `/m/orgs/${entry.org.id}` }
    return entry
  } catch {
    return { kind: 'load_error' }
  }
}

export async function switchEmailAccount<T extends string>(input: {
  step: Ref<T>
  emailStep: T
  email: Ref<string>
  code: Ref<string>
  error: Ref<string>
  signOut: () => Promise<void>
}): Promise<void> {
  try {
    await input.signOut()
    input.email.value = ''
    input.code.value = ''
    input.error.value = ''
    input.step.value = input.emailStep
  } catch {
    input.error.value = 'Не удалось выйти из аккаунта. Попробуйте снова.'
  }
}

export function botLink(username: string | undefined): string | null {
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? `https://t.me/${username}` : null
}
