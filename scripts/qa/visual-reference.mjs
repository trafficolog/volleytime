#!/usr/bin/env node
/* global document, Image, window */
/**
 * Харнесс визуальной сверки с референсом v3 (Task 19.0.2). Локальный инструмент, не CI-gate.
 *
 * Снимает экраны из карты scripts/qa/visual-reference-map.json (Mini App 390x820, кабинет 1440x900,
 * светлая и тёмная тема) у запущенного локально приложения с демо-сидом и кладёт рядом со
 * снимками референса в HTML/MD отчёт: output/visual/<run>/report.{html,md}.
 *
 * Вход: тестовые Telegram initData, подписанные ТЕСТОВЫМ токеном бота (тот же должен быть у
 * сервера: TELEGRAM_BOT_TOKEN). Демо-пользователю в локальной БД выставляется telegram_user_id.
 * Реальные учётные данные не используются; нелокальные адреса отклоняются.
 *
 * Пример: TELEGRAM_BOT_TOKEN=111111:visual-harness DATABASE_URL=postgresql://... \
 *   pnpm qa:visual -- --routes player-home,cabinet-overview --themes light --diff
 */
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  THEMES,
  assertLocalHosts,
  assertLocalUrl,
  inviteFixturePlan,
  pickEvent,
  renderHtml,
  renderMarkdown,
  resolvePath,
  selectScreens,
  validateMap,
} from './visual-reference-lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const requireFromRoot = createRequire(join(root, 'package.json'))
const requireFromDb = createRequire(join(root, 'packages', 'db', 'package.json'))
const DEMO_EMAIL_DOMAIN = 'demo.volleytime.local'

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    base: { type: 'string', default: process.env.VISUAL_BASE_URL ?? 'http://localhost:3000' },
    routes: { type: 'string' },
    viewport: { type: 'string' },
    themes: { type: 'string', default: 'light,dark' },
    map: { type: 'string', default: join(root, 'scripts/qa/visual-reference-map.json') },
    out: { type: 'string', default: join(root, 'output/visual') },
    diff: { type: 'boolean', default: false },
    channel: { type: 'string', default: process.env.VISUAL_BROWSER_CHANNEL ?? 'chrome' },
    'browser-path': { type: 'string', default: process.env.VISUAL_BROWSER_PATH },
    list: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: false,
})

if (args.help) {
  console.log(`Usage: pnpm qa:visual -- [--routes id,id] [--viewport miniapp|cabinet] [--themes light,dark]
                         [--diff] [--base http://localhost:3000] [--out output/visual] [--list]
Env: TELEGRAM_BOT_TOKEN (test token, same as the server's), DATABASE_URL (local demo DB),
     VISUAL_BROWSER_PATH / VISUAL_BROWSER_CHANNEL (default channel: chrome).`)
  process.exit(0)
}

const map = JSON.parse(readFileSync(args.map, 'utf8'))
const mapErrors = validateMap(map)
if (mapErrors.length) {
  console.error(`Карта экранов некорректна:\n - ${mapErrors.join('\n - ')}`)
  process.exit(1)
}
const themes = args.themes.split(',').map((t) => t.trim())
if (themes.some((t) => !THEMES.includes(t))) {
  console.error(`--themes: допустимы ${THEMES.join(', ')}`)
  process.exit(1)
}
const screens = selectScreens(map, {
  routes: args.routes?.split(',').map((s) => s.trim()),
  viewport: args.viewport,
})
if (args.list) {
  for (const s of map.screens) console.log(`${s.id}\t${s.viewport}\t${s.role}\t${s.path}`)
  process.exit(0)
}
if (screens.length === 0) {
  console.error('Нет экранов для съёмки по заданным фильтрам')
  process.exit(1)
}

