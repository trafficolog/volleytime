#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REQUEST_TIMEOUT_MS = 15_000

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
}

export async function verifyTelegramBotIdentity({ token, expectedUsername, fetchImpl = fetch }) {
  const normalizedExpected = normalizeUsername(expectedUsername)
  if (!String(token ?? '').trim() || !normalizedExpected) {
    throw new Error('Telegram bot token and username are required')
  }

  let response
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${token}/getMe`, {
      signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new Error('Telegram getMe request failed')
  }

  if (!response.ok) {
    throw new Error(`Telegram getMe returned HTTP ${response.status}`)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('Telegram getMe returned an invalid response')
  }

  const actualUsername =
    typeof payload?.result?.username === 'string' ? payload.result.username : ''
  if (payload?.ok !== true || !normalizeUsername(actualUsername)) {
    throw new Error('Telegram getMe returned an invalid bot identity')
  }
  if (normalizeUsername(actualUsername) !== normalizedExpected) {
    throw new Error('configured username does not match token-owned bot')
  }

  return actualUsername.replace(/^@/, '')
}

async function main() {
  try {
    const username = await verifyTelegramBotIdentity({
      token: process.env.TELEGRAM_BOT_TOKEN,
      expectedUsername: process.env.TELEGRAM_BOT_USERNAME,
    })
    console.log(`[telegram-identity] verified @${username}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram identity verification failed'
    console.error(`[telegram-identity] ${message}`)
    process.exitCode = 1
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await main()
