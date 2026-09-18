import { DEFAULT_TIMEZONE } from '@volley-time/shared'

/** Часовой пояс организации (кешируется на сессию). Task 5.13.16. */
export function useOrgTimezone(orgId: Ref<number> | number) {
  const id = isRef(orgId) ? orgId : ref(orgId)
  const cache = useState<Record<number, string>>('org.timezones', () => ({}))
  const tz = computed(() => cache.value[id.value] ?? DEFAULT_TIMEZONE)

  async function load() {
    if (cache.value[id.value]) return
    try {
      const data = await $fetch<{ organization: { defaultTimezone: string } }>(
        `/api/organizations/${id.value}`,
      )
      cache.value = { ...cache.value, [id.value]: data.organization.defaultTimezone }
    } catch {
      // оставляем зону по умолчанию
    }
  }
  if (import.meta.client) void load()
  watch(id, () => void load())
  return { tz, load }
}
