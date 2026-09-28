# MVP Landing v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить публичную `/` честным MVP-лендингом в композиции обновлённого Bento Bold-референса с работающими CTA, FAQ и доступным интерактивом.

**Architecture:** Одна Nuxt SSR-страница использует небольшой типизированный каталог публичных текстов/ссылок, декоративный компонент-пример и отдельный клиентский motion-модуль. Маршрутизация остаётся в существующих `/auth/login` и `/m/orgs/create`; новых API и зависимостей нет.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, существующие `tokens.css`/`main.css`, CSS и canvas, Vitest unit, browser QA.

**Spec:** `docs/superpowers/specs/2026-09-25-mvp-landing-v2-design.md`; SDD: `docs/tasks/3-11-4-mvp-landing-v2.md`.

## Global Constraints

- Начать реализацию только после `3.11.2` со статусом `done` и проверенной базой `main`; сейчас карточка ещё `in_progress`.
- Исходный `D:\ai\freelance\volleyball-volleytime\Volley Time v2.zip` имеет SHA-256 `51827733915F8D2B82F3CB4584AD26B50BCF722A3D2473AC18E9D12C7CC60657`; использовать `0 Лендинг.html`, `landing-fx.js`, `styles.css` и `01–03-landing.png` как визуальный референс, не как код или источник доменных правил.
- Не обещать credits, цены, split-оплату, multi-seat, сборы, отчёты, запланированные напоминания, «5 бесплатных событий», 30-минутную очередь и живые KPI; `pricing`-секции и якоря нет.
- Анонимный CTA: `/auth/login?redirect=%2Fm%2Forgs%2Fcreate`; после известной активной сессии: `/m/orgs/create`. Telegram CTA только при валидном настроенном `telegramBotUsername`.
- Публичная страница не запрашивает tenant API и не показывает данные организации. Демо явно помечено «Пример интерфейса» и скрыто от accessibility tree.
- FAQ и якоря работают без motion-кода; при `prefers-reduced-motion: reduce` нет непрерывных частиц/marquee, параллакса и пространственного reveal. На coarse pointer нет cursor-эффектов.
- Каждая законченная часть проходит red → green → refactor; после кода обязательны `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, browser QA и независимое review. Ни одна локальная проверка не подтверждает production или Telegram QA.

## Review Focus

1. `telegramBotUsername` пустой, с `@` или непригодный для URL: кнопки нет при пустом/невалидном имени, а допустимое имя ведёт к единственному текущему боту. Проверить в Task 1 и Task 4.
2. Сессия ещё определяется или запрос завершился ошибкой: CTA остаётся на login с redirect, не отправляет анонима сразу на защищённый маршрут. Проверить в Task 1 и Task 4.
3. JS отключён, `IntersectionObserver` отсутствует или reduced motion включён после загрузки: контент и FAQ остаются видимыми, а непрерывная анимация останавливается. Проверить в Task 3 и Task 4.
4. Touch, 320 px и 200% zoom: нет магнитного hover, горизонтального скролла и обрезанных кнопок. Проверить в Task 3 и Task 4.
5. Нажатия CTA/якорей при sticky header: нужная форма/секция достижима, заголовок не закрыт шапкой. Проверить в Task 2 и Task 4.

## File map

| Файл                                                 | Ответственность                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/web/app/utils/landing.ts` + `.test.ts`         | Константы секций/FAQ, безопасные CTA и Telegram URL; никакого DOM.                           |
| `apps/web/app/pages/index.vue`                       | SSR-разметка, семантика, head, auth-state и подключение локальных компонентов.               |
| `apps/web/app/components/landing/LandingPreview.vue` | Только декоративный, явно подписанный макет карточки события/телефонов.                      |
| `apps/web/app/components/landing/LandingMotion.vue`  | Canvas, observer, pointer/scroll эффекты, lifecycle cleanup; не влияет на ссылки/контент.    |
| `apps/web/app/utils/landing-motion.ts` + `.test.ts`  | Чистая политика включения эффектов для reduced motion, pointer и visibility.                 |
| `apps/web/app/assets/css/landing.css`                | Только стили публичной страницы; подключается из `index.vue`, не меняет глобальный Mini App. |
| `docs/tasks/3-11-4-mvp-landing-v2.md`                | Фактические тесты, screenshots/QA, review и статус задачи.                                   |

