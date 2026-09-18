import { db, sql } from '@volley-time/db'

/**
 * Health для мониторинга и smoke (Task 9.9.2): БД и схема better-auth.
 * 503, если что-то из этого недоступно — иначе деплой считался бы успешным при сломанном входе.
 */
export default defineEventHandler(async (event) => {
  const checks: Record<string, 'ok' | 'down'> = { db: 'down', auth: 'down' }
  try {
    await db.execute(sql`SELECT 1`)
    checks.db = 'ok'
    // таблицы better-auth должны существовать и быть доступны
    await db.execute(sql`SELECT 1 FROM verifications LIMIT 1`)
    await db.execute(sql`SELECT 1 FROM sessions LIMIT 1`)
    checks.auth = 'ok'
  } catch (e) {
    console.error('[health] check failed', e instanceof Error ? e.message : e)
  }
  const ok = Object.values(checks).every((v) => v === 'ok')
  if (!ok) setResponseStatus(event, 503)
  return {
    status: ok ? 'ok' : 'error',
    ...checks,
    release: process.env.RELEASE_VERSION ?? 'dev',
    ts: new Date().toISOString(),
  }
})
