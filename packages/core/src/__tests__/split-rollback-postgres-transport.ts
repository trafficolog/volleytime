import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

import { db, sql } from '@volley-time/db'

const require = createRequire(import.meta.url)
export const postgresTestClient = require(
  require.resolve('postgres', { paths: [require.resolve('@volley-time/db')] }),
) as (url: string, options: Record<string, unknown>) => typeof db.$client

const identityQuery =
  "SELECT current_database() || '|' || current_user || '|' || system_identifier::text AS identity FROM pg_control_system();"
const expectedIdentity = /^volleytime_test\|postgres\|[0-9]+$/
const fail = (): never => {
  throw new Error('Split rollback test PostgreSQL transport identity is unproven')
}

export function postgresTestConfig(environment: NodeJS.ProcessEnv = process.env) {
  const containerId = environment.POSTGRES_TEST_CONTAINER_ID
  if (!containerId || !/^[0-9a-f]{64}$/.test(containerId)) fail()
  const endpoints = [environment.DATABASE_URL, environment.DATABASE_URL_TEST].map((raw) => {
    if (!raw) return fail()
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return fail()
    }
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username !== 'postgres' ||
      url.pathname !== '/volleytime_test' ||
      url.search ||
      url.hash
    )
      fail()
    return { port: url.port || '5432', password: url.password }
  })
  if (
    endpoints[0]!.port !== endpoints[1]!.port ||
    endpoints[0]!.password !== endpoints[1]!.password
  )
    fail()
  return { containerId: containerId!, port: endpoints[0]!.port }
}

export function validatePostgresTestContainer(
  config: ReturnType<typeof postgresTestConfig>,
  value: unknown,
) {
  const inspected = value as Array<{
    Id: string
    Config: { Image: string }
    State: { Running: boolean }
    NetworkSettings: { Ports: Record<string, Array<{ HostPort: string; HostIp: string }> | null> }
  }>
  try {
    if (inspected.length !== 1) fail()
    const container = inspected[0]!
    if (
      container.Id !== config.containerId ||
      container.Config.Image !== 'postgres:16-alpine' ||
      container.State.Running !== true ||
      !container.NetworkSettings.Ports['5432/tcp']?.some(
        (port) =>
          port.HostPort === config.port &&
          ['', '0.0.0.0', '127.0.0.1', '::', '::1'].includes(port.HostIp),
      )
    )
      fail()
  } catch {
    fail()
  }
}

export function validatePostgresTestIdentity(endpoint: string, transport: string) {
  if (!expectedIdentity.test(endpoint) || endpoint !== transport) fail()
}

// Read-only verification before creating any race fixture/session. No discovery,
// developer name fallback, skip, database reset or shared-pool termination.
export async function postgresTestTransport() {
  const config = postgresTestConfig()
  const inspected = spawnSync('docker', ['inspect', config.containerId], {
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  })
  if (inspected.status !== 0) fail()
  try {
    validatePostgresTestContainer(config, JSON.parse(inspected.stdout))
  } catch {
    fail()
  }
  const psqlArgs = [
    'exec',
    '-i',
    config.containerId,
    'psql',
    '-X',
    '-U',
    'postgres',
    '-d',
    'volleytime_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
  ]
  const query = (statement: string) => {
    const result = spawnSync('docker', [...psqlArgs, '-c', statement], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    })
    if (result.status !== 0) fail()
    return result.stdout.trim()
  }
  const actual = query(identityQuery)
  const testEndpoint = postgresTestClient(process.env.DATABASE_URL_TEST!, { max: 1 })
  try {
    const endpoint = await db.execute<{ identity: string }>(sql.raw(identityQuery))
    const testIdentity = await testEndpoint.unsafe<{ identity: string }[]>(identityQuery)
    if (endpoint.length !== 1 || testIdentity.length !== 1) fail()
    validatePostgresTestIdentity(endpoint[0]!.identity, actual)
    validatePostgresTestIdentity(testIdentity[0]!.identity, actual)
  } catch {
    fail()
  } finally {
    await testEndpoint.end({ timeout: 0 })
  }
  return { containerId: config.containerId, psqlArgs, query }
}
