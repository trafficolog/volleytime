/** Отслеживает сетевой статус (для offline-баннера). */
export function useOnline() {
  const isOnline = useState<boolean>('net.online', () => true)

  onMounted(() => {
    if (!import.meta.client) return
    isOnline.value = navigator.onLine
    const on = () => (isOnline.value = true)
    const off = () => (isOnline.value = false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    onUnmounted(() => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    })
  })

  return { isOnline }
}
