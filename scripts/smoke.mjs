#!/usr/bin/env node
/**
 * Smoke после деплоя (Task 9.9.2). Проверяет не только health, но и вход:
 *   1) /api/health (БД + схема better-auth)
 *   2) GET /api/auth/get-session → 200 (не 500)
 *   3) при SMOKE_BOT_TOKEN + SMOKE_TG_ID: вход по Telegram → авторизованный /api/organizations
 *   4) webhook-маршрут: неверный секрет → не 404 (значит Caddy доводит запрос до бота)
 *
 * Использование: BASE_URL=https://volleytime.by node scripts/smoke.mjs
 */
import { createHmac } from 'node:crypto'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const WEBHOOK_PATH = process.env.WEBHOOK_SECRET_PATH ?? ''
const EXPECTED_RELEASE = process.env.EXPECTED_RELEASE ?? ''
const failures = []

const check = (name, ok, details = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${details ? ` — ${details}` : ''}`)
  if (!ok) failures.push(name)
}

function signInitData(tgId, token) {
  const params = {
    user: JSON.stringify({ id: Number(tgId), first_name: 'Smoke', username: 'smoke_bot_user' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const sp = new URLSearchParams(params)
  sp.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'))
  return sp.toString()
}

const json = async (res) => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

// 1. health
const health = await fetch(`${BASE}/api/health`)
const healthBody = await json(health)
check(
  'health',
  health.status === 200 && healthBody?.status === 'ok',
  EXPECTED_RELEASE ? `HTTP ${health.status}` : JSON.stringify(healthBody),
)
if (EXPECTED_RELEASE) {
  const actualRelease = healthBody?.release ?? 'missing'
  check(
    'release identity',
    healthBody?.release === EXPECTED_RELEASE,
    `actual=${actualRelease} expected=${EXPECTED_RELEASE}`,
  )
}

// 2. сессия
const session = await fetch(`${BASE}/api/auth/get-session`)
check('auth/get-session', session.status === 200, `HTTP ${session.status}`)

// 3. авторизованный сценарий
if (process.env.SMOKE_BOT_TOKEN && process.env.SMOKE_TG_ID) {
  const signIn = await fetch(`${BASE}/api/auth/sign-in/telegram`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      initData: signInitData(process.env.SMOKE_TG_ID, process.env.SMOKE_BOT_TOKEN),
    }),
  })
  check('telegram sign-in', signIn.status === 200, `HTTP ${signIn.status}`)
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const orgs = await fetch(`${BASE}/api/organizations`, { headers: { cookie } })
  check('авторизованный /api/organizations', orgs.status === 200, `HTTP ${orgs.status}`)

  const forged = await fetch(`${BASE}/api/auth/sign-in/telegram`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ initData: signInitData(process.env.SMOKE_TG_ID, '') }),
  })
  check('подделка initData отвергнута', forged.status === 401, `HTTP ${forged.status}`)
} else {
  console.log('— SMOKE_BOT_TOKEN/SMOKE_TG_ID не заданы: авторизованный сценарий пропущен')
}

// 3b. уборка за smoke-аккаунтом: не оставляем живых сессий в боевой базе (Task 9.10.4)
if (process.env.SMOKE_BOT_TOKEN && process.env.SMOKE_TG_ID && process.env.BOT_INTERNAL_SECRET) {
  const cleanup = await fetch(`${BASE}/api/internal/smoke/cleanup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': process.env.BOT_INTERNAL_SECRET,
    },
    body: JSON.stringify({ telegramUserId: process.env.SMOKE_TG_ID }),
  })
  const body = await json(cleanup)
  check(
    'уборка smoke-аккаунта',
    cleanup.status === 200 && body?.cleaned === true,
    JSON.stringify(body),
  )
} else if (process.env.SMOKE_BOT_TOKEN) {
  console.log('— BOT_INTERNAL_SECRET не задан: сессии smoke-аккаунта останутся до истечения срока')
}

// 4. webhook доходит до бота (не 404 от Nuxt)
if (WEBHOOK_PATH) {
  const hook = await fetch(`${BASE}/tg/webhook/${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'wrong' },
    body: JSON.stringify({ update_id: 1 }),
  })
  check('webhook-маршрут', hook.status !== 404, `HTTP ${hook.status}`)
} else {
  console.log('— WEBHOOK_SECRET_PATH не задан: проверка webhook пропущена')
}

if (failures.length) {
  console.error(`\nSMOKE FAILED: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nSMOKE OK')
