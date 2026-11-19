/**
 * Вход в `/root/**` (22.1.1): без сессии — на экран входа. Роль root клиент не знает (сессия не
 * несёт `isRootAdmin`): 403 для вошедшего не-root отдают сервер (`server/middleware/root-pages.ts`
 * для страниц, `requireRootAdmin` для `/api/platform/**`), страница показывает ошибку 403.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchSession } = useAuth()
  if (user.value === null) {
    await fetchSession()
  }
  if (user.value === null) return navigateTo('/auth/login')
})