const base = args.base.replace(/\/+$/, '')
const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
const databaseUrl = process.env.DATABASE_URL ?? ''
const needsAuth = screens.some((s) => s.role !== 'anonymous')
// публичные события (20.6.1) выбираются по названию в БД: нужна локальная БД, вход не нужен
// состояния M-08 (inviteState) готовятся прямо в локальной БД
const needsDb = needsAuth || screens.some((s) => s.publicEvent || s.inviteState)
if (process.env.NODE_ENV === 'production') {
  console.error('Харнесс не запускается при NODE_ENV=production')
  process.exit(1)
}
try {
  assertLocalUrl(base, '--base')
  if (needsAuth && !botToken)
    throw new Error('Задайте TELEGRAM_BOT_TOKEN (тестовый токен, тот же, что у сервера)')
  if (needsDb) {
    if (!databaseUrl) throw new Error('Задайте DATABASE_URL локальной БД с демо-сидом')
    assertLocalUrl(databaseUrl, 'DATABASE_URL')
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Некорректные параметры')
  process.exit(1)
}

function signInitData(tgId, name) {
  const params = {
    user: JSON.stringify({ id: tgId, first_name: name, username: `visual_${tgId}` }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  params.hash = createHmac('sha256', secret).update(dcs).digest('hex')
  return new URLSearchParams(params).toString()
}

/** Привязывает тестовый Telegram id к демо-пользователю локальной БД, возвращает id. */
async function ensureTelegramId(sql, key, index) {
  const email = `demo-${key}@${DEMO_EMAIL_DOMAIN}`
  const [current] = await sql`select telegram_user_id from users where email = ${email}`
  if (current && current.telegram_user_id === null) {
    // свободный тестовый id: fixed id мог быть занят другим пользователем
    let wanted = 7_000_000_000 + index
    for (let i = 0; i < 100; i++, wanted += 10) {
      const taken = await sql`select 1 from users where telegram_user_id = ${wanted}`
      if (taken.length === 0) break
      if (i === 99) throw new Error('Не найден свободный тестовый telegram id (7_000_000_000+)')
    }
    await sql`update users set telegram_user_id = ${wanted} where email = ${email} and telegram_user_id is null`
  }
  const [row] = await sql`select telegram_user_id, name from users where email = ${email}`
  if (!row) throw new Error(`Демо-пользователь ${email} не найден: выполните pnpm db:seed:demo`)
  return { tgId: Number(row.telegram_user_id), name: row.name ?? key }
}

/**
 * Состояние записи по приглашению (M-08, 20.4.7): событие переводится в `invite`, у игрока
 * остаётся только запрос и приглашение из плана состояния. Только локальная БД с демо-сидом.
 */
async function applyInviteFixture(sql, { orgId, eventId, userKey, state }) {
  const [user] =
    await sql`select id from users where email = ${`demo-${userKey}@${DEMO_EMAIL_DOMAIN}`}`
  const [ev] = await sql`
    select id, starts_at, created_by_user_id from events
    where id = ${eventId} and organization_id = ${orgId}`
  if (!user || !ev) throw new Error('Фикстура приглашения: игрок или событие не найдены')
  const plan = inviteFixturePlan(state, { now: new Date(), startsAt: ev.starts_at })
  await sql`update events set join_mode = 'invite' where id = ${ev.id}`
  await sql`delete from event_invite_requests where event_id = ${ev.id} and user_id = ${user.id}`
  await sql`delete from invite_links where event_id = ${ev.id} and type = 'event_join'`
  let inviteId = null
  let token = null
  if (plan.inviteExpiresAt) {
    token = `visual${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`
    ;[{ id: inviteId }] = await sql`
      insert into invite_links
        (token, organization_id, event_id, type, created_by_user_id, default_member_status,
         max_uses, expires_at)
      values (${token}, ${orgId}, ${ev.id}, 'event_join', ${ev.created_by_user_id}, 'pending',
         1, ${plan.inviteExpiresAt})
      returning id`
  }
  if (plan.request) {
    await sql`
      insert into event_invite_requests
        (organization_id, event_id, user_id, status, decided_by_user_id, decided_at, invite_id)
      values (${orgId}, ${ev.id}, ${user.id}, ${plan.request},
        ${plan.request === 'approved' ? ev.created_by_user_id : null},
        ${plan.request === 'approved' ? new Date() : null}, ${inviteId})`
  }
  // по личной ссылке: токен приходит из startapp и ждёт экран события в хранилище сессии
  return plan.link ? token : null
}

async function login(context, tg) {
  const res = await context.request.post(`${base}/api/auth/sign-in/telegram`, {
    data: { initData: signInitData(tg.tgId, tg.name) },
    headers: { origin: base },
  })
  if (!res.ok())
    throw new Error(
      `Вход не удался (${res.status()}): проверьте, что TELEGRAM_BOT_TOKEN совпадает с серверным`,
    )
}

async function api(context, path) {
  const res = await context.request.get(`${base}${path}`)
  if (!res.ok()) throw new Error(`GET ${path} → ${res.status()}`)
  return res.json()
}

/** Грубый pixel-diff: оба изображения (референс — после crop) сжимаются до ширины 400 px. */
async function pixelDiff(page, captureB64, referenceB64, crop) {
  return page.evaluate(
    async ({ captureB64, referenceB64, crop }) => {
      const load = (b64) =>
        new Promise((ok, fail) => {
          const img = new Image()
          img.onload = () => ok(img)
          img.onerror = fail
          img.src = `data:image/png;base64,${b64}`
        })
      const [a, b] = await Promise.all([load(captureB64), load(referenceB64)])
      const w = 400
      const h = Math.round((a.height / a.width) * w)
      const draw = (img, c) => {
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        if (c) ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, w, h)
        else ctx.drawImage(img, 0, 0, w, h)
        return { cv, data: ctx.getImageData(0, 0, w, h).data }
      }
      const A = draw(a)
      const B = draw(b, crop)
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const octx = out.getContext('2d')
      const od = octx.createImageData(w, h)
      let diff = 0
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.max(
          Math.abs(A.data[i] - B.data[i]),
          Math.abs(A.data[i + 1] - B.data[i + 1]),
          Math.abs(A.data[i + 2] - B.data[i + 2]),
        )
        const bad = d > 32
        if (bad) diff++
        od.data[i] = bad ? 255 : B.data[i]
        od.data[i + 1] = bad ? 0 : B.data[i + 1]
        od.data[i + 2] = bad ? 80 : B.data[i + 2]
        od.data[i + 3] = bad ? 255 : 110
      }
      octx.putImageData(od, 0, 0)
      return {
        percent: (diff / (w * h)) * 100,
        png: out.toDataURL('image/png').split(',')[1],
      }
    },
    { captureB64, referenceB64, crop },
  )
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim()
  } catch {
    return null
  }
}

