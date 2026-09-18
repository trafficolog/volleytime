<script setup lang="ts">
definePageMeta({ layout: 'miniapp', middleware: ['auth'] })
const { create } = useOrganizations()
const name = ref('')
const city = ref('')
const submitting = ref(false)
const error = ref('')

async function onSubmit() {
  if (name.value.trim().length < 2) {
    error.value = 'Название — минимум 2 символа'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const org = await create({ name: name.value.trim(), city: city.value.trim() || undefined })
    await navigateTo(`/m/orgs/${org.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e, 'Не удалось создать группу')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader title="Новая группа" back="/m/orgs" />
    <main class="px-4 py-4">
      <p class="text-sm text-vt-mute-2 mb-4">
        Создайте группу, чтобы вести тренировки, состав и кассу. Вы станете её владельцем.
      </p>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <label class="vt-label" for="org-name">Название</label>
          <input
            id="org-name"
            v-model="name"
            required
            minlength="2"
            maxlength="200"
            class="vt-field"
            placeholder="Волейбол Минск"
          />
        </div>
        <div>
          <label class="vt-label" for="org-city">Город</label>
          <input
            id="org-city"
            v-model="city"
            class="vt-field"
            placeholder="Минск"
            maxlength="120"
          />
        </div>
        <p v-if="error" class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
        <button
          type="submit"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          :disabled="submitting"
        >
          {{ submitting ? 'Создаём…' : 'Создать группу' }}
        </button>
      </form>
    </main>
  </div>
</template>
