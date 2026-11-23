// @vitest-environment happy-dom
import { defaultGroupPageContent } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GroupPagePreview from './GroupPagePreview.vue'
import { levelTitles, makeView, stubs } from './group-page-fixtures'

function mountPreview(over: Partial<InstanceType<typeof GroupPagePreview>['$props']> = {}) {
  const view = makeView()
  return mount(GroupPagePreview, {
    props: {
      content: view.content,
      group: view.group,
      venues: view.venues,
      events: view.upcomingEvents,
      defaults: view.resolved,
      levelTitles,
      device: 'desktop',
      ...over,
    },
    global: { stubs },
  })
}

describe('GroupPagePreview', () => {
  it('renders the search snippet from the defaults and the enabled sections in order', () => {
    const wrapper = mountPreview()
    expect(wrapper.find('[data-gp-snippet]').text()).toContain('VolleyTime Минск — волейбол, Минск')
    expect(wrapper.find('[data-gp-snippet]').text()).toContain('volleytime.by/g/volleytime-minsk')
    expect(wrapper.findAll('[data-gp-block]').map((b) => b.attributes('data-gp-block'))).toEqual([
      'cover',
      'about',
      'schedule',
      'formats',
      'prices',
      'venues',
      'join',
      'faq',
    ])
    expect(wrapper.find('[data-gp-block="formats"]').text()).toContain('В2 · Начинающий')
    expect(wrapper.find('[data-gp-block="join"]').text()).toContain('нажмите «Записаться»')
    expect(wrapper.find('[data-gp-block="venues"]').text()).toBe('ЗалЗалы не выбраны.')
  })

  it('formats the event time in the group time zone and lists chosen venues with addresses', () => {
    const content = defaultGroupPageContent()
    const venues = content.sections.find((s) => s.kind === 'venues')!
    if (venues.kind === 'venues') venues.venueIds = [1]
    const wrapper = mountPreview({ content })
    // 17:00 UTC = 20:00 в Минске
    expect(wrapper.find('[data-gp-block="schedule"]').text()).toContain('20:00')
    expect(wrapper.find('[data-gp-block="venues"]').text()).toContain('ул. Мира, 5')
  })

  it('skips disabled sections, uses custom meta and tells when nothing is enabled', () => {
    const content = defaultGroupPageContent()
    content.metaTitle = 'Свой заголовок страницы'
    for (const s of content.sections) s.enabled = false
    const wrapper = mountPreview({ content, device: 'phone' })
    expect(wrapper.find('.vt-gp-preview').attributes('data-device')).toBe('phone')
    expect(wrapper.find('[data-gp-snippet]').text()).toContain('Свой заголовок страницы')
    expect(wrapper.find('[data-gp-block]').exists()).toBe(false)
    expect(wrapper.find('[data-gp-empty]').exists()).toBe(true)
  })
})
