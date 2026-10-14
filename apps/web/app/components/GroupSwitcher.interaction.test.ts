// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import GroupSwitcher from './GroupSwitcher.vue'

const groups = ref<
  { id: number; name: string; city: string | null; status: string; membershipStatus: string }[]
>([])
const fetchAll = vi.fn(async () => undefined)
const selectOrg = vi.fn()

vi.stubGlobal('useOrganizations', () => ({
  orgs: groups,
  loading: ref(false),
  fetchAll,
  selectOrg,
}))
vi.stubGlobal('apiErrorMessage', (_error: unknown, fallback: string) => fallback)

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  VtSheet: {
    props: ['title', 'modelValue'],
    template: '<section v-if="modelValue" :aria-label="title"><slot /></section>',
  },
  VtIcon: { template: '<svg />' },
  SkeletonList: { template: '<span />' },
  ErrorState: { template: '<span />' },
}

function mountSwitcher(currentOrgId = 30) {
  return mount(GroupSwitcher, {
    props: { currentOrgId, modelValue: true },
    global: { stubs },
    attachTo: document.body,
  })
}

beforeEach(() => {
  groups.value = [
    {
      id: 30,
      name: 'VolleyTime Минск',
      city: 'Минск',
      status: 'active',
      membershipStatus: 'active',
    },
    {
      id: 31,
      name: 'МинскВолей · Воскресные',
      city: null,
      status: 'active',
      membershipStatus: 'active',
    },
    { id: 32, name: 'Ожидание', city: null, status: 'active', membershipStatus: 'pending' },
    { id: 33, name: 'Приостановлена', city: null, status: 'suspended', membershipStatus: 'active' },
  ]
})

afterEach(() => {
  document.body.innerHTML = ''
  fetchAll.mockClear()
  selectOrg.mockClear()
})

describe('GroupSwitcher (M-04 «Мои группы»)', () => {
  it('lists groups as a plain list of links and marks the current group with aria-current', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
    expect(wrapper.find('[role="radio"]').exists()).toBe(false)
    const items = wrapper.findAll('ul > li')
    expect(items).toHaveLength(4)
    const current = wrapper.get('a[href="/m/orgs/30"]')
    expect(current.attributes('aria-current')).toBe('true')
    expect(wrapper.get('a[href="/m/orgs/31"]').attributes('aria-current')).toBeUndefined()
    wrapper.unmount()
  })

  it('fills the current group with a flame circle and check mark only', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    const first = wrapper.get('a[href="/m/orgs/30"]')
    const second = wrapper.get('a[href="/m/orgs/31"]')
    expect(first!.get('[data-selected-mark]').classes()).toContain('bg-vt-flame')
    expect(first!.get('[data-selected-mark]').find('svg').exists()).toBe(true)
    expect(second!.get('[data-selected-mark]').classes()).not.toContain('bg-vt-flame')
    wrapper.unmount()
  })

  it('shows initials instead of a logo for groups without one', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(wrapper.get('a[href="/m/orgs/31"] [data-monogram]').text()).toBe('МВ')
    wrapper.unmount()
  })

  it('offers creating own group and joining by link with the prototype icon', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(wrapper.get('a[href="/m/orgs/create"]').text()).toContain('Создать свою группу')
    expect(wrapper.get('a[href="/m/orgs"]').text()).toContain('Вступить по ссылке')
    wrapper.unmount()
  })

  it('loads the group list when the sheet opens', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(fetchAll).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('uses native tab order: no tabindex overrides and no custom key handling', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    expect(wrapper.findAll('[tabindex]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('navigates and selects a selectable group on click', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    const link = wrapper.get('a[href="/m/orgs/31"]')
    expect(link.attributes('href')).toBe('/m/orgs/31')
    await link.trigger('click')
    expect(selectOrg).toHaveBeenCalledWith(31)
    wrapper.unmount()
  })

  it('renders pending and suspended groups as disabled non-links with a status label', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    for (const id of [32, 33]) {
      expect(wrapper.find(`a[href="/m/orgs/${id}"]`).exists()).toBe(false)
    }
    const pending = wrapper.get('[aria-disabled="true"]')
    expect(pending.text()).toContain('Ожидание')
    expect(pending.text()).toContain('Заявка на рассмотрении')
    expect(wrapper.findAll('[aria-disabled="true"]')[1]!.text()).toContain('Группа приостановлена')
    expect(wrapper.findAll('[aria-disabled="true"]')).toHaveLength(2)
    expect(selectOrg).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
