import type { PlatformStaffMe } from '@volley-time/shared'

/**
 * Роль вошедшего в команду платформы и политики, которые она проходит (29.3.1, R-15): по ним
 * layout `root` строит меню, а «Настройки» — вкладки. Ключ общий, запрос один на все страницы Root
 * Admin. Скрытие разделов — только UX: доступ проверяет сервер на каждом запросе.
 */
export function usePlatformStaffMe() {
  return useFetch<PlatformStaffMe>('/api/platform/staff/me', {
    key: 'root-staff-me',
    lazy: true,
    server: false,
  })
}