## Task 1: Данные и маршруты публичной страницы

**Files:** Create `apps/web/app/utils/landing.ts`, `apps/web/app/utils/landing.test.ts`.

**Interfaces:** Produces `landingSections`, `landingFeatures`, `landingFaq`, `groupCreateHref(isAuthenticated: boolean | null): string`, `telegramBotHref(raw: string): string | null`; Task 2 imports them. `null` means session unknown or failed.

- [ ] **Step 1: Red.** Write `landing.test.ts` with exact behavior:

```ts
import { describe, expect, it } from 'vitest'
import {
  groupCreateHref,
  landingFaq,
  landingFeatures,
  landingSections,
  telegramBotHref,
} from './landing'

describe('MVP landing public contract', () => {
  it('keeps anonymous and unknown sessions on the recoverable login path', () => {
    expect(groupCreateHref(false)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(null)).toBe('/auth/login?redirect=%2Fm%2Forgs%2Fcreate')
    expect(groupCreateHref(true)).toBe('/m/orgs/create')
  })
  it('renders only a configured valid bot', () => {
    expect(telegramBotHref('')).toBeNull()
    expect(telegramBotHref('bad/name')).toBeNull()
    expect(telegramBotHref('@VolleyTimeBot')).toBe('https://t.me/VolleyTimeBot')
  })
  it('has real anchor targets and MVP-only copy', () => {
    expect(landingSections.map((section) => section.id)).toEqual([
      'features',
      'how-it-works',
      'faq',
    ])
    expect(landingFaq).toHaveLength(4)
    expect(landingFeatures).toHaveLength(4)
    const copy = JSON.stringify([landingFaq, landingFeatures]).toLowerCase()
    for (const claim of ['credits', 'split', '30 минут', 'напоминания по расписанию']) {
      expect(copy).not.toContain(claim)
    }
  })
})
```

- [ ] **Step 2: Verify red.** `pnpm exec vitest run --project unit apps/web/app/utils/landing.test.ts`; expect module-not-found failure.
- [ ] **Step 3: Green.** Define typed, immutable arrays in `landing.ts`; keep all public anchors in one place. Use these exact route functions:

```ts
export function groupCreateHref(isAuthenticated: boolean | null): string {
  return isAuthenticated === true ? '/m/orgs/create' : '/auth/login?redirect=%2Fm%2Forgs%2Fcreate'
}

export function telegramBotHref(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(name) ? `https://t.me/${name}` : null
}

export const landingSections = [
  { id: 'features', label: 'Возможности' },
  { id: 'how-it-works', label: 'Как работает' },
  { id: 'faq', label: 'Вопросы' },
] as const

export const landingFeatures = [
  {
    title: 'Запись и лист ожидания',
    body: 'Игроки видят места и записываются; при освобождении места очередь обновляется.',
  },
  {
    title: 'Оплаты и касса',
    body: 'Организатор отмечает наличные или перевод, подтверждает оплату и видит движения кассы.',
  },
  {
    title: 'Абонементы по выбору группы',
    body: 'Группа может включить абонементы; организатор управляет планами и остатками.',
  },
  {
    title: 'Расписание и состав',
    body: 'Создавайте события и проверяйте состав участников в одном месте.',
  },
] as const

