// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import Collections from './index.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import EditSheet from '~/components/desktop/CollectionEditSheet.vue'
import CollectionIcon from '~/components/desktop/CollectionIcon.vue'
import Pledges from '~/components/desktop/CollectionPledges.vue'
import RowMenu from '~/components/desktop/CollectionRowMenu.vue'
import Alert from '~/components/vt/Alert.vue'
import Avatar from '~/components/vt/Avatar.vue'
import Chip from '~/components/vt/Chip.vue'
import Icon from '~/components/vt/Icon.vue'
import Meter from '~/components/vt/Meter.vue'
import Popover from '~/components/vt/Popover.vue'
import Sheet from '~/components/vt/Sheet.vue'
import Toast from '~/components/vt/Toast.vue'
import { useToast } from '~/composables/useToast'

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/collections' })
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined
let capabilities: { collections?: boolean } | undefined
let orgFails = false
const apiErrorCode = (e: unknown) => (e as { code?: string }).code
/** Взносы по сборам для `GET …/collections/{id}`; без записи — пусто. */
let contributions: Record<number, unknown[]> = {}
/** Ответ списка; детали сборов отдаёт `route`. */
let listing: unknown = { collections: [], nextCursor: null }

function answer(url: string) {
  const detail = /\/collections\/(\d+)$/.exec(url)
  if (detail) return { contributions: contributions[Number(detail[1])] ?? [] }
  return listing
}
function listReturns(collections: unknown[], nextCursor: string | null = null) {
  listing = { collections, nextCursor }
  apiFetch.mockImplementation(async (url: string) => answer(url))
}
function pledge(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    user: { id: id + 100, name: `Игрок ${id}`, telegramUsername: null, image: null },
    amount: 1500,
    currency: 'BYN',
    method: 'cash',
    status: 'pending',
    createdAt: '2026-11-01T10:00:00.000Z',
    confirmedAt: null,
    ...over,
  }
}

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
  contributions = {}
  apiFetch.mockReset()
  listReturns([])
  useToast().dismiss()
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
  vi.stubGlobal('useToast', useToast)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('apiErrorMessage', (e: unknown, fallback: string) =>
    apiErrorCode(e) === 'payment.not_pending' ? 'Обещание уже обработано' : fallback,
  )
  vi.stubGlobal('apiErrorCode', apiErrorCode)
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
          DesktopCollectionPledges: Pledges,
          DesktopCollectionRowMenu: RowMenu,
          DesktopCollectionEditSheet: EditSheet,
          VtAlert: Alert,
          VtAvatar: Avatar,
          VtChip: Chip,
          VtIcon: Icon,
          VtMeter: Meter,
          VtPopover: Popover,
          VtSheet: Sheet,
          VtToast: Toast,
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
    listReturns([
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
    ])
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
    listReturns([collection(1)])
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
    listReturns([collection(1)])
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

  it('stops after 10 pages and tells that the totals cover only the loaded collections', async () => {
    listReturns([collection(1, { pledged: 0 })], 'more')
    const w = await render()
    expect(apiFetch).toHaveBeenCalledTimes(10)
    expect(w.findAll('[data-testid="collection-card"]')).toHaveLength(10)
    expect(w.text()).toContain('Показаны последние 10 сборов; итоги посчитаны по ним.')
  })
})

const BASE = '/api/organizations/30/collections'
const byText = (selector: string, text: string, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.includes(text))
const conflict = (code: string) => Object.assign(new Error(code), { code, statusCode: 409 })
const writes = () => apiFetch.mock.calls.filter(([, options]) => options?.method)
const failWrites = (error: Error) =>
  apiFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (options?.method) throw error
    return answer(url)
  })

