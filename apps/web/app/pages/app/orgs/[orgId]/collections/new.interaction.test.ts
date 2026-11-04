// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense } from 'vue'

import NewCollection from './new.vue'

import CollectionIcon from '~/components/desktop/CollectionIcon.vue'
import Icon from '~/components/vt/Icon.vue'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/collections/new' })
const apiFetch = vi.fn()
const navigate = vi.fn()
let wrapper: VueWrapper | undefined
let capabilities: { collections?: boolean } | undefined

beforeEach(() => {
  capabilities = { collections: true }
  apiFetch.mockReset().mockResolvedValue({ collection: { id: 5 } })
  navigate.mockReset()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({
      organization: { id: 30, defaultTimezone: 'Europe/Minsk', defaultCurrency: 'BYN' },
      capabilities,
    }),
    error: ref(null),
  }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('apiErrorMessage', (e: { message?: string }, fallback: string) =>
    e.message ? e.message : fallback,
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(NewCollection) }) }),
    {
      attachTo: document.body,
      global: {
        components: { DesktopCollectionIcon: CollectionIcon, VtIcon: Icon },
        stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('desktop new collection form (W-08)', () => {
  it('creates an active collection with the amount in minor units and the picked icon', async () => {
    const w = await render()
    await w.get('[aria-label="Турнир"]').trigger('click')
    await w.get('#collection-title').setValue('  Новый комплект мячей ')
    await w.get('#collection-description').setValue('3 мяча на сезон')
    await w.get('#collection-target').setValue('250,50')
    await w.get('#collection-deadline').setValue('2099-06-05')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledTimes(1)
    const [url, options] = apiFetch.mock.calls[0]!
    expect(url).toBe('/api/organizations/30/collections')
    expect(options.method).toBe('POST')
    expect(options.body).toEqual({
      title: 'Новый комплект мячей',
      description: '3 мяча на сезон',
      icon: 'trophy',
      targetAmount: 25050,
      deadlineAt: '2099-06-05T20:59:00.000Z',
      status: 'active',
    })
    expect(navigate).toHaveBeenCalledWith('/app/orgs/30/collections')
  })

  it('can save a draft without a target or deadline', async () => {
    const w = await render()
    await w.get('#collection-title').setValue('Праздник')
    await w.get('input[value="draft"]').setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch.mock.calls[0]![1].body).toMatchObject({
      status: 'draft',
      targetAmount: null,
      deadlineAt: null,
      description: null,
      icon: 'ball',
    })
  })

  it('shows field errors and does not call the API on invalid input', async () => {
    const w = await render()
    await w.get('#collection-target').setValue('0')
    await w.get('#collection-deadline').setValue('2001-01-01')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(w.text()).toContain('Название: от 1 до 120 символов')
    expect(w.text()).toContain('Укажите сумму больше нуля')
    expect(w.text()).toContain('Дедлайн должен быть в будущем')
  })

  it('surfaces a server refusal, for example collection.disabled, and stays on the form', async () => {
    apiFetch.mockRejectedValue({ message: 'Сборы пока недоступны' })
    const w = await render()
    await w.get('#collection-title').setValue('Сбор')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Сборы пока недоступны')
    expect(navigate).not.toHaveBeenCalled()
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('does not offer the form when the capability is off or missing', async () => {
    for (const value of [{ collections: false }, undefined]) {
      capabilities = value
      const w = await render()
      expect(w.find('form').exists()).toBe(false)
      expect(w.text()).toContain('Создание сборов пока недоступно')
      expect(w.find('a[href="/app/orgs/30/collections"]').exists()).toBe(true)
      w.unmount()
      wrapper = undefined
    }
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('ignores a second submit while the first is in flight', async () => {
    let release: (value: unknown) => void = () => undefined
    apiFetch.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const w = await render()
    await w.get('#collection-title').setValue('Сбор')
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    release({ collection: { id: 1 } })
    await flushPromises()
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
