<script setup lang="ts">
import type { InvitePreview } from '@volley-time/core'
import { ROLE_LABELS, displayName, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp', middleware: ['auth'] })

const route = useRoute()
const token = computed(() => String(route.params.token))

const {
  data,
  error: loadError,
  refresh,
} = await useFetch<InvitePreview>(() => `/api/invites/${encodeURIComponent(token.value)}`)
const preview = computed(() => data.value)
const org = computed(() => preview.value?.organization ?? null)
const mine = computed(() => preview.value?.myMembership ?? null)

type ScreenState = 'invite' | 'member' | 'applied' | 'invalid' | 'blocked'
const joined = ref<'active' | 'pending' | null>(null)
const state = computed<ScreenState>(() => {
  if (joined.value === 'pending') return 'applied'
  if (mine.value?.status === 'active') return 'member'
  if (mine.value?.status === 'pending') return 'applied'
  if (mine.value?.status === 'blocked') return 'blocked'
  if (!preview.value || preview.value.status !== 'valid') return 'invalid'
  return 'invite'
})

const INVALID_REASON: Record<string, string> = {
  revoked: 'Организатор отозвал эту ссылку.',
  expired: 'Срок действия ссылки истёк.',
  exhausted: 'По этой ссылке уже вступило максимальное число участников.',
  not_found: 'Ссылка не найдена или группа больше не существует.',
}

const joining = ref(false)
const joinError = ref('')
const { haptic, isTelegram, useMainButton } = useTelegram()

async function join() {
  joining.value = true
  joinError.value = ''
  try {
    const res = await $fetch<{ member: { status: 'active' | 'pending' } }>(
      `/api/invites/${encodeURIComponent(token.value)}/redeem`,
      { method: 'POST' },
    )
    haptic('success')
    if (res.member.status === 'active' && org.value) {
      await navigateTo(`/m/orgs/${org.value.id}`)
    } else {
      joined.value = 'pending'
    }
  } catch (e) {
    haptic('error')
    const code = apiErrorCode(e)
    if (code === 'member.already_exists') await refresh()
    else if (code?.startsWith('invite.')) await refresh()
    else joinError.value = apiErrorMessage(e, 'Не удалось вступить. Попробуйте ещё раз.')
  } finally {
    joining.value = false
  }
}

let mainButtonCleanup: (() => void) | undefined
function syncMainButton() {
  mainButtonCleanup?.()
  mainButtonCleanup = undefined
  if (!isTelegram.value || state.value !== 'invite') return
  mainButtonCleanup = useMainButton(
    preview.value?.requiresApproval ? 'Отправить заявку' : 'Вступить в группу',
    () => {
      void join()
    },
  )
}
onMounted(syncMainButton)
watch(state, syncMainButton)
onUnmounted(() => mainButtonCleanup?.())

const extraMembers = computed(() =>
  org.value ? Math.max(0, org.value.membersCount - org.value.avatars.length) : 0,
)
const membersLabel = computed(() => {
  const n = org.value?.membersCount ?? 0
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'участник'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'участника'
        : 'участников'
  return `${n} ${word}`
})
</script>

<template>
  <div class="min-h-screen flex flex-col px-5 py-6">
    <div class="text-center pb-4">
      <span class="vt-chip"><VtIcon name="tg" :size="11" /> Приглашение</span>
    </div>

    <ErrorState v-if="loadError" message="Не удалось открыть приглашение" @retry="refresh()" />

    <template v-else-if="state === 'invalid' || state === 'blocked'">
      <EmptyState
        icon="alert"
        :title="state === 'blocked' ? 'Доступ в группу закрыт' : 'Приглашение недействительно'"
        :description="
          state === 'blocked'
            ? 'Организатор ограничил ваш доступ. Свяжитесь с ним, если это ошибка.'
            : INVALID_REASON[preview?.status ?? 'not_found']
        "
      >
        <template #action>
          <NuxtLink to="/m/orgs" class="vt-btn vt-btn--primary">Мои группы</NuxtLink>
          <p v-if="state === 'invalid'" class="text-xs text-vt-mute-2 max-w-xs">
            Попросите организатора прислать новую ссылку.
          </p>
        </template>
      </EmptyState>
    </template>

    <template v-else-if="org">
      <div class="vt-card p-6 text-center">
        <img
          src="/logo.png"
          alt=""
          width="56"
          height="56"
          class="mx-auto rounded-full bg-white p-1.5"
        />
        <h1 class="font-display font-bold text-[22px] mt-3.5 tracking-tight">{{ org.name }}</h1>
        <p class="text-[13px] text-vt-mute-2 mt-1.5">
          {{ membersLabel }}<template v-if="org.city"> · {{ org.city }}</template>
        </p>
        <div v-if="org.avatars.length" class="flex justify-center mt-4">
          <div class="vt-stack">
            <VtAvatar
              v-for="(a, i) in org.avatars"
              :key="i"
              :name="displayName(a)"
              :src="a.image"
            />
            <span v-if="extraMembers > 0" class="vt-avi">+{{ extraMembers }}</span>
          </div>
        </div>
        <template v-if="preview?.inviter">
          <div class="vt-divider my-5" />
          <div class="text-left">
            <div class="vt-cap mb-1.5">Вас пригласил</div>
            <div class="flex items-center gap-2.5">
              <VtAvatar size="sm" :name="displayName(preview.inviter)" />
              <div class="text-[13px] font-medium">
                {{ displayName(preview.inviter) }}
                <template v-if="preview.inviter.role">
                  · {{ label(ROLE_LABELS, preview.inviter.role).toLowerCase() }}</template
                >
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="state === 'member'" class="mt-5 text-center" role="status">
        <VtChip tone="grass" dot>Вы уже в группе</VtChip>
        <NuxtLink
          :to="`/m/orgs/${org.id}`"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full mt-4"
        >
          Открыть группу
        </NuxtLink>
      </div>

      <div v-else-if="state === 'applied'" class="mt-5 text-center" role="status">
        <VtChip tone="amber" dot>Заявка отправлена</VtChip>
        <p class="text-[13px] text-vt-mute-2 mt-3">
          Организатор рассмотрит заявку. Мы пришлём уведомление в Telegram, когда вас примут.
        </p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full mt-4">Мои группы</NuxtLink>
      </div>

      <template v-else>
        <p class="mt-4 text-[12.5px] text-vt-mute-2 leading-relaxed">
          <template v-if="preview?.requiresApproval">
            В группу вступают после одобрения организатором.
          </template>
          Вступая, вы сможете записываться на тренировки, видеть состав и оплачивать участие
          абонементом или организатору.
          <template v-if="preview?.roleToAssign && preview.roleToAssign !== 'player'">
            Роль в группе: {{ label(ROLE_LABELS, preview.roleToAssign).toLowerCase() }}.
          </template>
        </p>
        <p v-if="joinError" class="mt-3 text-sm text-vt-rose-ink" role="alert">{{ joinError }}</p>
        <div class="mt-auto pt-5 flex flex-col gap-2">
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
            :disabled="joining"
            @click="join"
          >
            {{
              joining
                ? 'Вступаем…'
                : preview?.requiresApproval
                  ? 'Отправить заявку'
                  : 'Вступить в группу'
            }}
          </button>
          <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full">Решить позже</NuxtLink>
        </div>
      </template>
    </template>
  </div>
</template>
