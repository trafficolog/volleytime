import type { User } from '@volley-time/db'

export function useAuth() {
  const user = useState<User | null>('auth.user', () => null)
  const loading = useState<boolean>('auth.loading', () => false)

  const isLoggedIn = computed(() => user.value !== null)

  async function fetchSession() {
    loading.value = true
    try {
      // из ответа берём только пользователя: объект session с токеном никуда не кладём
      // и не логируем (Task 3.10.2) — cookie httpOnly и подписана, токен клиенту не нужен
      const data = await $fetch<{ user: User | null }>('/api/auth/get-session')
      user.value = data?.user ?? null
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/sign-out', { method: 'POST' })
    user.value = null
    await navigateTo('/auth/login')
  }

  return { user, loading, isLoggedIn, fetchSession, logout }
}
