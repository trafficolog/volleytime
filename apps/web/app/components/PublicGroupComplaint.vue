<script setup lang="ts">
import {
  GROUP_PAGE_COMPLAINT_DETAILS_MAX,
  GROUP_PAGE_COMPLAINT_REASONS,
  GROUP_PAGE_COMPLAINTS_PER_DAY,
  type GroupPageComplaintReason,
} from '@volley-time/shared'
import { computed, ref, useId } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import { apiErrorMessage } from '~/utils/api-error'

/**
 * «Пожаловаться на страницу» на публичной странице группы (24.1.3): без входа, пять причин,
 * подробности до 500 символов. Не больше 3 жалоб в сутки с устройства: сервер отвечает 429
 * `group_page.complaint_limited`. Организатор не узнаёт, кто пожаловался.
 */
const props = defineProps<{ slug: string }>()

const uid = useId()
const open = ref(false)
const reason = ref<GroupPageComplaintReason | null>(null)
const details = ref('')
const sent = ref(false)
const busy = ref(false)
const failure = ref('')

const title = computed(() => (sent.value ? 'Спасибо' : 'Пожаловаться на страницу'))
const sub = computed(() =>
  sent.value
    ? 'Модератор посмотрит в течение суток. Если нарушение подтвердится, страница изменится или исчезнет.'
    : 'Модератор VolleyTime проверит страницу. Организатор не узнает, кто отправил жалобу.',
)

function show() {
  sent.value = false
  failure.value = ''
  reason.value = null
  details.value = ''
  open.value = true
}

async function submit() {
  if (!reason.value || busy.value) return
  busy.value = true
  failure.value = ''
  try {
    await $fetch(`/api/public/groups/${encodeURIComponent(props.slug)}/complaints`, {
      method: 'POST',
      body: { reasonCode: reason.value, details: details.value.trim() || null },
    })
    sent.value = true
  } catch (e) {
    failure.value = apiErrorMessage(e, 'Не удалось отправить жалобу. Попробуйте ещё раз')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <p class="mt-6 flex flex-wrap items-center gap-3 text-[length:var(--fs-xs)] text-vt-mute-2">
    <span>Страница не похожа на правду?</span>
    <button
      type="button"
      class="vt-btn vt-btn--ghost vt-btn--sm"
      aria-haspopup="dialog"
      data-testid="complaint-open"
      @click="show"
    >
      <VtIcon name="alert" :size="13" /> Пожаловаться на страницу
    </button>
  </p>

  <VtDialog v-model="open" :title="title" :sub="sub" :busy="busy">
    <div v-if="sent" data-testid="complaint-sent" />
    <form v-else novalidate @submit.prevent="submit">
      <fieldset class="m-0 grid gap-1 border-0 p-0">
        <legend class="vt-label mb-2">Что не так</legend>
        <label
          v-for="r in GROUP_PAGE_COMPLAINT_REASONS"
          :key="r.code"
          class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 text-[length:var(--fs-sm)]"
          :class="reason === r.code ? 'bg-vt-bone-2' : ''"
        >
          <input
            v-model="reason"
            type="radio"
            :name="`${uid}-reason`"
            :value="r.code"
            :data-autofocus="r.code === GROUP_PAGE_COMPLAINT_REASONS[0].code ? '' : undefined"
            style="accent-color: var(--vt-flame)"
          />
          {{ r.title }}
        </label>
      </fieldset>
      <label class="vt-label mt-3 block" :for="`${uid}-details`">
        Подробности · необязательно
      </label>
      <textarea
        :id="`${uid}-details`"
        v-model="details"
        class="vt-field mt-1.5 box-border w-full resize-y px-3 py-2.5 text-[length:var(--fs-sm)]"
        rows="3"
        :maxlength="GROUP_PAGE_COMPLAINT_DETAILS_MAX"
        placeholder="Например: на странице 15 BYN, при записи списали 20"
      />
      <p class="mt-1 flex justify-between text-[length:var(--fs-2xs)] text-vt-mute-2">
        <span>Не больше {{ GROUP_PAGE_COMPLAINTS_PER_DAY }} жалоб в сутки</span>
        <span class="vt-mono">{{ details.length }} / {{ GROUP_PAGE_COMPLAINT_DETAILS_MAX }}</span>
      </p>
      <p
        v-if="failure"
        class="mt-3 text-[length:var(--fs-sm)] text-vt-rose-ink"
        role="alert"
        data-testid="complaint-error"
      >
        {{ failure }}
      </p>
    </form>

    <template #footer>
      <template v-if="sent">
        <button type="button" class="vt-btn vt-btn--ink vt-btn--sm" @click="open = false">
          Закрыть
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="busy"
          @click="open = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--sm"
          data-testid="complaint-submit"
          :disabled="!reason || busy"
          @click="submit"
        >
          Отправить жалобу
        </button>
      </template>
    </template>
  </VtDialog>
</template>
