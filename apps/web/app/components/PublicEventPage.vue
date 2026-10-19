<script setup lang="ts">
import { meterTint } from '~/utils/status-model'
import {
  publicEventIcs,
  publicEventModel,
  type PublicEventPayload,
  type PublicTile,
} from '~/utils/public-event'

/**
 * Публичная страница события (20.6.1, P-17; макет «5 Public Pages»). Только данные ответа
 * `GET /api/public/events/{slug}`: счётчики мест и инициалы записавшихся — имён, аватаров, уровней
 * и оплат на странице нет. Цена приходит из `quoteEventPrice` и здесь не пересчитывается.
 */
const props = defineProps<{
  data: PublicEventPayload
  /** Момент для состояния события; на сервере и при гидратации один и тот же. */
  now: Date
  /** Показать ссылку события в шапке (`host/e/slug`). */
  linkLabel: string
}>()

const m = computed(() => publicEventModel(props.data, props.now))
const ev = computed(() => props.data.event)
const memberWord = (n: number) => {
  const a = Math.abs(n) % 100
  const b = a % 10
  return a > 10 && a < 20 ? 'игроков' : b === 1 ? 'игрок' : b >= 2 && b <= 4 ? 'игрока' : 'игроков'
}
const segments = computed(() => (ev.value.capacity <= 30 ? ev.value.capacity : 0))
const icsHref = computed(
  () =>
    `data:text/calendar;charset=utf-8,${encodeURIComponent(publicEventIcs(props.data, props.now))}`,
)
const showIcs = computed(() => m.value.state !== 'cancelled' && m.value.state !== 'past')

const copied = ref(false)
async function share() {
  const url = window.location.href
  try {
    if (navigator.share) await navigator.share({ title: ev.value.title, url })
    else {
      await navigator.clipboard.writeText(url)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    }
  } catch {
    // пользователь закрыл диалог «Поделиться» или буфер недоступен: ничего не ломаем
  }
}
const tileClass = (tone: 'orange' | 'blue' | 'bone') =>
  tone === 'orange' ? 'vt-card--warm' : tone === 'blue' ? 'vt-card--cool' : ''
