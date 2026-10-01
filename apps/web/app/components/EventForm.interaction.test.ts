// @vitest-environment happy-dom
import type { Event } from '@volley-time/db'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref, Suspense } from 'vue'

import EventForm from './EventForm.vue'

const apiFetch = vi.fn()
vi.stubGlobal('$fetch', apiFetch)
vi.stubGlobal('apiErrorMessage', () => 'Сервер не сохранил событие')
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)

async function renderForm(
  initial?: Event,
  subscriptionsEnabled = false,
  canSubmit?: () => boolean,
) {
  const host = defineComponent({
    render: () =>
      h(Suspense, null, {
        default: () =>
          h(EventForm, {
            orgId: 30,
            tz: 'Europe/Minsk',
            initial,
            subscriptionsEnabled,
            canSubmit,
            submitLabel: 'Сохранить',
          }),
      }),
  })
  const wrapper = mount(host)
  await flushPromises()
  return wrapper
}

async function fill(
  wrapper: Awaited<ReturnType<typeof renderForm>>,
  selector: string,
  value: string,
) {
  await wrapper.get(selector).setValue(value)
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async (url: string) => {
    if (url.endsWith('/venues')) return { venues: [{ id: 8, name: 'Зал', address: null }] }
    return { event: { id: 71 } }
  })
})

describe('EventForm payload and state', () => {
  it('creates a published event with all real fields and a fixed price in minor units', async () => {
    const wrapper = await renderForm()
    await fill(wrapper, '#ev-title', 'Новая игра')
    await fill(wrapper, '#ev-start', '2026-09-27T19:00')
    await fill(wrapper, '#ev-dur', '90')
    await fill(wrapper, '#ev-venue', '8')
    await fill(wrapper, '#ev-cap', '14')
    await fill(wrapper, '#ev-price', '15,50')
    await fill(wrapper, '#ev-deadline', '4')
    await fill(wrapper, '#ev-desc', 'Приходите заранее')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/events', {
      method: 'POST',
      body: {
        title: 'Новая игра',
        startsAt: '2026-09-27T16:00:00.000Z',
        endsAt: '2026-09-27T17:30:00.000Z',
        venueId: 8,
        locationText: undefined,
        capacity: 14,
        price: 1550,
        cancellationDeadlineHours: 4,
        description: 'Приходите заранее',
        status: 'published',
      },
    })
  })

  it('edits a draft with zero price and preserves entered values after an API error', async () => {
    const wrapper = await renderForm({
      id: 71,
      organizationId: 30,
      createdByUserId: 9,
      type: 'training',
      title: 'Черновик',
      priceMode: 'fixed',
      targetAmount: null,
      pricingSettledAt: null,
      pricingParticipantCount: null,
      startsAt: new Date('2026-09-27T16:00:00.000Z'),
      endsAt: new Date('2026-09-27T18:00:00.000Z'),
      venueId: null,
      locationText: 'Школа',
      capacity: 12,
      price: 0,
      currency: 'BYN',
      cancellationDeadlineHours: 6,
      description: 'Описание',
      status: 'draft',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect((wrapper.get('#ev-start').element as HTMLInputElement).value).toBe('2026-09-27T19:00')
    expect((wrapper.get('#ev-price').element as HTMLInputElement).value).toBe('0')
    apiFetch.mockRejectedValueOnce(new Error('server'))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/organizations/30/events/71',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ price: 0, status: 'draft', locationText: 'Школа' }),
      }),
    )
    expect((wrapper.get('#ev-title').element as HTMLInputElement).value).toBe('Черновик')
    expect(wrapper.get('[role="alert"]').text()).toContain('Сервер не сохранил событие')
  })

  it('keeps a closed event closed when editing its title without publishing it', async () => {
    const wrapper = await renderForm({
      id: 71,
      organizationId: 30,
      createdByUserId: 9,
      type: 'training',
      title: 'Закрытая игра',
      priceMode: 'fixed',
      targetAmount: null,
      pricingSettledAt: null,
      pricingParticipantCount: null,
      startsAt: new Date('2026-09-27T16:00:00.000Z'),
      endsAt: new Date('2026-09-27T18:00:00.000Z'),
      venueId: null,
      locationText: null,
      capacity: 12,
      price: 0,
      currency: 'BYN',
      cancellationDeadlineHours: 6,
      description: null,
      status: 'closed',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('Опубликовать снова')
    await fill(wrapper, '#ev-title', 'Закрытая игра, новый зал')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/organizations/30/events/71',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ title: 'Закрытая игра, новый зал', status: 'closed' }),
      }),
    )
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenLastCalledWith(
      '/api/organizations/30/events/71',
      expect.objectContaining({ body: expect.objectContaining({ status: 'published' }) }),
    )
  })

  it('shows the organization subscription setting as text with no event-level control', async () => {
    const wrapper = await renderForm(undefined, false)
    expect(wrapper.text()).toContain('Абонементы отключены в настройках группы')
    expect(wrapper.find('[name="subscriptionsEnabled"]').exists()).toBe(false)
    expect(wrapper.find('[name="paymentMethod"]').exists()).toBe(false)
  })

  it('rejects an invalid fixed price without changing the entered value or sending a request', async () => {
    const wrapper = await renderForm()
    await fill(wrapper, '#ev-price', 'abc')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('цену')
    expect((wrapper.get('#ev-price').element as HTMLInputElement).value).toBe('abc')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    await fill(wrapper, '#ev-price', '5,00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/organizations/30/events',
      expect.objectContaining({ body: expect.objectContaining({ price: 500 }) }),
    )
  })

  it('does not send venue or event writes after the route guard becomes false', async () => {
    let current = true
    const wrapper = await renderForm(undefined, true, () => current)
    expect(wrapper.text()).toContain('Абонементы включены в настройках группы')
    await wrapper.get('button[type="button"]').trigger('click')
    await fill(wrapper, '#ev-new-venue-name', 'Новый зал')
    current = false
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('creates a new venue first and sends its id with the event', async () => {
    const wrapper = await renderForm()
    await wrapper.get('button[type="button"]').trigger('click')
    await fill(wrapper, '#ev-new-venue-name', 'Новый зал')
    await fill(wrapper, '#ev-new-venue-address', 'Лесная 1')
    apiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/venues')) return { venue: { id: 19 } }
      return { event: { id: 71 } }
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/venues', {
      method: 'POST',
      body: { name: 'Новый зал', address: 'Лесная 1' },
    })
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/organizations/30/events',
      expect.objectContaining({ body: expect.objectContaining({ venueId: 19 }) }),
    )
  })
})
