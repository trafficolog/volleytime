import { vi } from 'vitest'
import { ref } from 'vue'

import type { GroupSettings } from '~/utils/group-settings'
import { createSettingsController, type OrgProfile } from '~/utils/group-settings-controller'

/** Общие данные и контроллер для интеракционных тестов разделов настроек. */
export const baseSettings: GroupSettings = {
  subscriptionsEnabled: true,
  maxSeatsPerBooking: 3,
  defaultPriceMode: 'fixed',
  defaultJoinMode: 'open',
  cancellationAllowed: true,
  cancellationDeadlineHours: 6,
  seoIndex: false,
  city: 'Минск',
  district: null,
  levels: ['v2'],
}
export const baseOrg: OrgProfile = {
  name: 'VolleyTime Минск',
  description: 'Любительская группа',
  defaultMemberStatus: 'active',
}

export function makeController(request = vi.fn()) {
  const settings = ref<GroupSettings>({ ...baseSettings })
  const org = ref<OrgProfile>({ ...baseOrg })
  const toast = vi.fn()
  const controller = createSettingsController({
    orgId: 7,
    request: request as never,
    settings,
    org,
    toast,
    errorMessage: (cause, fallback) => (cause as Error).message || fallback,
    isCurrent: () => true,
  })
  return { controller, settings, org, toast, request }
}

export const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
}