const tiles = computed(
  () =>
    [
      { tile: m.value.dateTile, tone: 'bone' as const, id: 'date' },
      ...(m.value.priceTile
        ? [{ tile: m.value.priceTile, tone: 'orange' as const, id: 'price' }]
        : []),
    ] satisfies { tile: PublicTile; tone: 'orange' | 'blue' | 'bone'; id: string }[],
)
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink">
    <header
      class="sticky top-0 z-10 backdrop-blur"
      style="background: color-mix(in oklab, var(--vt-paper) 92%, transparent)"
    >
      <div class="mx-auto flex max-w-[1120px] items-center gap-3.5 px-4 py-3.5 md:px-8">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Volley Time — на главную">
          <img src="/logo/vt-mark-color.svg" alt="" width="26" height="26" />
          <span class="uppercase" style="font-family: var(--f-display); font-weight: 700">
            Volley<span style="color: var(--vt-flame-ink)">Time</span>
          </span>
        </NuxtLink>
        <span
          class="hidden rounded-full bg-vt-bone px-3 py-1.5 text-[length:var(--fs-xs)] text-vt-mute-2 md:inline"
          data-testid="link-label"
          >{{ linkLabel }}</span
        >
        <div class="ml-auto flex items-center gap-2">
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="share">
            <VtIcon name="copy" :size="14" aria-hidden="true" />
            <span>{{ copied ? 'Ссылка скопирована' : 'Поделиться' }}</span>
          </button>
          <a
            v-if="data.telegramUrl"
            :href="data.telegramUrl"
            class="vt-btn vt-btn--ink vt-btn--sm hidden sm:inline-flex"
            rel="noopener"
          >
            <VtIcon name="tg" :size="14" aria-hidden="true" />
            Войти через Telegram
          </a>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1120px] px-4 pb-10 pt-4 md:px-8 md:pt-6">
      <div class="mb-5 flex flex-wrap items-center gap-2.5">
        <VtAvatar :name="data.group.name" size="sm" />
        <span class="text-[length:var(--fs-base)] font-semibold">{{ data.group.name }}</span>
        <span class="text-[length:var(--fs-sm)] text-vt-mute-2">
          {{ data.group.city ? `${data.group.city} · ` : '' }}{{ data.group.memberCount }}
          {{ memberWord(data.group.memberCount) }}
        </span>
      </div>

      <div class="grid gap-4 md:grid-cols-[1.35fr_1fr]">
        <!-- Hero -->
        <section
          class="vt-card vt-card--hero relative flex min-h-[420px] flex-col overflow-hidden p-6 md:p-8"
          aria-labelledby="event-title"
        >
          <div
            aria-hidden="true"
            class="absolute -right-14 -top-14 h-[220px] w-[220px] rounded-full opacity-90"
            style="background: var(--vt-orange)"
          />
          <div class="relative">
            <div class="flex flex-wrap gap-1.5">
              <span
                class="vt-chip"
                data-testid="status-chip"
                style="
                  background: var(--vt-on-hero-fill);
                  color: var(--vt-on-hero);
                  border-color: transparent;
                "
                >{{ m.statusChip }}</span
              >
              <span
                v-if="m.priceChip"
                class="vt-chip"
                data-testid="price-chip"
                style="
                  background: var(--vt-on-hero-fill);
                  color: var(--vt-on-hero);
                  border-color: transparent;
                "
                >{{ m.priceChip }}</span
              >
            </div>
            <h1
              id="event-title"
              class="mt-5 break-words text-[length:var(--fs-5xl)] uppercase md:text-[length:var(--fs-7xl)]"
              style="
                font-family: var(--f-display);
                font-weight: 700;
                line-height: 1;
                color: var(--vt-on-hero);
              "
            >
              {{ ev.title }}
            </h1>
            <p
              v-if="ev.description"
              class="mt-4 max-w-[460px] whitespace-pre-line text-[length:var(--fs-md)] leading-normal"
              style="color: var(--vt-on-hero-2)"
            >
              {{ ev.description }}
            </p>
          </div>
          <div class="relative mt-auto flex flex-wrap gap-2.5 pt-7">
            <a
              v-if="m.cta.href"
              :href="m.cta.href"
              class="vt-btn vt-btn--lg"
              style="background: var(--vt-orange); color: var(--vt-on-hero)"
              rel="noopener"
              data-testid="cta"
            >
              <VtIcon name="tg" :size="17" aria-hidden="true" />
              {{ m.cta.label }}
            </a>
            <a
              v-if="showIcs"
              :href="icsHref"
              download="volleytime-event.ics"
              class="vt-btn vt-btn--lg"
              style="background: var(--vt-on-hero-fill); color: var(--vt-on-hero)"
            >
              <VtIcon name="calendar" :size="17" aria-hidden="true" />
              В календарь
            </a>
          </div>
          <p
            class="relative mt-3 text-[length:var(--fs-sm)]"
            style="color: var(--vt-on-hero-3)"
            data-testid="price-note"
          >
            {{ m.priceNote }}
          </p>
        </section>

        <!-- Факты, место, состав -->
        <div class="grid grid-cols-2 content-start gap-4">
          <div
            v-for="t in tiles"
            :key="t.id"
            class="vt-card px-5 py-[18px]"
            :class="tileClass(t.tone)"
            :data-testid="`tile-${t.id}`"
          >
            <div class="vt-cap">{{ t.tile.label }}</div>
            <div class="vt-mono mt-2.5 text-[length:var(--fs-3xl)] font-bold leading-none">
              {{ t.tile.value }}
            </div>
            <div v-if="t.tile.sub" class="mt-1.5 text-[length:var(--fs-sm)] text-vt-mute-2">
              {{ t.tile.sub }}
            </div>
          </div>

          <div v-if="m.place" class="vt-card col-span-2 flex items-center gap-3.5 px-5 py-[18px]">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-btn)] bg-vt-paper"
            >
              <VtIcon name="pin" :size="20" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <div class="break-words text-[length:var(--fs-md)] font-bold">{{ m.place.name }}</div>
              <div
                v-if="m.place.address"
                class="mt-0.5 break-words text-[length:var(--fs-sm)] text-vt-mute-2"
              >
                {{ m.place.address }}
              </div>
            </div>
          </div>

          <section class="vt-card vt-card--raised col-span-2 px-[22px] py-5" aria-label="Состав">
            <div class="vt-cap">Состав</div>
            <div class="mt-2.5 flex items-baseline gap-2" data-testid="seats">
              <span class="vt-mono text-[length:var(--fs-6xl)] font-bold leading-none">{{
                ev.taken
              }}</span>
              <span
                class="vt-mono text-[length:var(--fs-2xl)] font-bold leading-none text-vt-mute-2"
                >/ {{ ev.capacity }}</span
              >
              <span class="ml-1 text-[length:var(--fs-sm)] text-vt-mute-2">{{
                m.seats.full && !m.seats.dim ? 'мест нет' : 'мест занято'
              }}</span>
            </div>
            <div
              v-if="segments"
              class="mt-3.5 flex gap-1"
              role="img"
              :aria-label="`Занято ${ev.taken} из ${ev.capacity} мест`"
            >
              <span
                v-for="i in segments"
                :key="i"
                class="h-2 flex-1 rounded-full"
                :style="{
                  background:
                    i <= ev.taken
                      ? m.seats.dim
                        ? 'var(--vt-mute-2)'
                        : meterTint(m.seats.pct)
                      : 'var(--vt-bone-2)',
                }"
              />
            </div>
            <div v-else class="mt-3.5">
              <VtMeter
                :value="ev.taken"
                :max="ev.capacity"
                :tone="m.seats.tone"
                :label="`Занято ${ev.taken} из ${ev.capacity} мест`"
              />
            </div>
            <div
              v-if="data.roster.initials.length > 0"
              class="mt-4 flex items-center gap-2.5"
              data-testid="roster"
            >
              <div class="vt-stack">
                <VtAvatar
                  v-for="(initials, i) in data.roster.initials"
                  :key="i"
                  :name="initials"
                  size="sm"
                />
              </div>
              <span v-if="m.rosterLine" class="text-[length:var(--fs-sm)] text-vt-mute-2">{{
                m.rosterLine
              }}</span>
            </div>
          </section>
        </div>
      </div>

      <section
        v-if="m.splitExplainer"
        class="vt-card mt-4 px-[22px] py-5"
        aria-labelledby="split-title"
        data-testid="split-explainer"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="split-title" class="vt-cap">{{ m.splitExplainer.title }}</h2>
          <span v-if="m.splitExplainer.divider" class="text-[length:var(--fs-xs)] text-vt-mute-2">{{
            m.splitExplainer.divider
          }}</span>
        </div>
        <ul
          v-if="m.splitExplainer.scenarios.length > 0"
          class="mt-3.5 grid list-none grid-cols-2 gap-2 p-0 md:grid-cols-4"
        >
          <li
            v-for="s in m.splitExplainer.scenarios"
            :key="s.seats"
            class="rounded-[var(--r-btn)] p-3"
            :style="
              s.current
                ? 'background: var(--vt-inverse-bg); color: var(--vt-inverse-fg)'
                : 'background: var(--vt-raised)'
            "
          >
            <div
              class="text-[length:var(--fs-xs)]"
              :style="s.current ? 'opacity: 0.7' : 'color: var(--vt-mute-2)'"
            >
              {{ s.seats }} мест{{ s.current ? ' · сейчас' : '' }}
            </div>
            <div class="vt-mono mt-1.5 text-[length:var(--fs-xl)] font-bold leading-none">
              {{ s.amount }}
            </div>
          </li>
        </ul>
        <p class="mt-3.5 text-[length:var(--fs-sm)] leading-snug text-vt-mute-2">
          {{ m.splitExplainer.note }}
        </p>
      </section>

      <section
        class="mt-4 flex flex-wrap items-center gap-5 rounded-[var(--r-card)] px-[30px] py-[26px]"
        style="background: var(--vt-night); color: var(--vt-on-hero)"
        aria-label="О платформе"
      >
        <div class="min-w-[220px] flex-1">
          <div class="vt-cap" style="color: var(--vt-on-hero-3)">Запись сделана в VolleyTime</div>
          <div
            class="mt-2 text-[length:var(--fs-3xl)] uppercase"
            style="font-family: var(--f-display); font-weight: 700; line-height: 0.95"
          >
            Свой клуб? Сделай так же.
          </div>
          <div class="mt-1.5 text-[length:var(--fs-base)]" style="color: var(--vt-on-hero-3)">
            Telegram-first платформа для тренировок и турниров.
          </div>
        </div>
        <NuxtLink
          to="/"
          class="vt-btn vt-btn--lg"
          style="background: var(--vt-orange); color: var(--vt-on-hero)"
        >
          Подробнее
          <VtIcon name="arrow-r" :size="16" aria-hidden="true" />
        </NuxtLink>
      </section>

      <p class="mt-5 text-center text-[length:var(--fs-xs)] text-vt-mute-2">© VolleyTime 2026</p>
    </main>
  </div>
</template>
