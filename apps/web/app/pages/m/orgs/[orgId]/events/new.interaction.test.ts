// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watchEffect,
} from 'vue'

import NewEvent from './new.vue'

import { createMainButton } from '~/utils/telegram-shell'

// 21.1.2 (M-23): создание события и серии в Mini App организатора.
const route = reactive({ params: { orgId: '30' } })
const orgData = ref({
  organization: {
    id: 30,
    defaultTimezone: 'Europe/Minsk',
    defaultCurrency: 'BYN',
    subscriptionsEnabled: false,
  },
  capabilities: { eventSplitPricing: true, eventInviteMode: true },
  myMember: { role: 'organizer', status: 'active' },
})
const routerRoute = ref({ path: '/m/orgs/30/events/new' })
const navigateTo = vi.fn()
const telegram = reactive({ isTelegram: false, webApp: undefined as unknown })

vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ currentRoute: routerRoute }))
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useTelegram', () => ({
  isTelegram: computed(() => telegram.isTelegram),
  webApp: telegram.webApp,
}))
vi.stubGlobal('createMainButton', createMainButton)
for (const [name, fn] of Object.entries({
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watchEffect,
})) {
  vi.stubGlobal(name, fn)
}
vi.stubGlobal('useFetch', () => ({
  data: orgData,
  error: ref(null),
  status: ref('success'),
}))

// Заглушка формы повторяет её внешний контракт: пропсы, события и ссылка для MainButton.
const submit = vi.fn()
const FormStub = defineComponent({
  name: 'EventForm',
  props: { orgId: Number, allowSeries: Boolean, hideSubmit: Boolean, submitLabel: String },
  emits: ['saved', 'seriesCreated'],
  setup(props, { expose }) {
    expose({ submit, submitDisabled: false, submitText: 'Создать 14 событий', saving: false })
    return () =>
      h('form', { 'data-testid': 'event-form', 'data-series': String(props.allowSeries) }, [
        props.hideSubmit ? null : h('button', { type: 'submit' }, props.submitLabel),
      ])
  },
})

const result = {
  total: 14,
  published: 12,
  drafts: 2,
  venueConflicts: 2,
  balanceAfter: 18,
  replayed: false,
}

async function renderPage() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(NewEvent) }) })
  const wrapper = mount(host, {
    attachTo: document.body,
    global: {
      stubs: {
        VtMiniHeader: { template: '<header />' },
        EventForm: FormStub,
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        ErrorState: { props: ['message'], template: '<p role="alert">{{ message }}</p>' },
        EmptyState: { props: ['title'], template: '<p>{{ title }}</p>' },
        SkeletonList: { template: '<p>Loading</p>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function fakeWebApp() {
  return {
    MainButton: {
      setText: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
  }
}

beforeEach(() => {
  navigateTo.mockReset()
  submit.mockReset()
  route.params.orgId = '30'
  routerRoute.value = { path: '/m/orgs/30/events/new' }
  telegram.isTelegram = false
  telegram.webApp = undefined
  orgData.value = { ...orgData.value, myMember: { role: 'organizer', status: 'active' } }
})

describe('mini app event creation', () => {
  it('enables the series block and keeps the form button outside Telegram', async () => {
    const wrapper = await renderPage()
    expect(wrapper.get('[data-testid="event-form"]').attributes('data-series')).toBe('true')
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the series result with published and draft counts, then offers another one', async () => {
    const wrapper = await renderPage()
    wrapper.getComponent({ name: 'EventForm' }).vm.$emit('seriesCreated', result)
    await flushPromises()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
    const text = wrapper.text()
    expect(text).toContain('Серия создана')
    expect(text).toContain('опубликовано 12, черновиков 2')
    expect(text).toContain('Баланс событий: осталось 18')
    expect(wrapper.get('a').attributes('href')).toBe('/m/orgs/30/events')
    expect(navigateTo).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Создать ещё')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ignores a series result that arrives after leaving the form', async () => {
    const wrapper = await renderPage()
    const form = wrapper.getComponent({ name: 'EventForm' })
    routerRoute.value = { path: '/m/orgs/30/payments' }
    form.vm.$emit('seriesCreated', result)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Серия создана')
    wrapper.unmount()
  })

  it('drives creation from the Telegram MainButton and hides the form button there', async () => {
    const webApp = fakeWebApp()
    telegram.isTelegram = true
    telegram.webApp = webApp
    const wrapper = await renderPage()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(webApp.MainButton.setText).toHaveBeenLastCalledWith('Создать 14 событий')
    expect(webApp.MainButton.show).toHaveBeenCalled()
    const click = webApp.MainButton.onClick.mock.calls[0]![0] as () => void
    click()
    expect(submit).toHaveBeenCalledTimes(1)
    webApp.MainButton.hide.mockClear()
    wrapper.getComponent({ name: 'EventForm' }).vm.$emit('seriesCreated', result)
    await flushPromises()
    expect(webApp.MainButton.hide).toHaveBeenCalled()
    wrapper.unmount()
    expect(webApp.MainButton.offClick).toHaveBeenCalled()
  })

  it('shows no form to a player', async () => {
    orgData.value = { ...orgData.value, myMember: { role: 'player', status: 'active' } }
    const wrapper = await renderPage()
    expect(wrapper.find('[data-testid="event-form"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Создавать события могут организаторы')
    wrapper.unmount()
  })
})
