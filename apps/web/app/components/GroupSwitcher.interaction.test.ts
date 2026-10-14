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
  ]
})

afterEach(() => {
  document.body.innerHTML = ''
  fetchAll.mockClear()
  selectOrg.mockClear()
})

describe('GroupSwitcher (M-04 «Мои группы»)', () => {
  it('lists groups as a radiogroup and marks the current group as checked', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    expect(radios[1]!.attributes('aria-checked')).toBe('false')
    // Выбранная группа — залитый flame-круг с галочкой; у остальных заливки нет.
    const mark = radios[0]!.get('[data-selected-mark]')
    expect(mark.classes()).toContain('bg-vt-flame')
    expect(mark.find('svg').exists()).toBe(true)
    expect(radios[1]!.get('[data-selected-mark]').classes()).not.toContain('bg-vt-flame')
    wrapper.unmount()
  })

  it('shows initials instead of a logo for groups without one', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(wrapper.findAll('[role="radio"]')[1]!.get('[data-monogram]').text()).toBe('МВ')
    wrapper.unmount()
  })

  it('offers creating one own group next to joining by invite', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(wrapper.get('a[href="/m/orgs/create"]').text()).toContain('Создать свою группу')
    expect(wrapper.get('a[href="/m/orgs"]').text()).toContain('Вступить по приглашению')
    wrapper.unmount()
  })

  it('loads the group list when the sheet opens', async () => {
    const wrapper = mountSwitcher()
    await flushPromises()
    expect(fetchAll).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('moves focus between groups with arrow keys without selecting them', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    const [first, second] = wrapper
      .findAll('[role="radio"]')
      .map((radio) => radio.element as HTMLElement)
    first!.focus()
    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(first)
    expect(selectOrg).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('activates the focused group with Space and gives roving tabindex to the current group', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    const second = radios[1]!.element as HTMLElement
    second.focus()
    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: ' ' })
    expect(selectOrg).toHaveBeenCalledWith(31)
    wrapper.unmount()
  })

  it('selects a selectable group on click and does not select pending groups', async () => {
    const wrapper = mountSwitcher(30)
    await flushPromises()
    await wrapper.get('a[href="/m/orgs/31"]').trigger('click')
    expect(selectOrg).toHaveBeenCalledWith(31)
    wrapper.unmount()
    selectOrg.mockClear()

    const pending = mountSwitcher(30)
    await flushPromises()
    await pending.get('a[href="/m/orgs/32"]').trigger('click')
    expect(selectOrg).not.toHaveBeenCalled()
    pending.unmount()
  })
})
