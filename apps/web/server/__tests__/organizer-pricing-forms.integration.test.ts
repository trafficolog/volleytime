// @vitest-environment happy-dom
import { organizationService } from '@volley-time/core'
import { bookings, closeDb, db, organizations, users } from '@volley-time/db'
import { flushPromises, mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onUnmounted,
  reactive,
  ref,
  Suspense,
} from 'vue'

import EventForm from '../../app/components/EventForm.vue'
import DesktopEdit from '../../app/pages/app/orgs/[orgId]/events/[eventId]/edit.vue'
import MiniEdit from '../../app/pages/m/orgs/[orgId]/events/[eventId]/edit.vue'

import { createTestApi } from './harness'

describe('real manager API through both organizer edit forms (5.16.2)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let orgId: number
  let eventId: number
  const route = reactive({ params: { orgId: '', eventId: '' }, path: '', fullPath: '' })
  const requests: { method: string; url: string; status: number }[] = []
  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [owner] = await db
      .insert(users)
      .values({ email: `pricing-forms-${Math.random()}@t.by` })
      .returning()
    ownerId = owner!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Pricing forms' })).id
    requests.length = 0
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    Object.entries({
      computed,
      reactive,
      ref,
      onBeforeUnmount,
      onUnmounted,
      definePageMeta: () => undefined,
      useRoute: () => route,
      useRouter: () => ({ currentRoute: ref(route) }),
      useOrgTimezone: () => ({ tz: ref('Europe/Minsk'), load: async () => undefined }),
      navigateTo: () => undefined,
      apiErrorMessage: () => 'Не удалось сохранить событие',
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    vi.stubGlobal('$fetch', async (url: string, opts?: { method?: string; body?: unknown }) => {
      const method = opts?.method ?? 'GET'
      const response = await request(method, url, { user: ownerId, body: opts?.body })
      requests.push({ method, url, status: response.status })
      if (response.status >= 400) throw new Error(response.text)
      return response.body
    })
    vi.stubGlobal('useFetch', async (url: () => string) => {
      const response = await request('GET', url(), { user: ownerId })
      expect(response.status).toBe(200)
      return {
        data: ref(response.body),
        pending: ref(false),
        error: ref(null),
        status: ref('success'),
        refresh: async () => undefined,
      }
    })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  async function create(mode: 'fixed' | 'split') {
    const result = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: {
        title: 'Training',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 93600000).toISOString(),
        capacity: 4,
        status: 'published',
        price: 0,
        priceMode: mode,
        targetAmount: mode === 'split' ? 10000 : null,
      },
    })
    expect(result.status).toBe(200)
    eventId = (result.body as { event: { id: number } }).event.id
  }
  async function render(surface: 'mini' | 'desktop') {
    route.params.orgId = String(orgId)
    route.params.eventId = String(eventId)
    route.path = `/${surface === 'mini' ? 'm' : 'app'}/orgs/${orgId}/events/${eventId}/edit`
    route.fullPath = route.path
    const component = surface === 'mini' ? MiniEdit : DesktopEdit
    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(component) }) }),
      {
        global: {
          components: { EventForm },
          stubs: {
            NuxtLink: { template: '<a><slot /></a>' },
            VtMiniHeader: true,
            SkeletonList: true,
            ErrorState: true,
            EmptyState: true,
          },
        },
      },
    )
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true), { timeout: 5000 })
    return wrapper
  }
  for (const surface of ['mini', 'desktop'] as const) {
    it(`locks target through a real settled manager GET: ${surface}`, async () => {
      await create('split')
      const booked = await request(
        'POST',
        `/api/organizations/${orgId}/events/${eventId}/bookings`,
        { user: ownerId, body: { method: 'cash' } },
      )
      expect(booked.status).toBe(200)
      const settled = await request(
        'POST',
        `/api/organizations/${orgId}/events/${eventId}/settle`,
        { user: ownerId },
      )
      expect(settled.status).toBe(200)
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
      const wrapper = await render(surface)
      expect(wrapper.get('#ev-target').attributes('disabled')).toBeDefined()
      expect(wrapper.get('input[value="fixed"]').attributes('disabled')).toBeDefined()
      const response = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
        user: ownerId,
      })
      expect(response.body).toMatchObject({
        event: {
          pricingPermissions: {
            canChangePriceMode: false,
            canChangeTargetAmount: false,
            canSettle: false,
          },
          pricingFinancials: { pending: 10000, currency: 'BYN' },
        },
      })
      wrapper.unmount()
    })
    for (const history of ['cancelled', 'waitlisted'] as const) {
      it.each(['fixed', 'split'] as const)(
        `api_permissions_lock_both_edit_forms: ${surface}, ${history}, %s at taken=0`,
        async (mode) => {
          await create(mode)
          await db.insert(bookings).values({
            eventId,
            organizationId: orgId,
            userId: ownerId,
            status: history,
            method: mode === 'split' ? 'cash' : 'free',
          })
          const response = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
            user: ownerId,
          })
          expect(response.body).toMatchObject({
            event: {
              taken: 0,
              pricingPermissions: {
                canChangePriceMode: false,
                canChangeTargetAmount: mode === 'split',
                canSettle: mode === 'split',
              },
            },
          })
          vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
          const wrapper = await render(surface)
          expect(wrapper.get('input[value="fixed"]').attributes('disabled')).toBeDefined()
          expect(wrapper.get('input[value="split"]').attributes('disabled')).toBeDefined()
          if (mode === 'split') {
            expect(wrapper.get('#ev-target').attributes('disabled')).toBeUndefined()
            await wrapper.get('#ev-target').setValue('120')
            await wrapper.get('form').trigger('submit')
            await flushPromises()
            await vi.waitFor(() => expect(requests.some((r) => r.method === 'PATCH')).toBe(true))
            expect(requests.filter((r) => r.method === 'PATCH')).toEqual([
              {
                method: 'PATCH',
                url: `/api/organizations/${orgId}/events/${eventId}`,
                status: 200,
              },
            ])
            const saved = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
              user: ownerId,
            })
            expect(saved.body).toMatchObject({ event: { targetAmount: 12000 } })
          }
          wrapper.unmount()
        },
      )
    }
    it(`server refuses stale unlocked GET after booking history: ${surface}`, async () => {
      await create('fixed')
      const wrapper = await render(surface)
      expect(wrapper.get('input[value="split"]').attributes('disabled')).toBeUndefined()
      await db.insert(bookings).values({
        eventId,
        organizationId: orgId,
        userId: ownerId,
        status: 'cancelled',
        method: 'free',
      })
      await wrapper.get('input[value="split"]').setValue(true)
      await wrapper.get('#ev-target').setValue('100')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      await vi.waitFor(() => expect(requests.some((r) => r.method === 'PATCH')).toBe(true))
      expect(requests.filter((r) => r.method === 'PATCH')).toEqual([
        { method: 'PATCH', url: `/api/organizations/${orgId}/events/${eventId}`, status: 409 },
      ])
      expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить событие')
      const unchanged = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
        user: ownerId,
      })
      expect(unchanged.body).toMatchObject({ event: { priceMode: 'fixed', targetAmount: null } })
      wrapper.unmount()
    })
  }
})
