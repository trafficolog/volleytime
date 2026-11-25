import type { PlatformPolicy } from '@volley-time/shared'

/**
 * Право вошедшего члена команды платформы на действие (29.3.1, R-15): кнопки изменений на
 * страницах `/root/**` показывают только тем, чья роль проходит политику. Опирается на
 * `usePlatformStaffMe()` (общий ключ `root-staff-me`, отдельного запроса нет). Пока роль грузится
 * и при ошибке `staff/me` ответ всегда «нет»: кнопка не мигает и не появляется без подтверждения
 * роли. Это только UX — доступ проверяет сервер на каждом запросе.
 */
export function usePlatformCan() {
  const { data, error } = usePlatformStaffMe()
  const can = (policy: PlatformPolicy): boolean =>
    !error.value && (data.value?.policies.includes(policy) ?? false)
  return { can }
}
