/**
 * Чистые функции харнесса визуальной сверки (Task 19.0.2): проверка карты экранов,
 * подстановка параметров маршрута, выбор события, отчёты HTML/MD. Без сети и браузера.
 */

export const THEMES = ['light', 'dark']
export const ROLES = ['anonymous', 'player', 'organizer', 'owner']

const ID_RE = /^[a-z0-9][a-z0-9-]*$/
const REFERENCE_RE = /^[\w-][\w.-]*\/[\w-][\w.-]*\.(png|jpe?g)$/

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPosInt = (v) => Number.isInteger(v) && v > 0

/** Возвращает список ошибок карты (пустой — карта корректна). */
export function validateMap(map) {
  const errors = []
  if (!isObj(map)) return ['map: ожидается объект']
  if (map.version !== 1) errors.push('version: ожидается 1')

  const viewports = isObj(map.viewports) ? map.viewports : {}
  if (!isObj(map.viewports) || Object.keys(viewports).length === 0)
    errors.push('viewports: ожидается непустой объект')
  for (const [name, vp] of Object.entries(viewports)) {
    if (!isObj(vp) || !isPosInt(vp.width) || !isPosInt(vp.height))
      errors.push(`viewports.${name}: нужны целые width и height > 0`)
  }

  const users = isObj(map.users) ? map.users : null
  if (!users) errors.push('users: ожидается объект role → ключ демо-пользователя')
  else
    for (const role of ROLES.filter((r) => r !== 'anonymous'))
      if (typeof users[role] !== 'string' || !/^[a-z]+$/.test(users[role]))
        errors.push(`users.${role}: ожидается латинский ключ демо-пользователя`)

  const orgs = isObj(map.orgs) ? map.orgs : {}
  if (!isObj(map.orgs) || Object.keys(orgs).length === 0)
    errors.push('orgs: ожидается объект ключ → название демо-группы')

  if (!Array.isArray(map.screens) || map.screens.length === 0) {
    errors.push('screens: ожидается непустой массив')
    return errors
  }
  const seen = new Set()
  map.screens.forEach((s, i) => {
    const at = `screens[${i}]${isObj(s) && typeof s.id === 'string' ? ` (${s.id})` : ''}`
    if (!isObj(s)) return errors.push(`${at}: ожидается объект`)
    if (typeof s.id !== 'string' || !ID_RE.test(s.id))
      errors.push(`${at}: id — kebab-case латиницей`)
    else if (seen.has(s.id)) errors.push(`${at}: повторяющийся id`)
    else seen.add(s.id)
    if (typeof s.title !== 'string' || !s.title) errors.push(`${at}: нужен title`)
    if (typeof s.path !== 'string' || !s.path.startsWith('/'))
      errors.push(`${at}: path должен начинаться с "/"`)
    if (typeof s.viewport !== 'string' || !(s.viewport in viewports))
      errors.push(`${at}: viewport "${s.viewport}" не описан в viewports`)
    if (!ROLES.includes(s.role)) errors.push(`${at}: role — одно из ${ROLES.join(', ')}`)
    if (!Array.isArray(s.references) || s.references.length === 0)
      errors.push(`${at}: нужен хотя бы один reference`)
    else
      s.references.forEach((r) => {
        if (typeof r !== 'string' || !REFERENCE_RE.test(r))
          errors.push(
            `${at}: reference "${r}" — путь вида 3-miniapp-player/01-screen.png (png/jpg)`,
          )
      })
    const path = typeof s.path === 'string' ? s.path : ''
    if (path.includes('{org}') && !(typeof s.org === 'string' && s.org in orgs))
      errors.push(`${at}: path использует {org}, но org не задан или не описан в orgs`)
    if (path.includes('{event}') && !(isObj(s.event) && typeof s.event.title === 'string'))
      errors.push(`${at}: path использует {event}, нужен event.title`)
    if (path.includes('{slug}') && s.publicEvent === undefined)
      errors.push(`${at}: path использует {slug}, нужен publicEvent`)
    if (
      s.publicEvent !== undefined &&
      !(
        isObj(s.publicEvent) &&
        s.publicEvent.org in orgs &&
        typeof s.publicEvent.title === 'string'
      )
    )
      errors.push(`${at}: publicEvent — { org (ключ из orgs), title, status? }`)
    if (s.role === 'anonymous' && /\{(org|event)\}/.test(path))
      errors.push(`${at}: anonymous не может открывать маршруты группы`)
    if (s.steps !== undefined) {
      if (
        !Array.isArray(s.steps) ||
        s.steps.some(
          (st) => !isObj(st) || !(typeof st.click === 'string' || st.scroll === 'bottom'),
        )
      )
        errors.push(
          `${at}: steps — массив вида { "click": "<selector>" } или { "scroll": "bottom" }`,
        )
    }
    if (s.referenceCrop !== undefined) {
      const c = s.referenceCrop
      if (!isObj(c) || ![c.x, c.y, c.width, c.height].every((n) => Number.isInteger(n) && n >= 0))
        errors.push(`${at}: referenceCrop — целые x, y, width, height`)
    }
    if (s.referenceTheme !== undefined && !THEMES.includes(s.referenceTheme))
      errors.push(`${at}: referenceTheme — light или dark`)
    if (s.inviteState !== undefined) {
      if (!INVITE_STATES.includes(s.inviteState))
        errors.push(`${at}: inviteState — одно из ${INVITE_STATES.join(', ')}`)
      if (s.role !== 'player' || !path.includes('{event}'))
        errors.push(`${at}: inviteState — экран игрока с {event}`)
    }
    if (s.fullPage !== undefined && typeof s.fullPage !== 'boolean')
      errors.push(`${at}: fullPage — boolean`)
  })
  return errors
}

