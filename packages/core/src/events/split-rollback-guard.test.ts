import { readFileSync } from 'node:fs'

import { closeDb } from '@volley-time/db'
import { afterAll, describe, expect, it } from 'vitest'

import {
  postgresTestConfig,
  postgresTestTransport,
  validatePostgresTestContainer,
  validatePostgresTestIdentity,
} from '../__tests__/split-rollback-postgres-transport'

const id = 'a'.repeat(64)
const environment = {
  POSTGRES_TEST_CONTAINER_ID: id,
  DATABASE_URL: 'postgresql://postgres:test@localhost:5432/volleytime_test',
  DATABASE_URL_TEST: 'postgresql://postgres:test@127.0.0.1:5432/volleytime_test',
}
const inspected = () => [
  {
    Id: id,
    Config: { Image: 'postgres:16-alpine' },
    State: { Running: true },
    NetworkSettings: { Ports: { '5432/tcp': [{ HostPort: '5432', HostIp: '0.0.0.0' }] } },
  },
]

// Read only the test job's environment and the actual pnpm test step. An env
// attached to a migration/lint step or another job cannot reach this consumer.
function workflowTestEnvironment(workflow: string): NodeJS.ProcessEnv {
  const job = workflow
    .replace(/\r\n/g, '\n')
    .match(/^ {2}test:\n([\s\S]*?)(?=^ {2}[\w-]+:|$(?![\s\S]))/m)?.[1]
  if (!job) throw new Error('Missing test job')
  const steps = job.split('    steps:\n')[1]?.split(/(?=^ {6}- )/m) ?? []
  const testSteps = steps.filter((step) => /^(?: {6}- | {8})run: pnpm test\s*$/m.test(step))
  if (testSteps.length !== 1) throw new Error('Expected one pnpm test step')
  const result: NodeJS.ProcessEnv = {}
  for (const [block, indent] of [
    [job.split('    steps:\n')[0]!, 4],
    [testSteps[0]!, 8],
  ] as const) {
    const env =
      block.match(
        new RegExp(`^${' '.repeat(indent)}env:\\n((?:${' '.repeat(indent + 2)}[^\\n]*\\n?)*)`, 'm'),
      )?.[1] ?? ''
    for (const line of env.trim().split('\n')) {
      const entry = line.trim().match(/^([A-Z_]+): (.+)$/)
      if (!entry) continue
      const [, key, value] = entry
      result[key!] = value === '${{ job.services.postgres.id }}' ? id : value
    }
  }
  return result
}

describe('split rollback PostgreSQL transport contract', () => {
  afterAll(closeDb)
  it.each(['ci', 'deploy'])(
    '%s passes its test-step service identity to postgresTestConfig',
    (name) => {
      const workflow = readFileSync(
        new URL(`../../../../.github/workflows/${name}.yml`, import.meta.url),
        'utf8',
      )
      expect(postgresTestConfig(workflowTestEnvironment(workflow))).toEqual({
        containerId: id,
        port: '5432',
      })
    },
  )

  it.each(['another step', 'another job'])(
    'rejects service identity attached to %s',
    (location) => {
      const workflow = readFileSync(
        new URL('../../../../.github/workflows/ci.yml', import.meta.url),
        'utf8',
      ).replace('          POSTGRES_TEST_CONTAINER_ID: ${{ job.services.postgres.id }}', '')
      const misplaced =
        location === 'another step'
          ? workflow.replace(
              '        run: pnpm -F @volley-time/db db:migrate',
              '        run: pnpm -F @volley-time/db db:migrate\n        env:\n          POSTGRES_TEST_CONTAINER_ID: ${{ job.services.postgres.id }}',
            )
          : workflow.replace(
              '  build:\n',
              '  build:\n    env:\n      POSTGRES_TEST_CONTAINER_ID: ${{ job.services.postgres.id }}\n',
            )
      expect(() => postgresTestConfig(workflowTestEnvironment(misplaced))).toThrow(
        'identity is unproven',
      )
    },
  )

  it('never discovers the transport using a developer container name', () => {
    const races = readFileSync(
      new URL('./split-rollback-races.integration.test.ts', import.meta.url),
      'utf8',
    )
    expect(races).not.toContain("'volleytime_postgres'")
  })

  it.each([undefined, '', 'postgres', id.slice(0, 12), 'A'.repeat(64)])(
    'rejects missing/non-exact configured container identity: %s',
    (containerId) => {
      expect(() =>
        postgresTestConfig({ ...environment, POSTGRES_TEST_CONTAINER_ID: containerId }),
      ).toThrow('identity is unproven')
    },
  )
  it.each([
    'postgresql://postgres:test@localhost:5432/volleytime_dev',
    'postgresql://volley:test@localhost:5432/volleytime_test',
    'postgresql://postgres:test@other:5432/volleytime_test',
    'postgresql://postgres:test@localhost:5433/volleytime_test',
    'postgresql://postgres:test@localhost:5432/volleytime_test?host=other',
  ])('rejects unsafe/mismatching endpoint: %s', (endpoint) => {
    expect(() => postgresTestConfig({ ...environment, DATABASE_URL_TEST: endpoint })).toThrow(
      'identity is unproven',
    )
  })
  it.each(['id', 'image', 'running', 'port'] as const)(
    'rejects wrong actual container %s',
    (property) => {
      const value = inspected()
      if (property === 'id') value[0]!.Id = 'b'.repeat(64)
      if (property === 'image') value[0]!.Config.Image = 'postgres:15-alpine'
      if (property === 'running') value[0]!.State.Running = false
      if (property === 'port') value[0]!.NetworkSettings.Ports['5432/tcp'][0]!.HostPort = '5433'
      expect(() => validatePostgresTestContainer(postgresTestConfig(environment), value)).toThrow(
        'identity is unproven',
      )
    },
  )
  it('accepts exact full identity independent of a developer/service container name', () => {
    expect(() =>
      validatePostgresTestContainer(postgresTestConfig(environment), inspected()),
    ).not.toThrow()
  })
  it.each([
    'volleytime_test|postgres|456',
    'volleytime_dev|postgres|123',
    'volleytime_test|volley|123',
  ])('rejects a different PostgreSQL cluster/database/user: %s', (transport) => {
    expect(() => validatePostgresTestIdentity('volleytime_test|postgres|123', transport)).toThrow(
      'identity is unproven',
    )
  })
  it('proves the configured local endpoint matches the explicitly authorized existing test transport', async () => {
    const transport = await postgresTestTransport()
    expect(transport.containerId).toBe(process.env.POSTGRES_TEST_CONTAINER_ID)
    expect(transport.query('SELECT current_database();')).toBe('volleytime_test')
  })
})
