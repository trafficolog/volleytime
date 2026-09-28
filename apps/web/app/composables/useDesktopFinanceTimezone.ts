import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** Confirmed metadata only; monetary dates must never inherit a fallback zone. */
export function useDesktopFinanceTimezone(orgId: Ref<number>, onError?: (error: unknown) => void) {
  const route = useRoute()
  const request = useRequestFetch()
  const timezone = ref<string | null>(null)
  const loading = ref(true)
  const error = ref('')
  let active = true
  let token = 0

  function reset() {
    token++
    timezone.value = null
    loading.value = true
    error.value = ''
  }
  async function load() {
    const org = orgId.value,
      path = route.path,
      current = ++token
    const live = () => active && current === token && orgId.value === org && route.path === path
    timezone.value = null
    loading.value = true
    error.value = ''
    try {
      const result = await request<{ organization: { defaultTimezone: string } }>(
        `/api/organizations/${org}`,
      )
      const zone = result.organization.defaultTimezone
      if (!zone) throw new Error('Missing organization timezone')
      new Intl.DateTimeFormat('ru-RU', { timeZone: zone }).format(new Date())
      if (live()) timezone.value = zone
    } catch (failure) {
      if (live()) {
        onError?.(failure)
        error.value = 'Не удалось загрузить часовой пояс группы. Повторите попытку.'
      }
    } finally {
      if (live()) loading.value = false
    }
  }
  watch(() => [orgId.value, route.path], reset, { flush: 'sync' })
  onScopeDispose(() => {
    active = false
    reset()
  })
  return { timezone, loading, error, load }
}
