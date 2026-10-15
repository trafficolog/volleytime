// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Members from './members.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import Segment from '~/components/vt/Segment.vue'
import { apiErrorMessage } from '~/utils/api-error'

const levels = [
  { code: 'v1', title: 'В1', description: 'Полупрофи', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: 'Сильный любитель', sortOrder: 2 },
  { code: 'v4_plus', title: 'В4+', description: 'Начинающие', sortOrder: 5 },
]

function row(id: number, name: string, level: string | null) {
  return {
    id,
    organizationId: 30,
    role: 'player' as const,
    status: 'active' as const,
    level,
    joinedAt: null,
    createdAt: '2026-09-29T07:00:00.000Z',
    user: { id: id + 100, name, telegramUsername: null, image: null },
  }
}

const activeMembers = [
  row(1, 'Синтетический Игрок Один', 'v1'),
  row(2, 'Синтетический Игрок Два', 'v4_plus'),
  row(3, 'Синтетический Игрок Три', null),
]

const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined

beforeEach(() => {
  apiFetch.mockReset().mockResolvedValue({ members: [] })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useTelegram', () => ({ confirm: () => Promise.resolve(true) }))
  vi.stubGlobal('useMembers', () => ({
    members: ref(activeMembers),
    loading: ref(false),
    error: ref(null),
    fetch: vi.fn(),
  }))
  vi.stubGlobal('useFetch', async (url: string | (() => string)) => {
    const path = typeof url === 'function' ? url() : url
    if (path === '/api/levels') return { data: ref({ levels }) }
    return {
      data: ref({
        organization: { name: 'Синтетическая QA-группа', defaultMemberStatus: 'active' },
        myMember: { role: 'player', status: 'active', userId: 9 },
      }),
    }
  })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function renderMembers() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Members) }) })
  wrapper = mount(host, {
    global: {
      components: { EmptyState, ErrorState, SkeletonList, VtSegment: Segment },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtAvatar: { template: '<span />' },
        VtSheet: { template: '<div />' },
        VtChip: { template: '<span><slot /></span>' },
        NuxtLink: { template: '<a><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Mini App members level display and filter', () => {
  it('shows each member level as a scale title and nothing as A/B/C', async () => {
    const page = await renderMembers()
    const names = page.findAll('li').map((item) => item.text())
    expect(names[0]).toContain('В1')
    expect(names[1]).toContain('В4+')
    expect(names[2]).not.toMatch(/В\d|[ABC]\b/)
    expect(page.text()).not.toMatch(/\b[ABC]\b/)
  })

  it('offers all, the scale levels in order and no-level as filter chips', async () => {
    const page = await renderMembers()
    const options = page.findAll('[role="radio"]').map((item) => item.text())
    expect(options).toEqual(['Все', 'В1', 'В2', 'В4+', 'Без уровня'])
  })

  it('narrows the roster to one level and back to all', async () => {
    const page = await renderMembers()
    const radios = page.findAll('[role="radio"]')
    await radios[1]!.trigger('click')
    expect(page.findAll('li').map((item) => item.text())).toEqual([expect.stringContaining('В1')])
    expect(page.text()).toContain('Синтетический Игрок Один')
    expect(page.text()).not.toContain('Синтетический Игрок Два')

    await radios[4]!.trigger('click')
    expect(page.text()).toContain('Синтетический Игрок Три')
    expect(page.text()).not.toContain('Синтетический Игрок Один')

    await radios[0]!.trigger('click')
    expect(page.findAll('li')).toHaveLength(3)
  })

  it('shows an empty state for a filter with no members', async () => {
    const page = await renderMembers()
    await page.findAll('[role="radio"]')[2]!.trigger('click')
    expect(page.find('li').exists()).toBe(false)
    expect(page.text()).toContain('Нет игроков с этим уровнем')
    expect(page.text()).not.toContain('В составе пока никого')
  })
})