export const landingFaq = [
  {
    question: 'Нужно ли устанавливать приложение?',
    answer: 'Нет. Игрок открывает Mini App в Telegram по приглашению группы.',
  },
  {
    question: 'Как учитываются оплаты?',
    answer: 'Организатор отмечает наличные или перевод и подтверждает оплату в приложении.',
  },
  {
    question: 'Что происходит при отмене записи?',
    answer: 'Освободившееся место может перейти следующему игроку из листа ожидания.',
  },
  {
    question: 'Как создать группу?',
    answer:
      'Войдите по email и заполните форму создания группы, затем отправьте приглашение игрокам.',
  },
] as const
```

These arrays are the approved initial copy; keep visual headings in Task 2 consistent with them and avoid unsupported numeric claims.

- [ ] **Step 4: Verify green.** Rerun the exact Vitest command; all 3 cases pass. Review user-facing copy against `docs/RELEASES.md` and SDD; remove any future-feature claim before continuing.
- [ ] **Step 5: Commit.** `git add apps/web/app/utils/landing.ts apps/web/app/utils/landing.test.ts`; commit `feat(3.11.4): define honest landing content and routes` with `Task: 3.11.4` and `Release: v0.1.6` trailers.

## Task 2: SSR-разметка и визуальная композиция

**Files:** Modify `apps/web/app/pages/index.vue`; create `apps/web/app/components/landing/LandingPreview.vue`, `apps/web/app/assets/css/landing.css`.

**Interfaces:** Consumes Task 1 exports. Produces section IDs `features`, `how-it-works`, `faq`; the root `.landing` and canvas host selectors used by Task 3. Header/hero/final CTA share `groupCreateHref`.

- [ ] **Step 1: Red.** Run `pnpm dev:web` in an isolated terminal and open `http://localhost:3000/`. Record that the existing single-card page lacks `#features`, `#how-it-works`, `#faq`, create-group CTA and native FAQ; save this baseline in the SDD card as a pre-implementation observation, not as acceptance.
- [ ] **Step 2: Green — page structure.** Build `index.vue` with one skip link, one `main`, one `h1`, visible content without animation classes, and these ordered sections: sticky header; hero + `LandingPreview`; MVP marquee; «было/стало»; four Bento features; three steps; organizer/player split; FAQ; final CTA; footer. Bind `NuxtLink :to="createHref"` in header/hero/final CTA, `NuxtLink to="/auth/login"` for sign-in, and `a :href="botHref"` only with `v-if="botHref"`. Use `landingSections` for header/footer anchors and native `<details><summary>` for each FAQ. Use `useHead` for title/description. Auth detection uses `useAuth().user` only after `fetchSession()` resolves on mount; initial/failure `createHref` is the login redirect, preventing an anonymous jump to `/m/orgs/create`.

```ts
const { user, fetchSession } = useAuth()
const sessionKnown = ref(false)
const createHref = computed(() => groupCreateHref(sessionKnown.value ? user.value !== null : null))
onMounted(async () => {
  try {
    await fetchSession()
  } finally {
    sessionKnown.value = true
  }
})
const botHref = computed(() => telegramBotHref(useRuntimeConfig().public.telegramBotUsername))
```

Put the entire SSR page inside `<div class="landing">`; do not add tenant API calls. `LandingPreview` receives no real event/member props, shows label «Пример интерфейса», uses only neutral states («Открыта запись», «Места доступны», «Оплата ожидает подтверждения»), and puts its illustration in a separate `aria-hidden="true"` wrapper. The label remains readable outside that wrapper.

```vue
<template>
  <div class="landing">
    <a class="landing__skip" href="#main-content">К содержанию</a>
    <header class="landing__header">
      <nav aria-label="Основная навигация">
        <a v-for="section in landingSections" :key="section.id" :href="`#${section.id}`">{{
          section.label
        }}</a>
        <NuxtLink to="/auth/login">Войти</NuxtLink>
        <NuxtLink :to="createHref">Создать группу</NuxtLink>
      </nav>
    </header>
    <main id="main-content">
      <section class="landing__hero" aria-labelledby="landing-title">
        <div>
          <h1 id="landing-title">Игра без чата и таблиц</h1>
          <NuxtLink :to="createHref">Создать группу</NuxtLink>
        </div>
        <div data-landing-canvas aria-hidden="true"></div>
        <LandingPreview />
      </section>
      <section id="features"><h2>Возможности</h2></section>
      <section id="how-it-works"><h2>Как работает</h2></section>
      <section id="faq">
        <h2>Вопросы и ответы</h2>
        <details v-for="item in landingFaq" :key="item.question">
          <summary>{{ item.question }}</summary>
          <p>{{ item.answer }}</p>
        </details>
      </section>
      <section class="landing__final">
        <div data-landing-canvas aria-hidden="true"></div>
        <NuxtLink :to="createHref">Создать группу</NuxtLink>
      </section>
    </main>
    <footer><a href="#main-content">Наверх</a></footer>
    <LandingMotion />
  </div>
