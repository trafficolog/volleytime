#!/usr/bin/env node
import { chmodSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const REQUIRED = [
  'DOMAIN',
  'DB_PASSWORD',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'WEBHOOK_SECRET_PATH',
  'WEBHOOK_SECRET_TOKEN',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'BOT_INTERNAL_SECRET',
  'WEB_URL',
]

const OPTIONAL = [
  'SENTRY_DSN_WEB',
  'SENTRY_DSN_BOT',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'SMOKE_TG_ID',
  'BACKUP_AGE_RECIPIENT',
  'HEALTHCHECK_URL',
]

const DEFAULTS = {
  BOT_MODE: 'polling',
  EMAIL_DRIVER: 'console',
  TRUSTED_PROXY: '1',
  AUTH_RATE_LIMIT: '20',
  AUTH_RATE_WINDOW_MS: '60000',
  RETENTION_DAYS: '21',
}

function valueOf(key) {
  return typeof process.env[key] === 'string' ? process.env[key] : ''
}

function quote(value) {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}"`
}

const missing = REQUIRED.filter((key) => valueOf(key).trim() === '')
if (missing.length) {
  console.error(`[prod-env] missing required keys: ${missing.join(', ')}`)
  process.exit(1)
}

const botMode = valueOf('BOT_MODE').trim() || DEFAULTS.BOT_MODE
if (!['polling', 'webhook'].includes(botMode)) {
  console.error('[prod-env] BOT_MODE must be polling or webhook')
  process.exit(1)
}

const values = new Map()
for (const key of REQUIRED) values.set(key, valueOf(key))
for (const [key, fallback] of Object.entries(DEFAULTS)) {
  values.set(key, valueOf(key).trim() === '' ? fallback : valueOf(key))
}
for (const key of OPTIONAL) values.set(key, valueOf(key))

const output = resolve(process.argv[2] ?? '.env.production')
const body = [...values].map(([key, value]) => `${key}=${quote(value)}`).join('\n') + '\n'

writeFileSync(output, body, { encoding: 'utf8', mode: 0o600 })
chmodSync(output, 0o600)
console.log(`[prod-env] wrote ${values.size} keys to ${basename(output)}`)
