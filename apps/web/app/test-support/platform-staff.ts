import {
  PLATFORM_POLICIES,
  type PlatformPolicy,
  type PlatformRole,
  type PlatformStaffMe,
} from '@volley-time/shared'
import { vi } from 'vitest'
import { ref } from 'vue'

import { usePlatformCan } from '~/composables/usePlatformCan'

/** Что отвечает `GET /api/platform/staff/me`: роль, ещё не ответил (`pending`) или ошибка. */
export type StaffState = PlatformRole | 'pending' | 'error'

/** Ответ `staff/me` роли: политики берутся из `PLATFORM_POLICIES`, как на сервере. */
export function staffMe(role: PlatformRole): PlatformStaffMe {
  const policies = (Object.keys(PLATFORM_POLICIES) as PlatformPolicy[]).filter((policy) =>
    (PLATFORM_POLICIES[policy] as readonly PlatformRole[]).includes(role),
  )
  return { userId: 1, role, policies }
}

/**
 * Подменяет глобальные `usePlatformStaffMe` и `usePlatformCan` (авто-импорты Nuxt в тестах не
 * работают): страница видит заданную роль либо загрузку/ошибку `staff/me`.
 */
export function stubPlatformStaff(state: StaffState) {
  const data = ref<PlatformStaffMe | null>(
    state === 'pending' || state === 'error' ? null : staffMe(state),
  )
  vi.stubGlobal('usePlatformStaffMe', () => ({
    data,
    pending: ref(state === 'pending'),
    error: ref(state === 'error' ? new Error('staff/me') : null),
    refresh: vi.fn(),
  }))
  vi.stubGlobal('usePlatformCan', usePlatformCan)
}
