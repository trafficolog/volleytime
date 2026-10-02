// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense } from 'vue'

import DesktopEdit from './edit.vue'

import ErrorState from '~/components/ErrorState.vue'
import EventForm from '~/components/EventForm.vue'
import SkeletonList from '~/components/SkeletonList.vue'

describe('desktop event edit recovery', () => {
  it('restores the real form after retrying a failed organization GET and waits for both resources', async () => {
    const route = reactive({
      params: { orgId: '30', eventId: '71' },
      path: '/app/orgs/30/events/71/edit',
    })
    const organization = {
      organization: { id: 30, currency: 'BYN', subscriptionsEnabled: false },
      myMember: { role: 'owner', status: 'active' },
      capabilities: { eventSplitPricing: true },
    }
    const orgData = ref<typeof organization | null>(null)
    const orgError = ref<Error | null>(new Error('temporary organization outage'))
    const orgPending = ref(false)
    const eventPending = ref(false)
    let completeOrg: (() => void) | undefined
    let completeEvent: (() => void) | undefined
    const refreshOrg = vi.fn(async () => {
      orgPending.value = true
      await new Promise<void>((resolve) => (completeOrg = resolve))
      orgData.value = organization
      orgError.value = null
      orgPending.value = false
    })
    const refreshEvent = vi.fn(async () => {
      eventPending.value = true
      await new Promise<void>((resolve) => (completeEvent = resolve))
      eventPending.value = false
    })
    const event = {
      id: 71,
      organizationId: 30,
      title: 'Training',
      startsAt: '2027-10-01T12:00:00Z',
      endsAt: '2027-10-01T14:00:00Z',
      capacity: 4,
      price: 1500,
      priceMode: 'fixed',
      targetAmount: null,
      currency: 'BYN',
      status: 'published',
      venueId: null,
      locationText: null,
      description: null,
      cancellationDeadlineHours: 6,
      pricingPermissions: {
        canChangePriceMode: true,
        canChangeTargetAmount: false,
        canSettle: false,
      },
    }
    Object.entries({
      computed,
      reactive,
      ref,
      onBeforeUnmount,
      useRoute: () => route,
      definePageMeta: () => undefined,
      useOrgTimezone: () => ({ tz: ref('Europe/Minsk'), load: async () => undefined }),
      $fetch: async () => ({ venues: [] }),
      useFetch: async (url: () => string) =>
        url().endsWith('/30')
          ? { data: orgData, error: orgError, pending: orgPending, refresh: refreshOrg }
          : {
              data: ref({ event }),
              error: ref(null),
              pending: eventPending,
              refresh: refreshEvent,
            },
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(DesktopEdit) }) }),
      {
        global: {
          components: { ErrorState, EventForm, SkeletonList },
          stubs: {
            NuxtLink: { template: '<a><slot /></a>' },
            VtIcon: true,
          },
        },
      },
    )
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось открыть событие')
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(refreshOrg).toHaveBeenCalledOnce()
    expect(refreshEvent).toHaveBeenCalledOnce()
    expect(wrapper.get('[aria-busy="true"]').attributes('aria-label')).toBe('Загрузка')
    completeEvent?.()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    completeOrg?.()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    expect((wrapper.get('#ev-price').element as HTMLInputElement).value).toBe('15')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