</template>
```

Insert the described MVP marquee, before/after, four feature cards, three steps and organizer/player split within the shown section order; each gets a readable heading and the approved Task 1 copy. The template is the semantic wiring contract, not a replacement for the full visual sections.

- [ ] **Step 3: Green — styles.** Implement `landing.css` scoped under `.landing`; max width 1240 px, side padding 28 px (18 px mobile), hero desktop 1.05fr/1fr and one column by 1080 px, four-column Bento collapsing to two and one columns, sticky translucent header, Oswald/Golos token pairing, blue-ink illustration, orange accent, readable footer. Import only from `index.vue`. Set `scroll-margin-top` on all section IDs, 44 px minimum link/summary targets, visible focus and wrap-safe CTA row. At `max-width: 1000px`, replace multi-link nav with a compact always-visible entry to `#features`/`#how-it-works`/`#faq` or a keyboard-operable native disclosure; never leave sections unreachable.

```css
.landing {
  overflow-x: clip;
  background: var(--vt-paper);
  color: var(--vt-ink);
}
.landing__container {
  width: min(100% - 56px, 1240px);
  margin-inline: auto;
}
.landing :is(#features, #how-it-works, #faq) {
  scroll-margin-top: 96px;
}
@media (max-width: 1080px) {
  .landing__hero {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .landing__container {
    width: min(100% - 36px, 1240px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .landing *,
  .landing *::before,
  .landing *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Verify.** Reload `/` and inspect SSR HTML using `curl.exe -s http://localhost:3000/` for `h1`, three section IDs and metadata. In browser, click all nav/CTA paths and open FAQ with keyboard. At 320/390/768/1280/1440 px and 200% zoom, capture screenshots and compare hero, Bento, three steps and footer to `01–03-landing.png`; capture observed deviations in the SDD card. If auth is unavailable locally, verify redirect URL by link inspection and defer a real OTP flow to Task 4—do not claim it passed.
- [ ] **Step 5: Commit.** Stage only the three Task 2 files and commit `feat(3.11.4): build public MVP landing` with required trailers.

## Task 3: Доступный motion-слой

**Files:** Create `apps/web/app/utils/landing-motion.ts`, `apps/web/app/utils/landing-motion.test.ts`, `apps/web/app/components/landing/LandingMotion.vue`; modify `apps/web/app/pages/index.vue`, `apps/web/app/assets/css/landing.css`.

**Interfaces:** `landingMotionMode({ reducedMotion, finePointer, inViewport, pageVisible })` returns `{ particles, pointerEffects, reveal }`; component mounts within `.landing` and never owns semantic content or navigation.

- [ ] **Step 1: Red.** Write policy tests before touching canvas code:

```ts
import { describe, expect, it } from 'vitest'
import { landingMotionMode } from './landing-motion'

describe('landing motion policy', () => {
  const normal = { reducedMotion: false, finePointer: true, inViewport: true, pageVisible: true }
  it('runs full effects only in a visible fine-pointer view', () => {
    expect(landingMotionMode(normal)).toEqual({
      particles: true,
      pointerEffects: true,
      reveal: true,
    })
    expect(landingMotionMode({ ...normal, finePointer: false }).pointerEffects).toBe(false)
  })
  it('pauses expensive work when hidden or offscreen', () => {
    expect(landingMotionMode({ ...normal, pageVisible: false }).particles).toBe(false)
    expect(landingMotionMode({ ...normal, inViewport: false }).particles).toBe(false)
  })
  it('does not spatially animate reduced-motion content', () => {
    expect(landingMotionMode({ ...normal, reducedMotion: true })).toEqual({
      particles: false,
      pointerEffects: false,
      reveal: false,
    })
  })
})
```

- [ ] **Step 2: Verify red.** `pnpm exec vitest run --project unit apps/web/app/utils/landing-motion.test.ts`; expect missing export/module failure.
- [ ] **Step 3: Green — policy and lifecycle.** Implement the pure policy exactly:

