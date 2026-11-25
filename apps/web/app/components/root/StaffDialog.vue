<script setup lang="ts">
import type { PlatformRole, PlatformStaffMember } from '@volley-time/shared'
import { computed, ref, useId, watch } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { assignableRoles, roleInfo, staffErrorMessage } from '~/utils/root-team'

/**
 * Диалоги «Команда & роли» (29.3.1, R-15): пригласить, изменить роль, удалить из команды. Запрос
 * делает сам диалог: ошибка сервера остаётся видна в окне, закрывается оно только после успеха.
 */
export type StaffDialogResult =
  | { kind: 'invite'; member: PlatformStaffMember }
  | { kind: 'role'; member: PlatformStaffMember }
  | { kind: 'remove'; userId: number }

const API = '/api/platform/staff'
const open = defineModel<boolean>({ default: false })
const props = defineProps<{
  kind: 'invite' | 'role' | 'remove'
  /** Человек, над которым действие; для приглашения не нужен. */
  member?: PlatformStaffMember | null
}>()
const emit = defineEmits<{ done: [result: StaffDialogResult]; stale: [] }>()

const uid = useId()
const user = ref('')
const role = ref<PlatformRole | ''>('')
const busy = ref(false)
const failure = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = ''
  user.value = ''
  role.value = props.kind === 'role' ? (props.member?.role ?? '') : ''
})

const roles = computed(() =>
  assignableRoles(props.kind === 'role' ? (props.member?.role ?? null) : null),
)
const name = computed(() => props.member?.name ?? '')
const title = computed(() =>
  props.kind === 'invite'
    ? 'Пригласить в команду'
    : props.kind === 'role'
      ? `Роль · ${name.value}`
      : `Удалить ${name.value} из команды?`,
)
const sub = computed(() =>
  props.kind === 'invite'
    ? 'Человек должен уже быть в Volley Time. Одна роль, 2FA обязательна, запись в аудит'
    : props.kind === 'role'
      ? 'Права меняются сразу, запись в аудит'
      : 'Доступ к Root Admin пропадёт со следующего запроса. Запись попадёт в аудит',
)
const canSubmit = computed(() => {
  if (props.kind === 'remove') return true
  if (props.kind === 'invite') return user.value.trim() !== '' && role.value !== ''
  return role.value !== '' && role.value !== props.member?.role
})
const submitLabel = computed(() =>
  props.kind === 'invite' ? 'Пригласить' : props.kind === 'role' ? 'Сохранить' : 'Удалить',
)

async function submit() {
  if (busy.value || !canSubmit.value) return
  busy.value = true
  failure.value = ''
  try {
    if (props.kind === 'invite') {
      const member = await $fetch<PlatformStaffMember>(API, {
        method: 'POST',
        body: { user: user.value.trim(), role: role.value },
      })
      emit('done', { kind: 'invite', member })
    } else if (props.kind === 'role' && props.member) {
      const member = await $fetch<PlatformStaffMember>(`${API}/${props.member.userId}`, {
        method: 'PATCH',
        body: { role: role.value },
      })
      emit('done', { kind: 'role', member })
    } else if (props.member) {
      await $fetch(`${API}/${props.member.userId}`, { method: 'DELETE' })
      emit('done', { kind: 'remove', userId: props.member.userId })
    }
    open.value = false
  } catch (e) {
    failure.value = staffErrorMessage(e, 'Не удалось выполнить действие. Попробуйте ещё раз')
    if (apiErrorStatus(e) === 404 && apiErrorCode(e) === 'platform.staff_not_found') emit('stale')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VtDialog v-model="open" :title="title" :sub="sub" :busy="busy">
    <form
      class="vt-mod-form vt-root-team__form"
      novalidate
      :aria-describedby="failure ? `${uid}-error` : undefined"
      @submit.prevent="submit"
    >
      <div v-if="kind === 'invite'">
        <label class="vt-label" :for="`${uid}-user`">Email или Telegram-имя</label>
        <input
          :id="`${uid}-user`"
          v-model="user"
          class="vt-field"
          name="user"
          autocomplete="off"
          placeholder="name@example.com или @username"
          data-autofocus
        />
      </div>
      <fieldset v-if="kind !== 'remove'" class="vt-mod-fieldset">
        <legend class="vt-label">Роль</legend>
        <label
          v-for="r in roles"
          :key="r"
          class="vt-mod-reason"
          :data-selected="role === r"
        >
          <input v-model="role" type="radio" :name="`${uid}-role`" :value="r" />
          <span>
            <span class="vt-mod-reason__title">{{ roleInfo(r).label }} · {{ roleInfo(r).ru }}</span>
            <span class="vt-mod-reason__hint">{{ roleInfo(r).description }}</span>
          </span>
        </label>
      </fieldset>
      <p v-else class="vt-root-team__lead">
        {{ member?.email ?? (member?.telegramUsername ? `@${member.telegramUsername}` : '') }}
        · {{ member ? roleInfo(member.role).label : '' }}
      </p>
    </form>

    <p v-if="failure" :id="`${uid}-error`" class="vt-mod-error" role="alert">{{ failure }}</p>

    <template #footer>
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
        :class="kind === 'remove' ? 'vt-btn--danger' : 'vt-btn--ink'"
        data-testid="staff-submit"
        :disabled="busy || !canSubmit"
        @click="submit"
      >
        {{ busy ? 'Сохраняем…' : submitLabel }}
      </button>
    </template>
  </VtDialog>
</template>