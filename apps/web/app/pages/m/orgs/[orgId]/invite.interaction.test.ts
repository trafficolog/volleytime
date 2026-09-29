// @vitest-environment happy-dom
import type { InviteLink, OrganizationMember } from '@volley-time/db'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import Invite from './invite.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import { apiErrorMessage } from '~/utils/api-error'

const invite: InviteLink & { deeplinkUrl: string } = {
  id: 11,
  token: 'synthetic-8106-invite-token',
  organizationId: 30,
  eventId: null,
  type: 'organization_join',
  createdByUserId: 9,
  roleToAssign: 'player',
  defaultMemberStatus: 'pending',
  maxUses: 10,
  usesCount: 2,
  expiresAt: null,
  isRevoked: false,
  createdAt: new Date('2026-09-29T07:00:00Z'),
  deeplinkUrl: 'https://t.me/synthetic_qa_bot?start=synthetic-8106-invite-token',
}
const member: OrganizationMember = {
  id: 4,
  organizationId: 30,
  userId: 9,
  role: 'owner',
  status: 'active',
  joinedAt: new Date('2026-09-29T07:00:00Z'),
  invitedByUserId: null,
  inviteId: null,
  ratingInOrg: null,
  createdAt: new Date('2026-09-29T07:00:00Z'),
  updatedAt: new Date('2026-09-29T07:00:00Z'),
}
const failure = { statusCode: 503, data: { statusMessage: 'Временная QA-ошибка сервера' } }
const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined

beforeEach(() => {
  apiFetch.mockReset().mockRejectedValue(failure)
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('useTelegram', () => ({ confirm: () => Promise.resolve(true) }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref({
      organization: { name: 'Синтетическая QA-группа', defaultMemberStatus: 'active' },
      myMember: { ...member },
    }),
  }))
  vi.stubGlobal('computed', computed)
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

async function renderInvite() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Invite) }) })
  wrapper = mount(host, {
    global: {
      components: { EmptyState, ErrorState, SkeletonList },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtChip: { template: '<span><slot /></span>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function deferredResponse() {
  let resolve!: (value: { invites: (typeof invite)[] }) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<{ invites: (typeof invite)[] }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Mini App invite load recovery', () => {
  // Removing the error branch must expose the false empty state caught here.
  it('shows a failed GET as an error without empty, list or skeleton', async () => {
    const page = await renderInvite()
    expect(page.get('[role="alert"]').text()).toContain('Временная QA-ошибка сервера')
    expect(page.text()).not.toContain('Активных ссылок нет')
    expect(page.find('ul').exists()).toBe(false)
    expect(page.findAll('button').map((button) => button.text())).toContain('Повторить')
  })

  // A missing retry handler, stale error or wrong GET organization breaks recovery.
  it.each([
    { state: 'empty', invites: [] },
    { state: 'nonempty', invites: [invite] },
  ])('retries through loading to a successful $state list using only GET', async ({ invites }) => {
    const page = await renderInvite()
    const response = deferredResponse()
    apiFetch.mockReturnValueOnce(response.promise)
    await page.get('[role="alert"] button').trigger('click')
    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.get('ul[aria-busy="true"]').attributes('aria-label')).toBe('Загрузка')
    expect(page.text()).not.toContain('Активных ссылок нет')
    expect(page.text()).not.toContain(invite.deeplinkUrl)
    response.resolve({ invites })
    await flushPromises()
    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.find('[aria-busy="true"]').exists()).toBe(false)
    if (invites.length === 0) {
      expect(page.text()).toContain('Активных ссылок нет')
      expect(page.find('ul').exists()).toBe(false)
    } else {
      expect(page.text()).not.toContain('Активных ссылок нет')
      expect(page.get('ul li').text()).toContain(invite.deeplinkUrl)
      expect(page.get('ul li').text()).toContain('2 из 10 · бессрочно')
      expect(page.get('ul li').text()).toContain('с одобрением')
      expect(page.findAll('ul button').map((button) => button.text())).toEqual([
        'Копировать',
        'Поделиться',
        '',
      ])
      expect(
        page.get('button[aria-label="Отозвать ссылку"]').attributes('disabled'),
      ).toBeUndefined()
    }
    expect(apiFetch.mock.calls).toEqual([
      ['/api/organizations/30/invites'],
      ['/api/organizations/30/invites'],
    ])
  })

  it('returns to a retryable error after another failed GET without false empty', async () => {
    const page = await renderInvite()
    const response = deferredResponse()
    apiFetch.mockReturnValueOnce(response.promise)
    await page.get('[role="alert"] button').trigger('click')
    expect(page.find('[aria-busy="true"]').exists()).toBe(true)
    response.reject({ statusCode: 503, data: { statusMessage: 'Повторная QA-ошибка сервера' } })
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toContain('Повторная QA-ошибка сервера')
    expect(page.get('[role="alert"] button').text()).toBe('Повторить')
    expect(page.text()).not.toContain('Активных ссылок нет')
    expect(page.find('ul').exists()).toBe(false)
    expect(apiFetch.mock.calls).toEqual([
      ['/api/organizations/30/invites'],
      ['/api/organizations/30/invites'],
    ])
  })

  // A revoke POST failure must not turn the successful list into a GET failure.
  it('keeps loaded invite actions visible after a failed revoke POST', async () => {
    apiFetch.mockResolvedValueOnce({ invites: [invite] }).mockRejectedValueOnce({
      statusCode: 503,
      data: { statusMessage: 'Отзыв ссылки временно недоступен' },
    })
    const page = await renderInvite()
    await page.get('button[aria-label="Отозвать ссылку"]').trigger('click')
    await flushPromises()

    expect(page.get('[role="alert"]').text()).toContain('Отзыв ссылки временно недоступен')
    expect(page.get('ul li').text()).toContain(invite.deeplinkUrl)
    expect(page.findAll('ul button').map((button) => button.text())).toEqual([
      'Копировать',
      'Поделиться',
      '',
    ])
    expect(page.get('button[aria-label="Отозвать ссылку"]').attributes('disabled')).toBeUndefined()
    expect(page.findAll('button').map((button) => button.text())).not.toContain('Повторить')
    expect(page.text()).not.toContain('Активных ссылок нет')
    expect(apiFetch.mock.calls).toEqual([
      ['/api/organizations/30/invites'],
      ['/api/organizations/30/invites/11/revoke', { method: 'POST' }],
    ])
  })
})