/** Подставляет {org}, {event} и {slug} (публичный идентификатор события, 20.6.1) в шаблон пути. */
export function resolvePath(template, { orgId, eventId, slug } = {}) {
  let out = template
  if (out.includes('{org}')) {
    if (orgId == null) throw new Error(`Не определён orgId для ${template}`)
    out = out.replaceAll('{org}', String(orgId))
  }
  if (out.includes('{event}')) {
    if (eventId == null) throw new Error(`Не определён eventId для ${template}`)
    out = out.replaceAll('{event}', String(eventId))
  }
  if (out.includes('{slug}')) {
    if (slug == null) throw new Error(`Не определён slug для ${template}`)
    out = out.replaceAll('{slug}', String(slug))
  }
  return out
}

/**
 * Выбирает событие группы по названию (и статусу): ближайшее будущее, иначе последнее прошедшее.
 * events — элементы GET /api/organizations/:id/events.
 */
export function pickEvent(events, { title, status }, now = new Date()) {
  const matches = events
    .filter((e) => e.title === title && (!status || e.status === status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  if (matches.length === 0) return null
  return matches.find((e) => new Date(e.startsAt) >= now) ?? matches[matches.length - 1]
}

export const INVITE_STATES = ['none', 'requested', 'invited', 'invited-link', 'expired']

/**
 * Что нужно в локальной БД для состояния M-08 (20.4.7, D-06): запрос игрока и срок приглашения.
 * `invited` — одобренный запрос и приглашение до начала события; `invited-link` — приглашение без
 * запроса, игрок открывает его по личной ссылке (токен — в хранилище сессии); `expired` — приглашение, истёкшее сутки назад.
 */
export function inviteFixturePlan(state, { now, startsAt }) {
  switch (state) {
    case 'none':
      return { request: null, inviteExpiresAt: null }
    case 'requested':
      return { request: 'pending', inviteExpiresAt: null }
    case 'invited':
      return { request: 'approved', inviteExpiresAt: startsAt }
    case 'invited-link':
      return { request: null, inviteExpiresAt: startsAt, link: true }
    case 'expired':
      return { request: 'approved', inviteExpiresAt: new Date(now.getTime() - 86_400_000) }
    default:
      throw new Error(`inviteState: одно из ${INVITE_STATES.join(', ')}`)
  }
}

/** Выбор экранов: ids (--routes a,b) и/или имя viewport; без фильтров — все. */
export function selectScreens(map, { routes, viewport } = {}) {
  let list = map.screens
  if (routes?.length) {
    const unknown = routes.filter((id) => !map.screens.some((s) => s.id === id))
    if (unknown.length) throw new Error(`Неизвестные маршруты в карте: ${unknown.join(', ')}`)
    list = list.filter((s) => routes.includes(s.id))
  }
  if (viewport) list = list.filter((s) => s.viewport === viewport)
  return list
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1']

/**
 * Адрес только локальный: харнесс логинится тестовым initData и пишет в БД.
 * Authority с несколькими "@" или "," отклоняется: клиенты БД (postgres.js) разбирают такие
 * адреса иначе, чем WHATWG URL. Сообщения не содержат исходный адрес (там может быть пароль).
 */
export function assertLocalUrl(raw, what) {
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(String(raw))?.[1]
  if (authority === undefined) throw new Error(`${what}: некорректный адрес`)
  if (authority.includes(',') || authority.split('@').length > 2)
    throw new Error(`${what}: недопустимый authority (несколько хостов или "@")`)
  let host
  try {
    host = new URL(raw).hostname
  } catch {
    throw new Error(`${what}: некорректный адрес`)
  }
  if (!LOCAL_HOSTS.includes(host))
    throw new Error(`${what}: разрешён только локальный адрес (получен хост ${host})`)
}

/** Проверка фактических хостов клиента БД (sql.options.host): все локальные. */
export function assertLocalHosts(hosts, what) {
  const list = Array.isArray(hosts) ? hosts : [hosts]
  if (list.length === 0 || list.some((h) => !LOCAL_HOSTS.includes(String(h))))
    throw new Error(`${what}: клиент БД указывает на нелокальный хост`)
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

const fmtDiff = (r) => (typeof r.diffPercent === 'number' ? `${r.diffPercent.toFixed(1)}%` : '—')

/** Markdown-отчёт; пути картинок относительно папки отчёта. */
export function renderMarkdown(run) {
  const lines = [
    `# Visual reference report — ${run.startedAt}`,
    '',
    `- Base URL: ${run.baseUrl}`,
    `- Commit: ${run.commit ?? 'unknown'}`,
    `- Themes: ${run.themes.join(', ')}`,
    `- Screens: ${run.results.length}`,
    '',
    'Reference screenshots are 924x540 previews with a device frame; pixel diff (if present) is a coarse hint, not a gate.',
    '',
  ]
  for (const r of run.results) {
    lines.push(`## ${r.id} — ${r.title} (${r.theme})`, '')
    lines.push(`- Route: \`${r.url}\`; role: ${r.role}; viewport: ${r.viewportSize}`)
    if (r.error) lines.push(`- **Capture failed:** ${r.error}`)
    else lines.push(`- Capture: ![capture](${r.capture})`)
    if (r.warning) lines.push(`- **Warning:** ${r.warning}`)
    r.references.forEach((ref) => lines.push(`- Reference: ![reference](${ref})`))
    if (typeof r.diffPercent === 'number')
      lines.push(`- Pixel diff: ${fmtDiff(r)}${r.diffImage ? ` ([image](${r.diffImage}))` : ''}`)
    lines.push('', '### Differences', '', '- [ ] _(none noted yet)_', '')
  }
  return lines.join('\n')
}

/** HTML-отчёт: захват слева, референс(ы) справа, редактируемый список расхождений. */
export function renderHtml(run) {
  const rows = run.results
    .map((r) => {
      const refs = r.references.map((ref) => `<img src="${esc(ref)}" alt="reference">`).join('')
      const cap = r.error
        ? `<p class="err">Capture failed: ${esc(r.error)}</p>`
        : `<img src="${esc(r.capture)}" alt="capture">`
      const warn = r.warning ? `<p class="err">Warning: ${esc(r.warning)}</p>` : ''
      const diff =
        typeof r.diffPercent === 'number'
          ? `<p>Pixel diff: <b>${fmtDiff(r)}</b>${r.diffImage ? ` · <a href="${esc(r.diffImage)}">diff image</a>` : ''}</p>`
          : ''
      return `<section id="${esc(r.id)}-${esc(r.theme)}">
<h2>${esc(r.id)} — ${esc(r.title)} <small>${esc(r.theme)}</small></h2>
<p class="meta"><code>${esc(r.url)}</code> · role ${esc(r.role)} · ${esc(r.viewportSize)}</p>
${warn}${diff}
<div class="pair"><figure><figcaption>App</figcaption>${cap}</figure><figure><figcaption>Reference</figcaption>${refs}</figure></div>
<h3>Differences</h3>
<ul class="diffs"><li contenteditable="true"></li></ul>
</section>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual reference report</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;background:#fafafa;color:#111}
section{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:0 0 24px}
h2{margin:0 0 4px;font-size:18px} small{color:#666;font-weight:400} .meta{color:#555;margin:0 0 8px}
.pair{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap} figure{margin:0}
figcaption{font-weight:600;margin-bottom:4px} img{max-width:100%;height:auto;border:1px solid #ccc;display:block;margin-bottom:8px}
figure:first-child img{max-width:560px} figure:last-child img{max-width:560px}
.diffs{min-height:2em;border:1px dashed #bbb;padding:8px 8px 8px 28px;margin:4px 0 0}
.err{color:#b00020} code{background:#f0f0f0;padding:0 4px;border-radius:3px}
</style></head><body>
<h1>Visual reference report</h1>
<p>${esc(run.startedAt)} · ${esc(run.baseUrl)} · commit ${esc(run.commit ?? 'unknown')} · themes ${esc(run.themes.join(', '))}</p>
<p>Reference screenshots are 924x540 previews with a device frame; pixel diff (if present) is a coarse hint, not a gate. List differences below each screen and copy them into the PR.</p>
${rows}
</body></html>
`
}
