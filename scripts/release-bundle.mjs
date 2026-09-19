#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const SHA_PATTERN = /^[0-9a-f]{40}$/i

function usage() {
  process.stdout.write(
    'usage: release-bundle.mjs verify|advance --repo PATH --bundle FILE --expected SHA\n',
  )
}

function fail(message) {
  throw new Error(message)
}

function git(repo, args, options = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function parseArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    process.exit(0)
  }

  const command = argv[0]
  if (!['verify', 'advance'].includes(command)) fail('command must be verify or advance')

  const values = new Map()
  for (let index = 1; index < argv.length; index += 2) {
    const option = argv[index]
    const value = argv[index + 1]
    if (!['--repo', '--bundle', '--expected'].includes(option) || !value) {
      fail('required arguments: --repo PATH --bundle FILE --expected SHA')
    }
    values.set(option, value)
  }

  if (values.size !== 3) fail('required arguments: --repo PATH --bundle FILE --expected SHA')
  const expected = values.get('--expected').toLowerCase()
  if (!SHA_PATTERN.test(expected)) fail('expected SHA must be a full 40-character commit SHA')

  return {
    command,
    repo: resolve(values.get('--repo')),
    bundle: resolve(values.get('--bundle')),
    expected,
  }
}

function verifyBundle({ repo, bundle, expected }) {
  git(repo, ['bundle', 'verify', bundle])
  const advertised = git(repo, ['bundle', 'list-heads', bundle])
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/, 2))
    .find(([sha, ref]) => sha?.toLowerCase() === expected && ref)

  if (!advertised) fail('expected SHA is not advertised by bundle')
  return advertised[1]
}

function advanceBundle(input) {
  const advertisedRef = verifyBundle(input)
  const { repo, bundle, expected } = input

  if (git(repo, ['branch', '--show-current']) !== 'prod') {
    fail('production checkout must be on prod')
  }
  if (git(repo, ['status', '--porcelain', '--untracked-files=no'])) {
    fail('tracked checkout is not clean')
  }

  git(repo, ['fetch', '--no-tags', bundle, advertisedRef])
  if (git(repo, ['rev-parse', 'FETCH_HEAD']).toLowerCase() !== expected) {
    fail('fetched commit does not match expected SHA')
  }

  try {
    git(repo, ['merge-base', '--is-ancestor', 'HEAD', 'FETCH_HEAD'])
  } catch {
    fail('target is not a fast-forward')
  }

  git(repo, ['checkout', 'prod'])
  git(repo, ['merge', '--ff-only', 'FETCH_HEAD'])
}

try {
  const input = parseArguments(process.argv.slice(2))
  if (input.command === 'verify') {
    verifyBundle(input)
    process.stdout.write(`verified release bundle for ${input.expected}\n`)
  } else {
    advanceBundle(input)
    process.stdout.write(`advanced prod to ${input.expected}\n`)
  }
} catch (error) {
  const message =
    error instanceof Error && error.message ? error.message : 'release bundle command failed'
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
