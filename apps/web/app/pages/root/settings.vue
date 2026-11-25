<script setup lang="ts">
import type {
  PlatformSettingKey,
  PlatformSettingsHistoryEntry,
  PlatformSettingsResponse,
} from '@volley-time/shared'

import StaffTeam from '~/components/root/StaffTeam.vue'
import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { rootOverviewFailure } from '~/utils/root-overview'
import {
  EDITABLE_KEYS,
  FIELD_LABELS,
  STALE_MESSAGE,
  fieldMessage,
  formFromSettings,
  historyRow,
  sectionChanges,
  sectionDirty,
  sectionErrors,
  sectionFromQuery,
  settingsSectionsFor,
  statusText,
  type EditableSection,
  type SettingsForm,
} from '~/utils/root-settings'

definePageMeta({ layout: 'root', middleware: ['root'] })

const API = '/api/platform/settings'
const toast = useToast()
const route = useRoute()
const router = useRouter()
// вкладки по роли (29.3.1, R-15): команда и безопасность — только Owner; сервер проверяет сам
const { data: me, refresh: refreshMe } = usePlatformStaffMe()
const sections = computed(() => settingsSectionsFor(me.value ?? null))
const section = computed(() => sectionFromQuery(route.query.section, sections.value))
// заголовок страницы; название платформы добавляет шаблон заголовка в layout `root`
useHead({ title: 'Настройки — Root Admin' })

const { data, pending, error, refresh } = await useFetch<PlatformSettingsResponse>(API, {
  key: 'root-platform-settings',
})

/** Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход. */
function reactToStatus(status: number | undefined): boolean {
  const reaction = rootOverviewFailure(status)
  if (reaction === 'forbidden') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Нет доступа к разделу',
      fatal: true,
    })
  }
  if (reaction === 'login') {
    void navigateTo('/auth/login')
    return true
  }
  return false
}
reactToStatus(apiErrorStatus(error.value))

/** Последний известный ответ сервера: версии для следующей правки и значения для сравнения. */
const state = ref<PlatformSettingsResponse | null>(data.value ?? null)
const form = reactive<SettingsForm>(
  state.value ? formFromSettings(state.value) : ({} as SettingsForm),
)
const errors = ref<Partial<Record<PlatformSettingKey, string>>>({})
const failure = ref('')
const notice = ref('')
const saving = ref(false)

function adopt(next: PlatformSettingsResponse) {
  state.value = next
  Object.assign(form, formFromSettings(next))
  errors.value = {}
}

const history = ref<PlatformSettingsHistoryEntry[]>([])
async function loadHistory() {
  try {
    history.value = (
      await $fetch<{ entries: PlatformSettingsHistoryEntry[] }>(`${API}/history`)
    ).entries
  } catch {
    // история — справочная: основной экран работает без неё
  }
}
onMounted(() => void loadHistory())
const historyRows = computed(() => history.value.map(historyRow))

function selectSection(next: string) {
  if (!sections.value.some((s) => s.key === next)) return
  failure.value = ''
  notice.value = ''
  void router.push({ query: next === 'general' ? {} : { section: next } })
}

/** Owner сменил свою роль или убрал себя: меню читаем заново, из Root Admin выходим. */
async function onSelfChanged(reason: 'role' | 'removed') {
  if (reason === 'removed') {
    await navigateTo('/app')
    return
  }
  await refreshMe()
}

const editable = computed<EditableSection | null>(() =>
  section.value === 'general' || section.value === 'limits' ? section.value : null,
)
const dirty = computed(() =>
  editable.value && state.value ? sectionDirty(editable.value, form, state.value) : false,
)

async function save() {
  const sec = editable.value
  if (!sec || !state.value || saving.value) return
  failure.value = ''
  notice.value = ''
  errors.value = sectionErrors(sec, form)
  if (Object.keys(errors.value).length) return
  const changes = sectionChanges(sec, form, state.value)
  if (!changes.length) return
  saving.value = true
  try {
    adopt(await $fetch<PlatformSettingsResponse>(API, { method: 'PATCH', body: { changes } }))
    toast.show('Настройки сохранены')
    void loadHistory()
  } catch (e) {
    const status = apiErrorStatus(e)
    if (reactToStatus(status)) return
    const code = apiErrorCode(e)
    const current = (e as { data?: { data?: { current?: PlatformSettingsResponse } } })?.data?.data
      ?.current
    if (status === 409 && code === 'platform_settings.stale') {
      if (current) adopt(current)
      else await refresh()
      failure.value = STALE_MESSAGE
    } else if (status === 422) {
      // сервер называет ключ в пути ошибки: показываем сообщение у поля
      const text = JSON.stringify((e as { data?: unknown }).data ?? '')
      const keys = (EDITABLE_KEYS[sec] as readonly PlatformSettingKey[]).filter((k) =>
        text.includes(k),
      )
      for (const k of keys) errors.value[k] = fieldMessage(k)
      if (!keys.length) failure.value = 'Проверьте значения полей'
    } else {
      failure.value = 'Не удалось сохранить настройки. Попробуйте ещё раз'
    }
  } finally {
    saving.value = false
  }
}

