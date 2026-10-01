// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import DesktopManage from './index.vue'

import EventPricingPanel from '~/components/EventPricingPanel.vue'

const path = '/app/orgs/30/events/71'
const route = reactive({ params: { orgId: '30', eventId: '71' }, path, fullPath: path })
const routerRoute = ref({ params: { orgId: '30', eventId: '71' }, path, fullPath: path })
const pricing = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 1,
  minAmount: 10000,
  maxAmount: 10000,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
const event = {
  id: 71,
  organizationId: 30,
  title: 'Split',
  startsAt: '2027-10-01T12:00:00Z',
  status: 'published',
  capacity: 4,
  taken: 1,
  waitlist: 0,
  currency: 'BYN',
  pricing,
  pricingPermissions: { canChangePriceMode: false, canChangeTargetAmount: true, canSettle: true },
}
const refresh = vi.fn()
let resolvePost: (() => void) | undefined
let fail = false
let hold = false
const apiFetch = vi.fn(async (url: string, opts?: { method?: string }) => {
  if (!opts?.method) return { bookings: [] }
  if (fail) throw new Error('conflict')
  if (hold)
    await new Promise<void>((resolve) => {
      resolvePost = resolve
    })
  return {}
})
const confirm = vi.fn(() => true)
Object.entries({
  computed,
  ref,
  watch,
  onBeforeUnmount,
  useRoute: () => route,
  useRouter: () => ({ currentRoute: routerRoute }),
  definePageMeta: () => undefined,
  useOrgTimezone: () => ({ tz: ref('Europe/Minsk') }),
  useFetch: async () => ({ data: ref({ event }), pending: ref(false), error: ref(null), refresh }),
  $fetch: apiFetch,
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}).forEach(([key, value]) => vi.stubGlobal(key, value))

async function render() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(DesktopManage) }) }),
    {
      global: {
        components: { EventPricingPanel },
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          VtAvatar: true,
          SkeletonList: true,
          ErrorState: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  Object.assign(route, { params: { orgId: '30', eventId: '71' }, path, fullPath: path })
  routerRoute.value = { params: { orgId: '30', eventId: '71' }, path, fullPath: path }
  vi.stubGlobal('confirm', confirm)
  confirm.mockReset().mockReturnValue(true)
  apiFetch.mockClear()
  refresh.mockClear()
  fail = false
  hold = false
})
describe('desktop settlement full route and lifecycle', () => {
  it.each(['edit', 'org', 'event', 'query', 'unmount'])(
    'refuses POST when confirmation leaves %s',
    async (change) => {
      const wrapper = await render()
      confirm.mockImplementationOnce(() => {
        if (change === 'unmount') wrapper.unmount()
        else
          routerRoute.value = {
            params: {
              orgId: change === 'org' ? '31' : '30',
              eventId: change === 'event' ? '72' : '71',
            },
            path: change === 'edit' ? `${path}/edit` : path,
            fullPath:
              change === 'query'
                ? `${path}?other=1`
                : change === 'edit'
                  ? `${path}/edit`
                  : '/app/orgs/31/events/72',
          }
        return true
      })
      const button = wrapper
        .findAll('button')
        .find((b) => b.text() === 'Закрыть запись и распределить')
      expect(button).toBeDefined()
      await button!.trigger('click')
      await flushPromises()
      expect(apiFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0)
      if (change !== 'unmount') wrapper.unmount()
    },
  )
  it('sends one POST for double activation and ignores late results after route change', async () => {
    const wrapper = await render()
    hold = true
    const button = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Закрыть запись и распределить')
    expect(button).toBeDefined()
    await button!.trigger('click')
    await button!.trigger('click')
    expect(
      apiFetch.mock.calls.filter(
        ([url, opts]) => url.endsWith('/settle') && opts?.method === 'POST',
      ),
    ).toHaveLength(1)
    routerRoute.value.fullPath = `${path}/edit`
    resolvePost?.()
    await flushPromises()
    expect(refresh).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows actionable failure and retries GET without replacing existing content with emptiness', async () => {
    const wrapper = await render()
    fail = true
    const button = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Закрыть запись и распределить')
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Обновите событие')
    expect(wrapper.text()).toContain('100,00')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Обновить событие')!
      .trigger('click')
    expect(refresh).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
