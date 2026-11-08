/**
 * Зарезервированные короткие ссылки (21.2.16): `volleytime.by/<имя>` не должна совпасть с
 * верхнеуровневым маршрутом приложения или служебным словом. Список сверяется с
 * `apps/web/app/pages` и `apps/web/public` тестом `short-link-reserved.test.ts` в apps/web: он
 * падает, если появился новый верхнеуровневый маршрут без записи здесь.
 */
export const RESERVED_SHORT_LINKS: readonly string[] = [
  // решение владельца 2026-11-08
  'app',
  'm',
  'api',
  'admin',
  'login',
  // верхнеуровневые страницы и статика приложения
  'auth',
  'dev',
  'e',
  'fonts',
  'logo',
  'health',
  'internal',
  // служебные и вероятные будущие маршруты
  'logout',
  'register',
  'signup',
  'signin',
  'invite',
  'invites',
  'join',
  'events',
  'event',
  'organizations',
  'orgs',
  'org',
  'group',
  'groups',
  'settings',
  'profile',
  'root',
  'help',
  'support',
  'about',
  'terms',
  'privacy',
  'static',
  'assets',
  'public',
  'www',
  'bot',
  'telegram',
  'status',
  'favicon',
  'robots',
  'sitemap',
  'volleytime',
  'null',
  'undefined',
]

const RESERVED = new Set(RESERVED_SHORT_LINKS)

export function isReservedShortLink(value: string): boolean {
  return RESERVED.has(value.toLowerCase())
}