const { chromium } = requireFromRoot('playwright-core')
const postgres = needsDb ? requireFromDb('postgres') : null

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
const runDir = join(args.out, stamp)
for (const d of ['captures', 'refs', 'diffs']) mkdirSync(join(runDir, d), { recursive: true })

const sql = needsDb ? postgres(databaseUrl, { max: 1 }) : null
// страховка: фактические хосты клиента БД (postgres.js разбирает URL иначе, чем WHATWG URL)
if (sql) assertLocalHosts(sql.options.host, 'DATABASE_URL')
const browser = await chromium.launch({
  headless: true,
  ...(args['browser-path'] ? { executablePath: args['browser-path'] } : { channel: args.channel }),
})
const results = []
let exitCode = 0

try {
  const roles = [...new Set(screens.map((s) => s.role))]
  const roleKeys = ['player', 'organizer', 'owner']
  for (const theme of themes) {
    for (const role of roles) {
      const roleScreens = screens.filter((s) => s.role === role)
      const vpName = (s) => map.viewports[s.viewport]
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        locale: 'ru-RU',
        timezoneId: 'Europe/Minsk',
      })
      await context.addInitScript((t) => {
        const apply = () => document.documentElement.classList.toggle('dark', t === 'dark')
        apply()
        document.addEventListener('DOMContentLoaded', apply)
      }, theme)
      // Шрифты/скрипты с внешних CDN (telegram.org) в harness не нужны и могут висеть офлайн
      await context.route(/telegram\.org\//, (r) => r.abort())
      let orgs = []
      if (role !== 'anonymous') {
        const key = map.users[role]
        const tg = await ensureTelegramId(sql, key, roleKeys.indexOf(role) + 1)
        await login(context, tg)
        orgs = (await api(context, '/api/organizations')).organizations
      }
      for (const screen of roleScreens) {
        const viewport = vpName(screen)
        const result = {
          id: screen.id,
          title: screen.title,
          theme,
          role,
          viewportSize: `${viewport.width}x${viewport.height}`,
          url: screen.path,
          references: [],
        }
        results.push(result)
        screen.references.forEach((ref, i) => {
          const name = `${ref.replaceAll('/', '__')}`
          copyFileSync(
            join(root, 'docs/design/reference-v3/screenshots', ref),
            join(runDir, 'refs', name),
          )
          result.references[i] = `refs/${name}`
        })
        const page = await context.newPage()
        try {
          await page.setViewportSize(viewport)
          let orgId
          let eventId
          if (screen.org) {
            const org = orgs.find((o) => o.name === map.orgs[screen.org])
            if (!org) throw new Error(`Группа «${map.orgs[screen.org]}» недоступна роли ${role}`)
            orgId = org.id
          }
          if (screen.event) {
            const { events } = await api(context, `/api/organizations/${orgId}/events`)
            const ev = pickEvent(events, screen.event)
            if (!ev) throw new Error(`Событие «${screen.event.title}» не найдено в демо-данных`)
            eventId = ev.id
          }
          if (screen.inviteState) {
            const linkToken = await applyInviteFixture(sql, {
              orgId,
              eventId,
              userKey: map.users[role],
              state: screen.inviteState,
            })
            if (linkToken)
              await page.addInitScript(
                ([key, value]) => window.sessionStorage.setItem(key, value),
                [`vt.inviteToken.${eventId}`, linkToken],
              )
          }
          let slug
          if (screen.publicEvent) {
            const { org, title, status } = screen.publicEvent
            const rows = await sql`
              select e.public_slug, e.starts_at, e.status from events e
              join organizations o on o.id = e.organization_id
              where o.name = ${map.orgs[org]} and e.title = ${title}`
            const ev = pickEvent(
              rows.map((r) => ({
                title,
                status: r.status,
                startsAt: r.starts_at,
                slug: r.public_slug,
              })),
              { title, status },
            )
            if (!ev) throw new Error(`Публичное событие «${title}» не найдено в демо-данных`)
            slug = ev.slug
          }
          result.url = resolvePath(screen.path, { orgId, eventId, slug })
          await page.goto(`${base}${result.url}`, { waitUntil: 'networkidle', timeout: 45_000 })
          await page.evaluate(
            (t) => document.documentElement.classList.toggle('dark', t === 'dark'),
            theme,
          )
          // плашка Nuxt DevTools (dev-режим) не часть интерфейса и перекрывает нижний край
          await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
          for (const step of screen.steps ?? []) {
            if (step.scroll === 'bottom')
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            else await page.click(step.click, { timeout: 10_000 })
          }
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(400)
          const file = `captures/${screen.id}.${theme}.png`
          const buf = await page.screenshot({ path: join(runDir, file), fullPage: screen.fullPage })
          result.capture = file
          result.finalUrl = page.url().replace(base, '')
          if (args.diff && theme === (screen.referenceTheme ?? 'light')) {
            const diffPage = await context.newPage()
            const refBuf = readFileSync(join(runDir, result.references[0]))
            const d = await pixelDiff(
              diffPage,
              buf.toString('base64'),
              refBuf.toString('base64'),
              screen.referenceCrop,
            )
            await diffPage.close()
            const diffFile = `diffs/${screen.id}.${theme}.png`
            writeFileSync(join(runDir, diffFile), Buffer.from(d.png, 'base64'))
            result.diffPercent = d.percent
            result.diffImage = diffFile
          }
          if (result.finalUrl !== result.url) {
            // снимок сохраняется, но прогон считается неуспешным (exit code 1)
            result.warning = `редирект: открылось ${result.finalUrl} вместо ${result.url}`
            exitCode = 1
          }
          console.log(
            `${result.warning ? 'WARN' : 'ok  '} ${screen.id} [${theme}]${result.warning ? ` (${result.warning})` : ''}`,
          )
        } catch (e) {
          result.error = e instanceof Error ? e.message : String(e)
          exitCode = 1
          console.error(`FAIL ${screen.id} [${theme}]: ${result.error}`)
        } finally {
          await page.close()
        }
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
  await sql?.end()
}

const run = {
  startedAt: new Date().toISOString(),
  baseUrl: base,
  commit: gitCommit(),
  themes,
  results: results.sort((a, b) => a.id.localeCompare(b.id) || a.theme.localeCompare(b.theme)),
}
writeFileSync(join(runDir, 'results.json'), JSON.stringify(run, null, 2))
writeFileSync(join(runDir, 'report.md'), renderMarkdown(run))
writeFileSync(join(runDir, 'report.html'), renderHtml(run))
console.log(`\nReport: ${join(runDir, 'report.html')}`)
process.exit(exitCode)
