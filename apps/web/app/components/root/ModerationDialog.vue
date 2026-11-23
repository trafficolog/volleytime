<script setup lang="ts">
import {
  GROUP_PAGE_MODERATION_NOTE_MAX,
  GROUP_PAGE_MODERATION_REASONS,
  type GroupPageModerationReason,
  type GroupPageModerationState,
  type PlatformGroupPageRow,
} from '@volley-time/shared'
import { computed, ref, useId, watch } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import VtIcon from '~/components/vt/Icon.vue'
import { apiErrorMessage, apiErrorStatus } from '~/utils/api-error'
import { botPreview, moderationFacts } from '~/utils/root-group-pages'

/**
 * Окно «Скрыть» / «Принудительный noindex» (24.1.3, R-06): обязательная причина (её видит
 * организатор), необязательное «Что исправить», «Что произойдёт» и превью сообщения бота.
 * С `complaintId` решение принимается из жалобы (`…/resolve`), иначе — по странице (`…/moderation`).
 */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{
  kind: GroupPageModerationState
  organizationId: number
  name: string
  city: string | null
  /** Причина, выбранная заранее (из жалобы или действующего решения). */
  preset?: GroupPageModerationReason | null
  presetNote?: string | null
  complaintId?: number | null
}>()
const emit = defineEmits<{ done: [page: PlatformGroupPageRow]; stale: [] }>()

const uid = useId()
const reason = ref<GroupPageModerationReason | null>(props.preset ?? null)
const note = ref(props.presetNote ?? '')
const busy = ref(false)
const failure = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = props.preset ?? null
  note.value = props.presetNote ?? ''
  failure.value = ''
})

const hide = computed(() => props.kind === 'hidden')
const title = computed(() =>
  hide.value ? `Скрыть страницу · ${props.name}` : `Принудительный noindex · ${props.name}`,
)
const sub = computed(() =>
  hide.value
    ? 'Страница перестанет открываться: по ссылке будет тот же 404, что у неопубликованной. Пропадёт из поиска, sitemap и каталога города.'
    : 'Страница откроется по ссылке, но получит noindex и пропадёт из sitemap и каталога города — даже если владелец включил индексацию.',
)
const facts = computed(() => moderationFacts(props.kind, props.city))
const reasonTitle = computed(
  () => GROUP_PAGE_MODERATION_REASONS.find((r) => r.code === reason.value)?.title ?? null,
)
const preview = computed(() => botPreview(props.kind, props.name, reasonTitle.value, note.value))

async function submit() {
  if (!reason.value || busy.value) return
  busy.value = true
  failure.value = ''
  const body = { state: props.kind, reasonCode: reason.value, note: note.value.trim() || null }
  try {
    if (props.complaintId) {
      const res = await $fetch<{ id: number; page: PlatformGroupPageRow }>(
        `/api/platform/group-page-complaints/${props.complaintId}/resolve`,
        { method: 'POST', body },
      )
      emit('done', res.page)
    } else {
      const page = await $fetch<PlatformGroupPageRow>(
        `/api/platform/group-pages/${props.organizationId}/moderation`,
        { method: 'POST', body },
      )
      emit('done', page)
    }
    open.value = false
  } catch (e) {
    failure.value = apiErrorMessage(e, 'Не удалось сохранить решение. Попробуйте ещё раз')
    // 409: состояние страницы или жалобы изменилось — список надо обновить
    if (apiErrorStatus(e) === 409) emit('stale')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VtDialog v-model="open" :title="title" :sub="sub" size="lg" :busy="busy">
    <form
      class="vt-mod-form"
      novalidate
      :aria-describedby="failure ? `${uid}-error` : undefined"
      @submit.prevent="submit"
    >
      <div>
        <fieldset class="vt-mod-fieldset">
          <legend class="vt-label">Причина · её увидит организатор</legend>
          <label
            v-for="r in GROUP_PAGE_MODERATION_REASONS"
            :key="r.code"
            class="vt-mod-reason"
            :data-selected="reason === r.code"
          >
            <input
              v-model="reason"
              type="radio"
              :name="`${uid}-reason`"
              :value="r.code"
              :data-autofocus="r.code === GROUP_PAGE_MODERATION_REASONS[0].code ? '' : undefined"
            />
            <span>
              <span class="vt-mod-reason__title">{{ r.title }}</span>
              <span class="vt-mod-reason__hint">{{ r.description }}</span>
            </span>
          </label>
        </fieldset>
        <label class="vt-label vt-mod-note-label" :for="`${uid}-note`">
          Что исправить · необязательно
        </label>
        <textarea
          :id="`${uid}-note`"
          v-model="note"
          class="vt-field vt-mod-textarea"
          rows="3"
          :maxlength="GROUP_PAGE_MODERATION_NOTE_MAX"
          placeholder="Конкретно: какой блок и что поменять"
        />
      </div>

      <div class="vt-mod-aside">
        <p class="vt-cap">Что произойдёт</p>
        <ul class="vt-mod-facts" aria-label="Что произойдёт">
          <li v-for="f in facts" :key="f.text" class="vt-mod-fact">
            <span class="vt-mod-fact__mark" :data-ok="f.ok" aria-hidden="true">
              <VtIcon :name="f.ok ? 'check' : 'close'" :size="11" :stroke-width="2.6" />
            </span>
            <span
              >{{ f.text }}<span class="sr-only">{{ f.ok ? ' — да' : ' — нет' }}</span></span
            >
          </li>
        </ul>
        <p class="vt-cap">Уведомление в бот</p>
        <div class="vt-bot" data-testid="bot-preview">
          <p class="vt-bot__who">
            <span class="vt-bot__avatar" aria-hidden="true"><VtIcon name="tg" :size="12" /></span>
            VolleyTime Bot
          </p>
          <div class="vt-bot__bubble">
            <b>{{ preview.title }}</b>
            <br />
            {{ preview.line }}
            <br />
            {{ preview.reason }}
            <template v-if="preview.note">
              <br />
              <span class="vt-bot__note">{{ preview.note }}</span>
            </template>
            <span class="vt-bot__btn">{{ preview.button }}</span>
          </div>
        </div>
      </div>
    </form>

    <p v-if="failure" :id="`${uid}-error`" class="vt-mod-error" role="alert">{{ failure }}</p>

    <template #footer>
      <span class="vt-mod-foot-hint">
        Сохраним, кто и когда, и запишем в журнал аудита. Вернуть можно в любой момент.
      </span>
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
        class="vt-btn vt-btn--sm"
        :class="hide ? 'vt-btn--rose' : 'vt-btn--ink'"
        data-testid="mod-submit"
        :disabled="!reason || busy"
        :aria-describedby="reason ? undefined : `${uid}-need-reason`"
        @click="submit"
      >
        {{ hide ? 'Скрыть страницу' : 'Закрыть от поиска' }}
      </button>
      <span v-if="!reason" :id="`${uid}-need-reason`" class="sr-only">Выберите причину</span>
    </template>
  </VtDialog>
</template>