function reset() {
  if (state.value) adopt(state.value)
  failure.value = ''
}

const FLAG_LABELS: Record<string, string> = {
  EVENT_BALANCE_ENFORCED: 'Списание баланса событий при публикации',
  COLLECTIONS_ENABLED: 'Сборы',
  EVENT_INVITE_MODE_ENABLED: 'Запись по приглашениям',
  EVENT_MULTI_SEAT_ENABLED: 'Несколько мест в записи',
  EVENT_SPLIT_PRICING_ENABLED: 'Оплата вскладчину',
  SCHEDULER_ENABLED: 'Планировщик событий',
  TELEGRAM_LOGIN_WIDGET_ENABLED: 'Вход через Telegram Login Widget',
}
</script>

<template>
  <div class="vt-root-billing vt-root-settings">
    <header class="vt-root-billing__head">
      <div>
        <h1 tabindex="-1">
          Настройки <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p class="vt-root-billing__hint">Глобальные параметры платформы</p>
      </div>
    </header>

    <SkeletonList v-if="pending && !state" :count="3" />
    <ErrorState
      v-else-if="error && !state"
      message="Не удалось загрузить настройки"
      @retry="refresh()"
    />
    <div v-else-if="state" class="vt-root-settings__layout">
      <nav class="vt-root-settings__nav" aria-label="Разделы настроек">
        <button
          v-for="s in sections"
          :key="s.key"
          type="button"
          class="vt-root-settings__tab"
          :aria-current="section === s.key ? 'page' : undefined"
          :data-testid="`settings-tab-${s.key}`"
          @click="selectSection(s.key)"
        >
          {{ s.label }}
        </button>
      </nav>

      <div class="vt-root-settings__main">
        <p v-if="failure" class="vt-root-settings__alert" role="alert">{{ failure }}</p>

        <!-- Общие -->
        <form
          v-if="section === 'general'"
          class="vt-card vt-root-billing__card"
          novalidate
          aria-labelledby="settings-general"
          @submit.prevent="save"
        >
          <h2 id="settings-general">Общие</h2>
          <div class="vt-root-billing__grid">
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['general.platformName'] }}</span>
              <input
                v-model="form['general.platformName']"
                class="vt-field"
                name="platformName"
                maxlength="60"
                autocomplete="off"
                :aria-invalid="errors['general.platformName'] ? 'true' : undefined"
                aria-describedby="platformName-hint"
              />
              <span
                id="platformName-hint"
                :class="
                  errors['general.platformName']
                    ? 'vt-root-billing__error'
                    : 'vt-root-billing__hint'
                "
              >
                {{
                  errors['general.platformName'] ?? 'Показывается в шапке и заголовке Root Admin'
                }}
              </span>
            </label>
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['general.supportContact'] }}</span>
              <input
                v-model="form['general.supportContact']"
                class="vt-field"
                name="supportContact"
                maxlength="120"
                autocomplete="off"
                placeholder="Напр. @volleytime_support"
                :aria-invalid="errors['general.supportContact'] ? 'true' : undefined"
                aria-describedby="supportContact-hint"
              />
              <span
                id="supportContact-hint"
                :class="
                  errors['general.supportContact']
                    ? 'vt-root-billing__error'
                    : 'vt-root-billing__hint'
                "
              >
                {{
                  errors['general.supportContact'] ??
                  'Строка «Вопросы по оплате — …» на странице баланса кабинета; пусто — не показывать'
                }}
              </span>
            </label>
            <div class="vt-root-billing__field">
              <span class="vt-label">Валюта</span>
              <p class="vt-root-settings__static vt-mono">
                {{ state.readonly.payments.currency }}
              </p>
            </div>
            <div class="vt-root-billing__field">
              <span class="vt-label">Регион / часовой пояс</span>
              <p class="vt-root-settings__static">Беларусь · {{ state.readonly.general.region }}</p>
            </div>
          </div>
          <div class="vt-root-billing__form-actions">
            <button
              type="submit"
              class="vt-btn vt-btn--primary vt-btn--sm"
              :disabled="!dirty || saving"
            >
              <VtIcon name="check" :size="14" /> {{ saving ? 'Сохраняем…' : 'Сохранить' }}
            </button>
            <button
              v-if="dirty"
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="saving"
              @click="reset"
            >
              Отмена
            </button>
          </div>
        </form>

        <!-- Команда & роли (29.3.1, R-15) -->
        <StaffTeam
          v-else-if="section === 'team' && me"
          :self-id="me.userId"
          @self-changed="onSelfChanged"
        />

        <!-- Платежи -->
        <section
          v-else-if="section === 'payments'"
          class="vt-card vt-root-billing__card"
          aria-labelledby="settings-payments"
        >
          <h2 id="settings-payments">Платежи</h2>
          <dl class="vt-root-settings__status">
            <dt>Модель оплаты</dt>
            <dd>Заявки организаций, ручное подтверждение</dd>
            <dt>Онлайн-оплата</dt>
            <dd>Не подключена</dd>
            <dt>Валюта</dt>
            <dd class="vt-mono">{{ state.readonly.payments.currency }}</dd>
            <dt>Реквизиты</dt>
            <dd>Не заданы</dd>
          </dl>
        </section>

        <!-- Уведомления -->
        <section
          v-else-if="section === 'notifications'"
          class="vt-card vt-root-billing__card"
          aria-labelledby="settings-notifications"
        >
          <h2 id="settings-notifications">Уведомления</h2>
          <p class="vt-root-billing__hint">Скоро</p>
        </section>

        <!-- Лимиты -->
        <form
          v-else-if="section === 'limits'"
          class="vt-card vt-root-billing__card"
          novalidate
          aria-labelledby="settings-limits"
          @submit.prevent="save"
        >
          <h2 id="settings-limits">Лимиты</h2>
          <div class="vt-root-billing__grid">
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['eventBalance.newOrganizationGrant'] }}</span>
              <input
                v-model="form['eventBalance.newOrganizationGrant']"
                class="vt-field vt-mono"
                name="newOrganizationGrant"
                inputmode="numeric"
                autocomplete="off"
                :aria-invalid="errors['eventBalance.newOrganizationGrant'] ? 'true' : undefined"
                aria-describedby="newOrganizationGrant-hint"
              />
              <span
                id="newOrganizationGrant-hint"
                :class="
                  errors['eventBalance.newOrganizationGrant']
                    ? 'vt-root-billing__error'
                    : 'vt-root-billing__hint'
                "
              >
                {{
                  errors['eventBalance.newOrganizationGrant'] ??
                  'Начисляется при создании группы; уже созданные группы не меняются'
                }}
              </span>
            </label>
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['events.maxPublishedPerDay'] }}</span>
              <input
                v-model="form['events.maxPublishedPerDay']"
                class="vt-field vt-mono"
                name="maxPublishedPerDay"
                inputmode="numeric"
                autocomplete="off"
                placeholder="Без лимита"
                :aria-invalid="errors['events.maxPublishedPerDay'] ? 'true' : undefined"
                aria-describedby="maxPublishedPerDay-hint"
              />
              <span
                id="maxPublishedPerDay-hint"
                :class="
                  errors['events.maxPublishedPerDay']
                    ? 'vt-root-billing__error'
                    : 'vt-root-billing__hint'
                "
              >
                {{
                  errors['events.maxPublishedPerDay'] ??
                  'Опубликованные, закрытые и завершённые события в один день группы; пусто — без лимита'
                }}
              </span>
            </label>
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['bot.callbackLimit'] }}</span>
              <input
                v-model="form['bot.callbackLimit']"
                class="vt-field vt-mono"
                name="callbackLimit"
                inputmode="numeric"
                autocomplete="off"
                :aria-invalid="errors['bot.callbackLimit'] ? 'true' : undefined"
                aria-describedby="callbackLimit-hint"
              />
              <span
                id="callbackLimit-hint"
                :class="
                  errors['bot.callbackLimit'] ? 'vt-root-billing__error' : 'vt-root-billing__hint'
                "
              >
                {{ errors['bot.callbackLimit'] ?? 'Нажатия inline-кнопок на пользователя' }}
              </span>
            </label>
            <label class="vt-root-billing__field">
              <span class="vt-label">{{ FIELD_LABELS['bot.callbackWindowSeconds'] }}</span>
              <input
                v-model="form['bot.callbackWindowSeconds']"
                class="vt-field vt-mono"
                name="callbackWindowSeconds"
                inputmode="numeric"
                autocomplete="off"
                :aria-invalid="errors['bot.callbackWindowSeconds'] ? 'true' : undefined"
                aria-describedby="callbackWindowSeconds-hint"
              />
              <span
                id="callbackWindowSeconds-hint"
                :class="
                  errors['bot.callbackWindowSeconds']
                    ? 'vt-root-billing__error'
                    : 'vt-root-billing__hint'
                "
              >
                {{ errors['bot.callbackWindowSeconds'] ?? 'Окно подсчёта нажатий, секунд' }}
              </span>
            </label>
          </div>
          <p class="vt-root-billing__hint" data-testid="settings-apply-delay">
            Применяется в течение минуты
          </p>
          <p class="vt-root-billing__hint">
            Безлимит событий для отдельной группы настраивается в карточке организации.
          </p>
          <div class="vt-root-billing__form-actions">
            <button
              type="submit"
              class="vt-btn vt-btn--primary vt-btn--sm"
              :disabled="!dirty || saving"
            >
              <VtIcon name="check" :size="14" /> {{ saving ? 'Сохраняем…' : 'Сохранить' }}
            </button>
            <button
              v-if="dirty"
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="saving"
              @click="reset"
            >
              Отмена
            </button>
          </div>
        </form>

        <!-- Безопасность -->
        <section
          v-else-if="section === 'security'"
          class="vt-card vt-root-billing__card"
          aria-labelledby="settings-security"
        >
          <h2 id="settings-security">Безопасность</h2>
          <dl class="vt-root-settings__status">
            <dt>Ограничение частоты входа</dt>
            <dd>{{ statusText(state.readonly.security.authRateLimit) }}</dd>
            <dt>Журнал действий Root Admin</dt>
            <dd>{{ statusText(state.readonly.security.rootAuditLog) }}</dd>
            <dt>Доверенный прокси</dt>
            <dd>{{ statusText(state.readonly.security.trustedProxy) }}</dd>
          </dl>
        </section>

        <!-- Интеграции -->
        <section
          v-else-if="section === 'integrations'"
          class="vt-card vt-root-billing__card"
          aria-labelledby="settings-integrations"
        >
          <h2 id="settings-integrations">Интеграции</h2>
          <dl class="vt-root-settings__status">
            <dt>Telegram-бот</dt>
            <dd>{{ statusText(state.readonly.integrations.telegramBot) }}</dd>
            <dt>Вход через Telegram</dt>
            <dd>{{ statusText(state.readonly.integrations.telegramLoginWidget) }}</dd>
            <dt>Почта (коды входа)</dt>
            <dd>{{ statusText(state.readonly.integrations.smtp) }}</dd>
            <dt>Sentry</dt>
            <dd>{{ statusText(state.readonly.integrations.sentry) }}</dd>
            <dt>Планировщик</dt>
            <dd>{{ statusText(state.readonly.integrations.scheduler) }}</dd>
          </dl>
          <h3 class="vt-root-settings__subtitle">Feature flags</h3>
          <p class="vt-root-billing__hint">Меняются в конфигурации сервера</p>
          <dl class="vt-root-settings__status" data-testid="settings-flags">
            <template v-for="flag in state.readonly.featureFlags" :key="flag.name">
              <dt>{{ FLAG_LABELS[flag.name] ?? flag.name }}</dt>
              <dd>{{ flag.enabled ? 'включён' : 'выключен' }}</dd>
            </template>
          </dl>
        </section>

        <section
          v-if="editable"
          class="vt-card vt-root-billing__card"
          aria-labelledby="settings-history"
        >
          <h2 id="settings-history">Последние изменения</h2>
          <p v-if="!historyRows.length" class="vt-root-billing__hint">Изменений пока не было</p>
          <ol v-else class="vt-root-settings__history" data-testid="settings-history">
            <li v-for="row in historyRows" :key="row.id">
              <span class="vt-mono vt-root-billing__muted">{{
                new Date(row.when).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })
              }}</span>
              <span>{{ row.who }}</span>
              <span>{{ row.label }}: {{ row.from }} → {{ row.to }}</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>
