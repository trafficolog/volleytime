/**
 * Тестовый HTTP-харнесс API без поднятия Nuxt (Task 4.9.15).
 * Роуты из server/api собираются в h3-router по файловым соглашениям Nitro,
 * auto-imports Nitro подставляются глобально, requireAuth — по заголовку `x-test-user`.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as h3 from 'h3'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (/\.(get|post|patch|put|delete)\.ts$/.test(e.name) && !e.name.includes('.test.'))
      out.push(p)
  }
  return out
}

function toRoute(file: string): {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete'
  route: string
} {
  const rel = path.relative(path.join(serverDir, 'api'), file)
  const m = rel.match(/^(.*?)(?:\/)?([^/]+)\.(get|post|patch|put|delete)\.ts$/)!
  const dirPart = m[1] ?? ''
  const name = m[2]!
  const segs = [...dirPart.split('/').filter(Boolean), ...(name === 'index' ? [] : [name])]
  const route = '/api/' + segs.map((s) => s.replace(/^\[(.+)\]$/, ':$1')).join('/')
  return { method: m[3] as never, route: route.replace(/\/$/, '') }
}

export interface TestResponse {
  status: number
  body: unknown
  text: string
}

export async function createTestApi() {
  process.env.TELEGRAM_BOT_USERNAME ||= 'volleytime_test_bot'
  const g = globalThis as Record<string, unknown>
  Object.assign(g, {
    defineEventHandler: h3.defineEventHandler,
    createError: h3.createError,
    readBody: h3.readBody,
    getRouterParam: h3.getRouterParam,
    getQuery: h3.getQuery,
    getRequestURL: h3.getRequestURL,
    getRequestHeader: h3.getRequestHeader,
    getRequestIP: h3.getRequestIP,
    getCookie: h3.getCookie,
    setResponseStatus: h3.setResponseStatus,
    useRuntimeConfig: () => ({ public: {} }),
  })
  for (const mod of [
    'handle-errors',
    'api-handler',
    'service-context',
    'notify',
    'config',
    'deeplink',
    'member-action',
    'tenant-path',
    'internal-auth',
  ]) {
    Object.assign(g, await import(pathToFileURL(path.join(serverDir, 'utils', `${mod}.ts`)).href))
  }
  g.requireAuth = async (event: h3.H3Event) => {
    const id = Number(h3.getRequestHeader(event, 'x-test-user'))
    if (!Number.isInteger(id) || id <= 0) throw h3.createError({ statusCode: 401 })
    return { id }
  }

  const app = h3.createApp()
  const tenant = await import(pathToFileURL(path.join(serverDir, 'middleware/tenant.ts')).href)
  app.use(tenant.default)
  const router = h3.createRouter()
  for (const file of await walk(path.join(serverDir, 'api'))) {
    if (file.includes(`${path.sep}auth${path.sep}`) || file.endsWith('health.get.ts')) continue
    const { method, route } = toRoute(file)
    const handler = (await import(pathToFileURL(file).href)).default
    router[method](route, handler)
  }
  app.use(router)
  const web = h3.toWebHandler(app)

  return async function request(
    method: string,
    url: string,
    opts: { user?: number; body?: unknown } = {},
  ): Promise<TestResponse> {
    const res = await web(
      new Request(`http://test${url}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(opts.user ? { 'x-test-user': String(opts.user) } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    )
    const text = await res.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { status: res.status, body, text }
  }
}
