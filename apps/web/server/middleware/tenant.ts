import { resolveTenant, TenantError } from '@volley-time/core'

import { parseOrgIdFromPath } from '../utils/tenant-path'

/** `GET /api/organizations/{id}/logo` — единственный публичный маршрут под `/api/organizations`. */
const PUBLIC_LOGO_PATH = /^\/api\/organizations\/[^/]+\/logo\/?$/
/**
 * Маршруты, открытые владельцу мягко удалённой группы (21.2.17): карточка группы (кабинет
 * показывает «Группа удалена, восстановление до …») и восстановление. Остальное — 410.
 */
const DELETED_OWNER_GET = /^\/api\/organizations\/\d+\/?$/
const DELETED_OWNER_POST = /^\/api\/organizations\/\d+\/restore\/?$/
const allowDeletedForOwner = (method: string, pathname: string) =>
  (method === 'GET' && DELETED_OWNER_GET.test(pathname)) ||
  (method === 'POST' && DELETED_OWNER_POST.test(pathname))

export default defineEventHandler(async (event) => {
  // pathname без query-string (Task 4.9.12)
  const pathname = getRequestURL(event).pathname
  // публичный логотип группы (21.2.16, решение владельца 2026-11-09): чтение без входа и членства
  if (event.method === 'GET' && PUBLIC_LOGO_PATH.test(pathname)) return
  const parsed = parseOrgIdFromPath(pathname)
  if (parsed.kind === 'none') return
  if (parsed.kind === 'invalid') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid orgId' })
  }

  const user = await requireAuth(event)
  try {
    const { organization, member } = await resolveTenant({ userId: user.id }, parsed.orgId, {
      allowDeletedForOwner: allowDeletedForOwner(event.method, pathname),
    })
    event.context.organization = organization
    event.context.member = member
    event.context.userId = user.id
  } catch (e) {
    if (e instanceof TenantError) {
      throw createError({
        statusCode: e.httpStatus,
        statusMessage: e.message,
        data: { code: e.code },
      })
    }
    throw e
  }
})
