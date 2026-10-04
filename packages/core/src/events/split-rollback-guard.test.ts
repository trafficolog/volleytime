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

describe('split rollback PostgreSQL transport contract', () => {
  afterAll(closeDb)
  it('binds the exact Actions PostgreSQL service identity to the test command', () => {
    const workflow = readFileSync(
      new URL('../../../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    )
    const runTests = workflow.split('      - name: Run tests\n')[1]!.split('\n  build:')[0]!
    expect(runTests).toContain('POSTGRES_TEST_CONTAINER_ID: ${{ job.services.postgres.id }}')
    expect(runTests).toContain('run: pnpm test')
  })

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