describe('pledges panel (21.2.23)', () => {
  beforeEach(() => {
    contributions = { 1: [pledge(11), pledge(12, { status: 'succeeded' })], 2: [pledge(21)] }
    listReturns([collection(1), collection(2, { status: 'draft' }), collection(3, { pledged: 0 })])
  })

  it('lists only pending pledges with player, amount, method and collection', async () => {
    const w = await render()
    const rows = w.findAll('[data-testid="pledge-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Игрок 11')
    expect(rows[0]!.text()).toContain('15,00 BYN')
    expect(rows[0]!.text()).toContain('Наличные')
    expect(rows[0]!.text()).toContain('Сбор 1')
    expect(w.get('[data-testid="pledges-count"]').text()).toBe('2 ждут')
    // сбор без ожидающих обещаний не опрашивается
    expect(apiFetch.mock.calls.map(([url]) => url)).not.toContain(`${BASE}/3`)
  })

  it('confirms a pledge, refreshes the list and shows a toast', async () => {
    const w = await render()
    contributions = { 2: [pledge(21)] }
    await w.get('button[aria-label="Подтвердить обещание: Игрок 11"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${BASE}/1/contributions/11/confirm`, { method: 'POST' })
    expect(w.findAll('[data-testid="pledge-row"]')).toHaveLength(1)
    expect(useToast().current.value?.message).toBe('Обещание подтверждено')
  })

  it('rejects a pledge', async () => {
    const w = await render()
    await w.get('button[aria-label="Отклонить обещание: Игрок 11"]').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${BASE}/1/contributions/11/reject`, { method: 'POST' })
    expect(useToast().current.value?.message).toBe('Обещание отклонено')
  })

  it('sends one request on a double click and disables the buttons meanwhile', async () => {
    const w = await render()
    let release: () => void = () => undefined
    apiFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (options?.method) await new Promise<void>((resolve) => (release = resolve))
      return answer(url)
    })
    const button = w.get('button[aria-label="Подтвердить обещание: Игрок 11"]')
    await button.trigger('click')
    await button.trigger('click')
    expect(writes()).toHaveLength(1)
    expect(button.attributes('disabled')).toBeDefined()
    expect(
      w.get('button[aria-label="Отклонить обещание: Игрок 11"]').attributes('disabled'),
    ).toBeDefined()
    release()
    await flushPromises()
    expect(
      w.find('button[aria-label="Подтвердить обещание: Игрок 11"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('handles 409 payment.not_pending: message, reload, no crash', async () => {
    const w = await render()
    contributions = { 1: [pledge(13)], 2: [pledge(21)] }
    failWrites(conflict('payment.not_pending'))
    await w.get('button[aria-label="Подтвердить обещание: Игрок 11"]').trigger('click')
    await flushPromises()
    expect(useToast().current.value).toMatchObject({
      message: 'Обещание уже обработано',
      tone: 'danger',
    })
    const rows = w.findAll('[data-testid="pledge-row"]').map((r) => r.text())
    expect(rows.some((t) => t.includes('Игрок 11'))).toBe(false)
    expect(rows.some((t) => t.includes('Игрок 13'))).toBe(true)
    expect(w.find('[data-testid="collection-card"]').exists()).toBe(true)
  })

  it('keeps the list and shows the error on other server failures without reloading', async () => {
    const w = await render()
    failWrites(Object.assign(new Error('boom'), { statusCode: 500 }))
    const before = apiFetch.mock.calls.length
    await w.get('button[aria-label="Отклонить обещание: Игрок 11"]').trigger('click')
    await flushPromises()
    expect(useToast().current.value).toMatchObject({
      message: 'Не удалось отклонить обещание',
      tone: 'danger',
    })
    expect(apiFetch.mock.calls.length).toBe(before + 1)
    expect(w.findAll('[data-testid="pledge-row"]')).toHaveLength(2)
  })

  it('reports a failed pledge fetch and retries it', async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === `${BASE}/2`) throw new Error('boom')
      return answer(url)
    })
    const w = await render()
    expect(w.text()).toContain('Не удалось загрузить часть обещаний')
    expect(w.findAll('[data-testid="pledge-row"]')).toHaveLength(1)
    apiFetch.mockImplementation(async (url: string) => answer(url))
    byText('button', 'Повторить', w.element)!.click()
    await flushPromises()
    expect(w.findAll('[data-testid="pledge-row"]')).toHaveLength(2)
    expect(w.text()).not.toContain('Не удалось загрузить часть обещаний')
  })

  it('shows pledges read-only while the flag is off', async () => {
    capabilities = { collections: false }
    const w = await render()
    expect(w.findAll('[data-testid="pledge-row"]')).toHaveLength(2)
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).toContain('решения по обещаниям недоступны')
  })

  it('refuses decisions when the flag is off even if invoked', async () => {
    capabilities = { collections: false }
    const w = await render()
    w.getComponent(Pledges).vm.$emit('confirm', { id: 11, collectionId: 1 })
    await flushPromises()
    expect(writes()).toHaveLength(0)
  })
})

describe('collection row menu (21.2.23)', () => {
  const openMenu = async (w: VueWrapper, title: string) => {
    await w.get(`button[aria-label="Действия со сбором «${title}»"]`).trigger('click')
    await flushPromises()
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((i) =>
      i.textContent?.trim(),
    )
  }

  beforeEach(() => {
    listReturns([
      collection(1, { title: 'Идёт', pledged: 0 }),
      collection(2, { title: 'Черновик', status: 'draft', pledged: 0 }),
      collection(3, { title: 'Закрыт', status: 'completed', pledged: 0 }),
      collection(4, { title: 'Снят', status: 'cancelled', pledged: 0 }),
    ])
  })

  it('offers items by status and none for closed collections', async () => {
    const w = await render()
    expect(await openMenu(w, 'Идёт')).toEqual(['Изменить', 'Завершить сбор', 'Отменить сбор'])
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect(await openMenu(w, 'Черновик')).toEqual(['Изменить', 'Опубликовать', 'Отменить сбор'])
    expect(w.find('button[aria-label="Действия со сбором «Закрыт»"]').exists()).toBe(false)
    expect(w.find('button[aria-label="Действия со сбором «Снят»"]').exists()).toBe(false)
  })

  it('publishes a draft with PATCH status active', async () => {
    const w = await render()
    await openMenu(w, 'Черновик')
    byText('[role="menuitem"]', 'Опубликовать')!.click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${BASE}/2`, {
      method: 'PATCH',
      body: { status: 'active' },
    })
    expect(useToast().current.value?.message).toBe('Сбор «Черновик» опубликован')
  })

  it('asks for confirmation before cancelling and warns about pledges and notifications', async () => {
    const w = await render()
    await openMenu(w, 'Идёт')
    byText('[role="menuitem"]', 'Отменить сбор')!.click()
    await flushPromises()
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Ожидающие обещания будут отклонены')
    expect(dialog.textContent).toContain('игроки получат уведомление')
    expect(writes()).toHaveLength(0)
    byText('button', 'Не отменять', dialog)!.click()
    await flushPromises()
    expect(writes()).toHaveLength(0)

    await openMenu(w, 'Идёт')
    byText('[role="menuitem"]', 'Отменить сбор')!.click()
    await flushPromises()
    byText('[role="alertdialog"] button', 'Отменить сбор')!.click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${BASE}/1/cancel`, { method: 'POST' })
    expect(useToast().current.value?.message).toBe('Сбор «Идёт» отменён')
  })

  it('asks for confirmation before completing', async () => {
    const w = await render()
    await openMenu(w, 'Идёт')
    byText('[role="menuitem"]', 'Завершить сбор')!.click()
    await flushPromises()
    expect(writes()).toHaveLength(0)
    byText('[role="alertdialog"] button', 'Завершить сбор')!.click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${BASE}/1/complete`, { method: 'POST' })
  })

  it('reloads after 409 collection.not_active', async () => {
    const w = await render()
    failWrites(conflict('collection.not_active'))
    await openMenu(w, 'Идёт')
    byText('[role="menuitem"]', 'Завершить сбор')!.click()
    await flushPromises()
    byText('[role="alertdialog"] button', 'Завершить сбор')!.click()
    await flushPromises()
    expect(useToast().current.value?.tone).toBe('danger')
    expect(apiFetch.mock.calls.filter(([url]) => url === BASE).length).toBeGreaterThan(1)
  })

  it('shows a server error without reloading', async () => {
    const w = await render()
    failWrites(Object.assign(new Error('boom'), { statusCode: 500 }))
    await openMenu(w, 'Черновик')
    byText('[role="menuitem"]', 'Опубликовать')!.click()
    await flushPromises()
    expect(useToast().current.value).toMatchObject({
      message: 'Не удалось опубликовать сбор',
      tone: 'danger',
    })
  })

  it('edits through PATCH and keeps the status out of the body', async () => {
    const w = await render()
    await openMenu(w, 'Идёт')
    byText('[role="menuitem"]', 'Изменить')!.click()
    await flushPromises()
    const title = document.querySelector<HTMLInputElement>('#collection-edit-title')!
    expect(title.value).toBe('Идёт')
    title.value = 'Новое имя'
    title.dispatchEvent(new Event('input'))
    document
      .querySelector('#vt-collection-edit form')!
      .dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    const call = writes().find(([url]) => url === `${BASE}/1`)!
    expect(call[1].method).toBe('PATCH')
    expect(call[1].body).toMatchObject({ title: 'Новое имя', targetAmount: 25000 })
    expect(call[1].body).not.toHaveProperty('status')
    expect(call[1].body).not.toHaveProperty('deadlineAt')
  })

  it('has no menu while the flag is off', async () => {
    capabilities = { collections: false }
    const w = await render()
    expect(w.find('button[aria-label^="Действия со сбором"]').exists()).toBe(false)
  })
})
