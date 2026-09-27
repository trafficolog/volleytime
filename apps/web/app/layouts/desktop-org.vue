<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import {
  desktopNavItems,
  desktopSignInPath,
  resolveDesktopOrgAccess,
  shouldShowDesktopOrgLoading,
} from '~/utils/desktop-org-ui'

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { data, pending, error, refresh } = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-org-${orgId.value}` })
const organization = computed(() => data.value?.organization ?? null)
const access = computed(() =>
  resolveDesktopOrgAccess(
    organization.value,
    data.value?.myMember ?? null,
    orgId.value,
    apiErrorStatus(error.value),
    apiErrorCode(error.value),
  ),
)
const isLoading = computed(() =>
  shouldShowDesktopOrgLoading(pending.value, organization.value?.id ?? null, orgId.value),
)
const items = computed(() =>
  desktopNavItems(orgId.value, organization.value?.subscriptionsEnabled === true),
)
const mobileNavOpen = ref(false)
const mobileMenuButton = ref<HTMLButtonElement | null>(null)
const base = computed(() => `/app/orgs/${orgId.value}`)

function isCurrent(to: string) {
  if (to === base.value) return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}

function closeMobileNav() {
  mobileNavOpen.value = false
  mobileMenuButton.value?.focus()
}

watch(
  () => route.fullPath,
  async () => {
    mobileNavOpen.value = false
    await nextTick()
    document.querySelector<HTMLElement>('#desktop-main h1')?.focus()
  },
)

useHead(() => ({
  title: organization.value ? `${organization.value.name} — Volley Time` : 'Volley Time',
}))
</script>

<template>
  <div class="vt-desktop">
    <a class="vt-desktop__skip" href="#desktop-main">К содержимому</a>

    <template v-if="!isLoading && access === 'ready' && organization">
      <aside class="vt-desktop__sidebar">
        <NuxtLink to="/app" class="vt-desktop__brand">
          <img src="/logo.png" alt="" width="32" height="32" />
          <span>Volley Time</span>
        </NuxtLink>
        <NuxtLink to="/app?choose=1" class="vt-desktop__org-switch">
          <span>{{ organization.name }}</span>
          <VtIcon name="chevron-r" :size="16" />
        </NuxtLink>
        <nav class="vt-desktop__nav" aria-label="Навигация по группе">
          <div class="vt-desktop__nav-heading">Организация</div>
          <NuxtLink
            v-for="item in items"
            :key="item.key"
            :to="item.to"
            :aria-current="isCurrent(item.to) ? 'page' : undefined"
          >
            <VtIcon
              :name="
                item.key === 'overview'
                  ? 'home'
                  : item.key === 'plans'
                    ? 'ticket'
                    : item.key === 'members'
                      ? 'users'
                      : item.key === 'payments'
                        ? 'card'
                        : item.key === 'cashbox'
                          ? 'wallet'
                          : item.key === 'settings'
                            ? 'settings'
                            : 'calendar'
              "
              :size="18"
            />
            {{ item.label }}
          </NuxtLink>
        </nav>
      </aside>

      <div class="vt-desktop__body" @keydown.esc="mobileNavOpen && closeMobileNav()">
        <header class="vt-desktop__topbar">
          <button
            ref="mobileMenuButton"
            type="button"
            class="vt-btn vt-btn--ghost vt-desktop__mobile-menu"
            :aria-expanded="mobileNavOpen"
            aria-controls="desktop-mobile-nav"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <VtIcon name="menu" :size="18" /> Меню
          </button>
          <p class="font-semibold">{{ organization.name }}</p>
          <NuxtLink to="/app?choose=1" class="vt-btn vt-btn--ghost vt-btn--sm"
            >Сменить группу</NuxtLink
          >
        </header>
        <nav
          v-show="mobileNavOpen"
          id="desktop-mobile-nav"
          class="vt-desktop__mobile-nav vt-desktop__nav"
          aria-label="Мобильная навигация по группе"
        >
          <NuxtLink
            v-for="item in items"
            :key="item.key"
            :to="item.to"
            :aria-current="isCurrent(item.to) ? 'page' : undefined"
            @click="mobileNavOpen = false"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
        <main id="desktop-main" class="vt-desktop__content" tabindex="-1">
          <slot />
        </main>
      </div>
    </template>

    <main v-else id="desktop-main" class="vt-desktop__entry" tabindex="-1">
      <p v-if="isLoading" role="status">Загружаем группу…</p>
      <section v-else-if="access === 'login'" class="vt-card p-6 space-y-4">
        <h1>Нужно войти</h1>
        <NuxtLink :to="desktopSignInPath(route.fullPath)" class="vt-btn vt-btn--primary"
          >Войти по email</NuxtLink
        >
      </section>
      <section v-else-if="access === 'suspended'" class="vt-card p-6 space-y-4" role="alert">
        <h1>Группа приостановлена</h1>
        <p>Сейчас открыть кабинет этой группы нельзя.</p>
        <NuxtLink to="/app" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
      </section>
      <section v-else-if="access === 'archived'" class="vt-card p-6 space-y-4" role="alert">
        <h1>Группа архивирована</h1>
        <p>Кабинет этой группы больше недоступен.</p>
        <NuxtLink to="/app?choose=1" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
      </section>
      <section v-else-if="access === 'denied'" class="vt-card p-6 space-y-4" role="alert">
        <h1>Нет доступа к кабинету</h1>
        <p>Кабинет доступен владельцу и организатору действующей группы.</p>
        <NuxtLink to="/app" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
      </section>
      <section v-else class="vt-card p-6 space-y-4" role="alert">
        <h1>Не удалось открыть группу</h1>
        <button type="button" class="vt-btn vt-btn--ghost" @click="refresh()">Повторить</button>
      </section>
    </main>
  </div>
</template>
