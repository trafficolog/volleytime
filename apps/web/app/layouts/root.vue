<script setup lang="ts">
import type { PlatformSettingsResponse } from '@volley-time/shared'

import { rootNavItems, type RootNavItem } from '~/utils/root-overview'

const route = useRoute()
const { user } = useAuth()
const items = rootNavItems()

const account = computed(() => user.value?.email ?? user.value?.name ?? 'root')

function isCurrent(item: RootNavItem) {
  const to = item.to ?? ''
  if (to === '/root') return route.path === to
  return [to, ...(item.alsoCurrent ?? [])].some((path) => route.path.startsWith(path))
}

// название платформы (22.3.1, `general.platformName`): шапка и `<title>` страниц /root; без ответа — "Volley Time"
const { data: platform } = useFetch<PlatformSettingsResponse>('/api/platform/settings', {
  key: 'root-platform-settings',
  lazy: true,
  server: false,
})
const platformName = computed(() => {
  const value = platform.value?.settings?.['general.platformName']?.value
  return typeof value === 'string' && value ? value : 'Volley Time'
})

useHead({
  title: 'Root Admin',
  titleTemplate: (title) => `${title ?? 'Root Admin'} · ${platformName.value}`,
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <div class="vt-root">
    <a class="vt-desktop__skip" href="#root-main">К содержимому</a>

    <aside class="vt-root__sidebar" aria-label="Боковая панель Root Admin">
      <NuxtLink to="/root" class="vt-root__brand">
        <img src="/logo/vt-mark-color.svg" alt="" width="32" height="32" />
        <span>
          <strong data-testid="root-platform-name">{{ platformName }}</strong>
          <small class="vt-mono">PLATFORM ROOT</small>
        </span>
      </NuxtLink>

      <div class="vt-root__warning" role="note">
        <p class="vt-cap">Внимание</p>
        <p>Действия здесь влияют на всех пользователей. Логируются.</p>
      </div>

      <nav class="vt-root__nav" aria-label="Разделы Root Admin">
        <template v-for="item in items" :key="item.key">
          <NuxtLink
            v-if="item.to"
            :to="item.to"
            :aria-current="isCurrent(item) ? 'page' : undefined"
          >
            <VtIcon :name="item.icon" :size="16" />
            {{ item.label }}
          </NuxtLink>
          <span v-else class="vt-root__nav-soon" aria-disabled="true">
            <VtIcon :name="item.icon" :size="16" />
            {{ item.label }}
          </span>
        </template>
      </nav>

      <NuxtLink to="/app" class="vt-root__exit">
        <VtIcon name="chevron-l" :size="16" /> В кабинет организатора
      </NuxtLink>
    </aside>

    <div class="vt-root__body">
      <header class="vt-root__topbar">
        <p class="vt-root__account">
          <VtIcon name="user" :size="16" />
          <span>{{ account }}</span>
        </p>
      </header>
      <main id="root-main" class="vt-root__content" tabindex="-1">
        <slot />
      </main>
    </div>
  </div>
</template>
