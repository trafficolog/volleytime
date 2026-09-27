<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Новая группа — Volley Time' })

const { create } = useOrganizations()
const name = ref('')
const city = ref('')
const submitting = ref(false)
const error = ref('')
const route = useRoute()
let alive = true
onBeforeUnmount(() => {
  alive = false
})

async function submit() {
  const expectedPath = route.path
  if (submitting.value) return
  if (name.value.trim().length < 2) {
    error.value = 'Название — минимум 2 символа'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const org = await create({ name: name.value.trim(), city: city.value.trim() || undefined })
    if (alive && route.path === expectedPath) await navigateTo(`/app/orgs/${org.id}`)
  } catch (e) {
    if (alive && route.path === expectedPath)
      error.value = apiErrorMessage(e, 'Не удалось создать группу')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="vt-desktop__entry space-y-6">
    <NuxtLink to="/app" class="vt-btn vt-btn--ghost">К группам</NuxtLink>
    <div class="vt-card p-6 space-y-5">
      <div class="space-y-2">
        <h1 class="text-3xl">Новая группа</h1>
        <p class="text-vt-mute-2">Вы станете владельцем группы.</p>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="desktop-org-name" class="vt-label">Название</label>
          <input
            id="desktop-org-name"
            v-model="name"
            class="vt-field"
            name="name"
            required
            minlength="2"
            maxlength="200"
            :aria-invalid="Boolean(error)"
            :aria-describedby="error ? 'desktop-org-error' : undefined"
          />
        </div>
        <div>
          <label for="desktop-org-city" class="vt-label">Город</label>
          <input
            id="desktop-org-city"
            v-model="city"
            class="vt-field"
            name="city"
            maxlength="120"
          />
        </div>
        <p v-if="error" id="desktop-org-error" role="alert" class="text-vt-rose-ink">{{ error }}</p>
        <button type="submit" class="vt-btn vt-btn--primary" :disabled="submitting">
          {{ submitting ? 'Создаём…' : 'Создать группу' }}
        </button>
      </form>
    </div>
  </main>
</template>