```ts
type MotionInputs = {
  reducedMotion: boolean
  finePointer: boolean
  inViewport: boolean
  pageVisible: boolean
}
export function landingMotionMode(input: MotionInputs) {
  const active = !input.reducedMotion && input.pageVisible && input.inViewport
  return {
    particles: active,
    pointerEffects: active && input.finePointer,
    reveal: !input.reducedMotion,
  }
}
```

In `LandingMotion.vue`, use `onMounted`/`onUnmounted`, `matchMedia('(prefers-reduced-motion: reduce)')`, `matchMedia('(pointer: fine)')`, `IntersectionObserver`, `ResizeObserver`, `visibilitychange` and `requestAnimationFrame`. On mount select exactly the two `[data-landing-canvas]` hosts, append a canvas to each, and remove both at unmount. Canvas hosts in hero and final CTA have `aria-hidden="true"`, capped DPR 2, density `clamp(area / 8200, 24, 110)`, and no animation when offscreen. Store observer/listener/rAF handles in component-local variables; cleanup disconnects both observers, removes media/visibility/pointer/scroll listeners and cancels rAF. If observers are unavailable, keep content visible and disable particles; do not schedule an unbounded loop. Media-query changes recalculate policy immediately.

Add fine-pointer-only spotlight/hover and restrained parallax via CSS custom properties; scroll progress and active section use passive scroll/observer state. Reveal applies only after client mount to elements currently observed; never set SSR/default content to `opacity: 0`. Decorative marquee contains only MVP phrases and stops under reduced motion. Do not implement prototype counters, fake live notifications or seat-fill animation.

- [ ] **Step 4: Verify green.** Rerun the exact unit command; then in browser confirm ordinary fine-pointer particles/parallax/reveal/hover, coarse-pointer without pointer effects, reduced motion from initial load and toggled live, no rAF while hidden/offscreen or after leaving `/`, no hidden content with JS disabled. Use Performance panel for frame scheduling; record the observations in the SDD card.
- [ ] **Step 5: Commit.** Stage only Task 3 files and commit `feat(3.11.4): add accessible landing interactions` with required trailers.

## Task 4: Сквозная QA, gates и review

**Files:** Modify `docs/tasks/3-11-4-mvp-landing-v2.md`; change code only through a new red → green cycle if QA finds a defect.

**Interfaces:** Consumes the completed `/` route, existing OTP login and Telegram config; produces evidence for task acceptance and later release gate `8.10.3`.

- [ ] **Step 1: Functional browser matrix.** Repeat at 320/390/768/1280/1440 px and 200% zoom: no horizontal overflow, readable content, working header/footer anchors below sticky header, keyboard skip link/focus/FAQ, working sign-in and create-group routes, bot button present only for a configured valid username. Test anonymous, valid session and failed session fetch. If OTP cannot be completed locally, mark that exact flow unverified for manual QA; never infer it from the route URL alone.
- [ ] **Step 2: Motion and content matrix.** Test JS disabled, reduced motion on initial load and dynamically, hidden tab/offscreen canvas, coarse pointer, unmount/revisit, active section and scroll progress. Compare screenshots with reference composition; inspect visible text, meta description, illustration and links for every excluded claim, invented KPI, `href="#"`, dead policy/support link, and incorrect bot identity. Create a separate SDD defect card first if a product issue is found, then red → green → refactor.
- [ ] **Step 3: Repository gates.** From repo root run, separately, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Integration tests require PostgreSQL; if unavailable, report the specific failure and do not mark the gate green. Run `git diff --check`. Record commands, dates and outcomes in the task card.
- [ ] **Step 4: Independent review and CI.** Request whole-branch review against the SDD/spec, fix findings through TDD, rerun affected and five required gates, open a task PR, verify CI and merge into GitHub `main` only after acceptance. Update the task status/evidence honestly. The broader `8.10.3` visual/functional QA, Telegram/manual acceptance, production backup and deployment remain separate gates; do not advance `prod` from this task alone.
- [ ] **Step 5: Documentation commit.** `git add docs/tasks/3-11-4-mvp-landing-v2.md` and commit `docs(3.11.4): record landing verification` with `Task: 3.11.4` and `Release: v0.1.6` trailers.
