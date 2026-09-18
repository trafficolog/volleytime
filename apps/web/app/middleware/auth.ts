export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchSession } = useAuth()
  if (user.value === null) {
    await fetchSession()
  }
  if (user.value === null && to.path !== '/auth/login') {
    return navigateTo('/auth/login')
  }
})
