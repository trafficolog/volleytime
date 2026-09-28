<script setup lang="ts">
import '~/assets/css/landing-fonts.css'

useHead({ htmlAttrs: { class: 'vt-miniapp-page' } })
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink">
    <OfflineBanner />
    <slot />
  </div>
</template>
