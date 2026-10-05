import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type * as childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { PassThrough } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof childProcess>()
  return { ...actual, spawn: vi.fn(actual.spawn), spawnSync: vi.fn(actual.spawnSync) }
})

import { splitRollbackFixture } from './split-rollback-shell-fixture'

describe('owned rollback subprocess lifecycle', () => {
  const failures = [
    { platform: 'win32', failure: 'nonzero', detail: 'taskkill exited with status 5' },
    { platform: 'win32', failure: 'error', detail: 'taskkill unavailable' },
    { platform: 'win32', failure: 'timeout', detail: 'taskkill ETIMEDOUT' },
    { platform: 'win32', failure: 'no-close', detail: 'child close unconfirmed' },
    { platform: 'linux', failure: 'error', detail: 'group permission denied' },
    { platform: 'linux', failure: 'no-close', detail: 'child close unconfirmed' },
  ] as const

  // Deterministic child-process boundary: no real process is spawned or killed.
  // Removing bounded failed termination makes these assertions see "still running".
  it.each(
    failures.flatMap((failure) => ['timeout', 'close'].map((cause) => ({ ...failure, cause }))),
  )(
    'bounds $platform $failure termination on $cause and retains unconfirmed ownership',
    async ({ platform, failure, detail, cause }) => {
      const child = Object.assign(new EventEmitter(), {
        pid: 987654,
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      }) as unknown as ChildProcessWithoutNullStreams
      vi.mocked(spawn).mockReturnValueOnce(child)
      const nativeProcess = process
      vi.stubGlobal(
        'process',
        new Proxy(nativeProcess, {
          get(target, property) {
            return property === 'platform' ? platform : Reflect.get(target, property)
          },
        }),
      )
      const kill = vi.spyOn(nativeProcess, 'kill').mockImplementation(() => {
        if (failure === 'error') throw new Error(detail)
        return true
      })
      vi.mocked(spawnSync).mockReturnValueOnce({
        pid: 123456,
        output: [],
        stdout: '',
        stderr: failure === 'nonzero' ? detail : '',
        signal: null,
        status: failure === 'nonzero' ? 5 : failure === 'no-close' ? 0 : null,
        ...(failure === 'error' || failure === 'timeout' ? { error: new Error(detail) } : {}),
      })
      const fixture = await splitRollbackFixture()
      const run = fixture.run(undefined, 20).then(
        () => 'returned',
        (error: unknown) => String(error),
      )
      const closing =
        cause === 'close' ? fixture.close().catch((error: unknown) => String(error)) : null
      const bounded = async (operation: Promise<unknown>) => {
        let timer!: ReturnType<typeof setTimeout>
        try {
          return await Promise.race([
            operation,
            new Promise<string>((resolve) => {
              timer = setTimeout(() => resolve('still running'), 1600)
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      try {
        const outcome = await bounded(run)
        expect(outcome).not.toBe('still running')
        expect(outcome).toContain(
          cause === 'close' ? 'Rollback fixture closed' : 'timed out after 20ms',
        )
        expect(outcome).toContain(detail)
        expect(outcome).toContain(`PID ${child.pid}`)
        expect(outcome).toContain(fixture.root)
        expect(
          await bounded(closing ?? fixture.close().catch((error: unknown) => String(error))),
        ).toBe(outcome)
        expect(existsSync(fixture.root)).toBe(true)
        // A repeated close cannot discard an unconfirmed child's ownership/root.
        expect(await bounded(fixture.close().catch((error: unknown) => String(error)))).toBe(
          outcome,
        )
        expect(existsSync(fixture.root)).toBe(true)
      } finally {
        child.emit('close', 0)
        await run
        await closing
        if (existsSync(fixture.root)) await fixture.close()
        kill.mockRestore()
        vi.unstubAllGlobals()
        vi.mocked(spawnSync).mockReset()
      }
      expect(existsSync(fixture.root)).toBe(false)
    },
  )

  it.each(['timeout', 'close'] as const)(
    'joins and stops a blocked owned shell tree on %s',
    async (cause) => {
      const fixture = await splitRollbackFixture()
      let entered!: () => void
      let release!: () => void
      const ready = new Promise<void>((resolve) => {
        entered = resolve
      })
      const blocked = new Promise<string>((resolve) => {
        release = () => resolve('')
      })
      fixture.hook = async () => {
        entered()
        return blocked
      }
      // The fixture budget is deliberately shorter than the test's budget.
      const run = fixture.run(undefined, 1000).then(
        () => 'returned',
        (error: unknown) => String(error),
      )
      try {
        await ready
        const result =
          cause === 'close'
            ? Promise.all([fixture.close(), run]).then(([, outcome]) => outcome)
            : run
        const outcome = await Promise.race([
          result,
          new Promise<string>((resolve) => setTimeout(() => resolve('still running'), 2000)),
        ])
        expect(outcome).toContain(cause === 'close' ? 'closed' : 'timed out')
      } finally {
        release()
        await run
        if (cause !== 'close') await fixture.close()
      }
    },
  )
})
