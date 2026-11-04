// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import Collections from './index.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import CollectionIcon from '~/components/desktop/CollectionIcon.vue'
import Chip from '~/components/vt/Chip.vue'
import Icon from '~/components/vt/Icon.vue'
import Meter from '~/components/vt/Meter.vue'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/collections' })
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined
let capabilities: { collections?: boolean } | undefined
let orgFails = false

function collection(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    title: `Сбор ${id}`,
    description: null,
    icon: 'ball',
    targetAmount: 25000,
    currency: 'BYN',
    status: 'active',
    deadlineAt: null,
    closedAt: null,
    collected: 17500,
    pledged: 2000,
    contributors: 3,
    ...over,
  }
}

beforeEach(() => {
  capabilities = { collections: true }
  orgFails = false
  apiFetch.mockReset().mockResolvedValue({ collections: [], nextCursor: null })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useFetch', async () => ({
    data: ref(
      orgFails
        ? null
        : {
            organization: {
              id: 30,
              defaultTimezone: 'Europe/Minsk',
              defaultCurrency: 'BYN',
            },
            capabilities,
          },
    ),
    error: ref(orgFails ? { statusCode: 500 } : null),
  }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback: string) => fallback)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Collections) }) }),
    {
      attachTo: document.body,
      global: {
        components: {
          EmptyState,
          ErrorState,
          SkeletonList,
          DesktopCollectionIcon: CollectionIcon,
          VtChip: Chip,
          VtIcon: Icon,
          VtMeter: Meter,
        },
        stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const NEW_LINK = 'a[href="/app/orgs/30/collections/new"]'

describe('desktop collections list (W-08)', () => {
  it('shows cards with progress, amounts, participants and deadline, plus the totals', async () => {
    apiFetch.mockResolvedValue({
      collections: [
        collection(2, {
          title: 'Аренда зала',
          description: 'Большой зал',
          deadlineAt: '2026-11-20T20:59:00.000Z',
        }),
        collection(1, {
          title: 'Форма команды',
          status: 'completed',
          collected: 60000,
          targetAmount: 60000,
          pledged: 0,
          contributors: 11,
        }),
        collection(3, { status: 'cancelled', collected: 900, pledged: 0 }),
      ],
      nextCursor: null,
    })
    const w = await render()
    const cards = w.findAll('[data-testid="collection-card"]')
    expect(cards).toHaveLength(3)
    expect(cards[0]!.text()).toContain('Аренда зала')
    expect(cards[0]!.text()).toContain('активен')
    expect(cards[0]!.text()).toContain('70%')
    expect(cards[0]!.text()).toContain('3 участника')
    expect(cards[0]!.text()).toContain('до 20.11.2026')
    expect(cards[1]!.text()).toContain('завершён')
    expect(cards[1]!.text()).toContain('100%')
    expect(cards[1]!.text()).toContain('11 участников')
    expect(cards[2]!.text()).toContain('отменён')
    expect(w.get('[data-testid="collections-active"]').text()).toBe('1')
    expect(w.get('[data-testid="collections-collected"]').text()).toContain('775,00 BYN')
    expect(w.get('[data-testid="collections-pledged"]').text()).toContain('20,00 BYN')
  })

  it('offers creation only when the collections capability is on', async () => {
    const on = await render()
    expect(on.find(NEW_LINK).exists()).toBe(true)
    expect(on.text()).not.toContain('Создание сборов пока недоступно')
    on.unmount()
    wrapper = undefined

    capabilities = { collections: false }
    const off = await render()
    expect(off.find(NEW_LINK).exists()).toBe(false)
    expect(off.text()).toContain('Создание сборов пока недоступно')
  })

  it('treats a missing capability or an unreadable group as disabled', async () => {
    capabilities = undefined
    const missing = await render()
    expect(missing.find(NEW_LINK).exists()).toBe(false)
    missing.unmount()
    wrapper = undefined

    orgFails = true
    const failed = await render()
    expect(failed.find(NEW_LINK).exists()).toBe(false)
    expect(failed.text()).toContain('Создание сборов недоступно')
  })

  it('keeps existing collections visible read-only while the flag is off', async () => {
    capabilities = { collections: false }
    apiFetch.mockResolvedValue({ collections: [collection(1)], nextCursor: null })
    const w = await render()
    expect(w.findAll('[data-testid="collection-card"]')).toHaveLength(1)
    expect(w.find('button').exists()).toBe(false)
  })

  it('shows an empty state and a retryable error', async () => {
    const w = await render()
    expect(w.text()).toContain('Сборов пока нет')
    w.unmount()
    wrapper = undefined

    apiFetch.mockRejectedValue(new Error('boom'))
    const failed = await render()
    expect(failed.text()).toContain('Не удалось загрузить сборы')
    apiFetch.mockResolvedValue({ collections: [collection(1)], nextCursor: null })
    await failed.get('button').trigger('click')
    await flushPromises()
    expect(failed.findAll('[data-testid="collection-card"]')).toHaveLength(1)
  })

  it('follows the cursor until the last page', async () => {
    apiFetch
      .mockResolvedValueOnce({ collections: [collection(2)], nextCursor: 'next' })
      .mockResolvedValueOnce({ collections: [collection(1)], nextCursor: null })
    const w = await render()
    expect(w.findAll('[data-testid="collection-card"]')).toHaveLength(2)
    expect(apiFetch.mock.calls[1]![1].query).toEqual({ limit: 100, cursor: 'next' })
  })
})
