// @vitest-environment happy-dom
import { defaultGroupPageContent, type GroupPageView } from '@volley-time/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GroupPageBuilder from './GroupPageBuilder.vue'
import { levelTitles, makeView, stubs } from './group-page-fixtures'

function mountBuilder(opts: { view?: GroupPageView; canEdit?: boolean; request?: unknown } = {}) {
  const request = opts.request ?? vi.fn()
  const toast = vi.fn()
  const wrapper = mount(GroupPageBuilder, {
    props: {
      view: opts.view ?? makeView(),
      canEdit: opts.canEdit ?? true,
      levelTitles,
      base: '/app/orgs/7',
      request: request as never,
      toast,
    },
    global: { stubs },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return { wrapper, request: request as ReturnType<typeof vi.fn>, toast }
}
const mounted: { unmount: () => void }[] = []

const kinds = (wrapper: ReturnType<typeof mountBuilder>['wrapper']) =>
  wrapper.findAll('[data-gp-section]').map((s) => s.attributes('data-gp-section'))
const section = (wrapper: ReturnType<typeof mountBuilder>['wrapper'], kind: string) =>
  wrapper.find(`[data-gp-section="${kind}"]`)
const field = (wrapper: ReturnType<typeof mountBuilder>['wrapper'], key: string) =>
  wrapper.find(`[data-gp-field="${key}"]`)
const idx = (kind: string) => defaultGroupPageContent().sections.findIndex((s) => s.kind === kind)

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
})

describe('GroupPageBuilder sections', () => {
  it('shows the eight sections in the saved order with a switch each', () => {
    const { wrapper } = mountBuilder()
    expect(kinds(wrapper)).toEqual([
      'cover',
      'about',
      'schedule',
      'formats',
      'prices',
      'venues',
      'join',
      'faq',
    ])
    expect(wrapper.findAll('[data-gp-section] [role="switch"]')).toHaveLength(8)
    expect(wrapper.text()).toContain('Коротко о группе')
  })

  it('reorders with the up/down buttons, announces the new position and keeps focus on the button', async () => {
    const { wrapper } = mountBuilder()
    const up = (kind: string) => section(wrapper, kind).find(`[data-gp-move="${kind}:up"]`)
    const down = (kind: string) => section(wrapper, kind).find(`[data-gp-move="${kind}:down"]`)
    expect(up('cover').attributes('disabled')).toBeDefined()
    expect(down('faq').attributes('disabled')).toBeDefined()
    await down('cover').trigger('click')
    await flushPromises()
    expect(kinds(wrapper).slice(0, 2)).toEqual(['about', 'cover'])
    expect(wrapper.find('[role="status"][aria-live="polite"]').text()).toBe(
      '«Обложка»: позиция 2 из 8',
    )
    expect(document.activeElement).toBe(down('cover').element)
    await up('cover').trigger('click')
    await flushPromises()
    expect(kinds(wrapper)[0]).toBe('cover')
    // у верхнего края «выше» недоступна: фокус переходит на «ниже»
    expect(document.activeElement).toBe(down('cover').element)
  })

  it('sends the new order and the enabled flags in the saved payload', async () => {
    const saved = makeView()
    const request = vi.fn().mockResolvedValue({ page: saved })
    const { wrapper } = mountBuilder({ request })
    await section(wrapper, 'cover').find('[data-gp-move="cover:down"]').trigger('click')
    await section(wrapper, 'prices').find('[role="switch"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const body = request.mock.calls[0]![1].body
    expect(request.mock.calls[0]![0]).toBe('/api/organizations/7/group-page')
    expect(request.mock.calls[0]![1].method).toBe('PUT')
    expect(body.sections.map((s: { kind: string }) => s.kind).slice(0, 2)).toEqual([
      'about',
      'cover',
    ])
    expect(body.sections.find((s: { kind: string }) => s.kind === 'prices').enabled).toBe(false)
    expect(body.sections).toHaveLength(8)
  })

  it('applies the counters and limits of the contract to text fields', async () => {
    const { wrapper } = mountBuilder()
    const headline = field(wrapper, `sections.${idx('cover')}.headline`)
    expect(headline.attributes('maxlength')).toBe('80')
    await headline.setValue('Привет')
    expect(section(wrapper, 'cover').text()).toContain('6 / 80')
    expect(field(wrapper, `sections.${idx('about')}.text`).attributes('maxlength')).toBe('2000')
    expect(field(wrapper, `sections.${idx('prices')}.text`).attributes('maxlength')).toBe('1000')
  })

  it('shows the group data read-only: schedule events, levels and the group logo note', () => {
    const { wrapper } = mountBuilder()
    expect(section(wrapper, 'schedule').text()).toContain('Игра в среду')
    expect(section(wrapper, 'schedule').find('input, textarea').exists()).toBe(false)
    expect(section(wrapper, 'formats').text()).toContain('В2 · Начинающий, В3 · Средний')
    expect(section(wrapper, 'cover').text()).toContain('Логотип берётся из профиля группы')
  })
})

describe('GroupPageBuilder venues', () => {
  it('warns when the venues section is enabled without venues and clears after choosing one', async () => {
    const { wrapper } = mountBuilder()
    expect(section(wrapper, 'venues').find('[data-gp-venues-warning]').exists()).toBe(true)
    await section(wrapper, 'venues').find('input[type="checkbox"]').setValue(true)
    expect(section(wrapper, 'venues').find('[data-gp-venues-warning]').exists()).toBe(false)
    await section(wrapper, 'venues').find('input[type="checkbox"]').setValue(false)
    await section(wrapper, 'venues').find('[role="switch"]').trigger('click')
    expect(section(wrapper, 'venues').find('[data-gp-venues-warning]').exists()).toBe(false)
  })

  it('saves the chosen venues in the order of the group list', async () => {
    const request = vi.fn().mockResolvedValue({ page: makeView() })
    const { wrapper } = mountBuilder({ request })
    const boxes = section(wrapper, 'venues').findAll('input[type="checkbox"]')
    await boxes[1]!.setValue(true)
    await boxes[0]!.setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const venues = request.mock.calls[0]![1].body.sections.find(
      (s: { kind: string }) => s.kind === 'venues',
    )
    expect(venues.venueIds).toEqual([1, 2])
  })
})

describe('GroupPageBuilder join text', () => {
  it('shows the resolved default text and saves null while it is untouched', async () => {
    const request = vi.fn().mockResolvedValue({ page: makeView() })
    const view = makeView()
    const { wrapper } = mountBuilder({ request, view })
    const text = field(wrapper, `sections.${idx('join')}.text`)
    expect((text.element as HTMLTextAreaElement).value).toBe(view.resolved.joinText)
    await text.setValue('Пишите организатору')
    expect(section(wrapper, 'join').find('[data-gp-join-reset]').exists()).toBe(true)
    await section(wrapper, 'join').find('[data-gp-join-reset]').trigger('click')
    expect((text.element as HTMLTextAreaElement).value).toBe(view.resolved.joinText)
    // правок относительно сохранённого нет: сохранять нечего
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await text.setValue('Пишите организатору')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const join = request.mock.calls[0]![1].body.sections.find(
      (s: { kind: string }) => s.kind === 'join',
    )
    expect(join.text).toBe('Пишите организатору')
  })
})

describe('GroupPageBuilder FAQ', () => {
  it('adds, reorders and removes items and stops at 15', async () => {
    const { wrapper } = mountBuilder()
    const faq = () => section(wrapper, 'faq')
    const add = () => faq().find('[data-gp-faq-add]')
    await add().trigger('click')
    await add().trigger('click')
    const q = (j: number) => field(wrapper, `sections.${idx('faq')}.items.${j}.question`)
    await q(0).setValue('Первый?')
    await q(1).setValue('Второй?')
    await faq().findAll('[aria-label="Опустить вопрос 1 ниже"]')[0]!.trigger('click')
    expect((q(0).element as HTMLInputElement).value).toBe('Второй?')
    expect((q(1).element as HTMLInputElement).value).toBe('Первый?')
    await faq().find('[aria-label="Удалить вопрос 1"]').trigger('click')
    expect(faq().findAll('[data-gp-faq-item]')).toHaveLength(1)
    for (let i = 0; i < 14; i++) await add().trigger('click')
    expect(faq().findAll('[data-gp-faq-item]')).toHaveLength(15)
    expect(add().attributes('disabled')).toBeDefined()
    expect(faq().find('[data-gp-faq-count]').text()).toContain('15 / 15')
  })

  it('blocks saving an item with an empty answer and focuses the field', async () => {
    const request = vi.fn()
    const { wrapper } = mountBuilder({ request })
    await section(wrapper, 'faq').find('[data-gp-faq-add]').trigger('click')
    const q = field(wrapper, `sections.${idx('faq')}.items.0.question`)
    await q.setValue('Вопрос?')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    const answer = field(wrapper, `sections.${idx('faq')}.items.0.answer`)
    expect(answer.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(answer.element)
    expect(wrapper.text()).toContain('Заполните ответ')
  })
})

describe('GroupPageBuilder meta tags', () => {
  it('warns live about length and a missing city without blocking the save', async () => {
    const request = vi.fn().mockResolvedValue({ page: makeView() })
    const view = makeView()
    view.group.city = null
    const { wrapper } = mountBuilder({ request, view })
    expect(wrapper.find('[data-gp-warning="meta.city_missing"]').exists()).toBe(true)
    const title = field(wrapper, 'metaTitle')
    await title.setValue('Коротко')
    expect(wrapper.find('[data-gp-warning="meta.title_too_short"]').exists()).toBe(true)
    await title.setValue('А'.repeat(70))
    expect(wrapper.find('[data-gp-warning="meta.title_too_short"]').exists()).toBe(false)
    expect(wrapper.find('[data-gp-warning="meta.title_too_long"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Предупреждения не мешают сохранению')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1].body.metaTitle).toBe('А'.repeat(70))
  })

  it('uses the default title «<Название> — волейбол, <Город>» as placeholder', () => {
    const { wrapper } = mountBuilder()
    expect(field(wrapper, 'metaTitle').attributes('placeholder')).toBe(
      'VolleyTime Минск — волейбол, Минск',
    )
    expect(wrapper.find('[data-gp-warnings]').exists()).toBe(false)
  })
})

describe('GroupPageBuilder saving', () => {
  it('shows the unsaved-changes state, saves, toasts and clears it', async () => {
    const saved = makeView({ isDefault: false })
    const request = vi.fn().mockResolvedValue({ page: saved })
    const { wrapper, toast } = mountBuilder({ request })
    expect(wrapper.find('[data-gp-dirty]').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await field(wrapper, `sections.${idx('cover')}.headline`).setValue('Наша группа')
    expect(wrapper.find('[data-gp-dirty]').exists()).toBe(true)
    expect(wrapper.emitted('dirty')?.at(-1)).toEqual([true])
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(toast).toHaveBeenCalledWith('Страница группы сохранена', 'ok')
    expect(wrapper.find('[data-gp-dirty]').exists()).toBe(false)
    expect(wrapper.emitted('saved')).toHaveLength(1)
    const after = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })

  it('cancel restores the saved values', async () => {
    const { wrapper } = mountBuilder()
    const headline = field(wrapper, `sections.${idx('cover')}.headline`)
    await headline.setValue('Что-то другое')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Отменить правки')!
      .trigger('click')
    expect((headline.element as HTMLInputElement).value).toBe('')
  })

  it('maps a 422 to field errors, keeps the typed values and focuses the first error', async () => {
    const request = vi.fn().mockRejectedValue({
      statusCode: 422,
      data: {
        data: {
          code: 'validation_failed',
          issues: [{ path: ['sections', idx('about'), 'text'], message: 'Too big' }],
        },
      },
    })
    const { wrapper, toast } = mountBuilder({ request })
    const about = field(wrapper, `sections.${idx('about')}.text`)
    await about.setValue('Текст')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(about.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(about.element)
    expect(wrapper.find('.vt-settings-error--form').text()).toBe('Проверьте заполнение полей')
    expect((about.element as HTMLTextAreaElement).value).toBe('Текст')
    expect(wrapper.find('[data-gp-dirty]').exists()).toBe(true)
    expect(toast).not.toHaveBeenCalledWith('Страница группы сохранена', 'ok')
  })

  it('shows a venue error from the server in the venues section', async () => {
    const request = vi.fn().mockRejectedValue({
      statusCode: 422,
      data: { data: { code: 'group_page.venue_invalid' }, statusMessage: 'x' },
    })
    const { wrapper } = mountBuilder({ request })
    await section(wrapper, 'venues').find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(section(wrapper, 'venues').text()).toContain('Выберите залы из списка залов группы')
  })
})

describe('GroupPageBuilder preview', () => {
  it('renders enabled sections live from the form and switches desktop/phone', async () => {
    const { wrapper } = mountBuilder()
    const preview = () => wrapper.find('.vt-gp-preview')
    expect(preview().attributes('data-device')).toBe('desktop')
    expect(preview().find('[data-gp-block="cover"]').text()).toContain('VolleyTime Минск')
    await field(wrapper, `sections.${idx('cover')}.headline`).setValue('Играем по средам')
    expect(preview().find('[data-gp-block="cover"]').text()).toContain('Играем по средам')
    await section(wrapper, 'prices').find('[role="switch"]').trigger('click')
    expect(preview().find('[data-gp-block="prices"]').exists()).toBe(false)
    expect(preview().find('[data-gp-block="schedule"]').text()).toContain('Игра в среду')
    await wrapper.find('[data-gp-device="phone"]').trigger('click')
    expect(preview().attributes('data-device')).toBe('phone')
    expect(wrapper.find('[data-gp-device="phone"]').attributes('aria-pressed')).toBe('true')
  })

  it('follows the section order in the preview', async () => {
    const { wrapper } = mountBuilder()
    await section(wrapper, 'cover').find('[data-gp-move="cover:down"]').trigger('click')
    const blocks = wrapper
      .findAll('.vt-gp-preview [data-gp-block]')
      .map((b) => b.attributes('data-gp-block'))
    expect(blocks.slice(0, 2)).toEqual(['about', 'cover'])
  })
})

describe('GroupPageBuilder indexing', () => {
  const toggle = (wrapper: ReturnType<typeof mountBuilder>['wrapper']) =>
    wrapper.find('[aria-labelledby$="-label"][role="switch"]')
  const dialog = () => document.body.querySelector('[role="alertdialog"]')
  const button = (label: string) =>
    [...document.body.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
      (b) => b.textContent?.trim() === label,
    )

  it('asks for confirmation before enabling and sends nothing on cancel', async () => {
    const { wrapper, request } = mountBuilder()
    await toggle(wrapper).trigger('click')
    expect(dialog()?.textContent).toContain('Показывать страницу в поиске?')
    expect(dialog()?.textContent).toContain('Режим записи в группу не изменится')
    button('Отмена')!.click()
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    expect(toggle(wrapper).attributes('aria-checked')).toBe('false')
  })

  it('enables indexing through PATCH settings after confirmation', async () => {
    const request = vi.fn().mockResolvedValue({ settings: { seoIndex: true } })
    const { wrapper, toast } = mountBuilder({ request })
    await toggle(wrapper).trigger('click')
    button('Показывать в поиске')!.click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { seoIndex: true },
    })
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true')
    expect(toast).toHaveBeenCalledWith('Страница группы доступна поиску', 'ok')
  })

  it('asks for confirmation in the other direction too and keeps the value on a server error', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Нужны права владельца'))
    const { wrapper, toast } = mountBuilder({ request, view: makeView({ seoIndex: true }) })
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true')
    await toggle(wrapper).trigger('click')
    expect(dialog()?.textContent).toContain('Скрыть страницу от поиска?')
    button('Скрыть от поиска')!.click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { seoIndex: false },
    })
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true')
    expect(toast).toHaveBeenCalledWith('Не удалось изменить индексацию', 'danger')
  })
})

describe('GroupPageBuilder publishing (24.1.2)', () => {
  const sw = (wrapper: ReturnType<typeof mountBuilder>['wrapper']) =>
    wrapper.find('[data-gp-public] [role="switch"]')

  it('publishes the page through PATCH settings without a dialog and shows its address', async () => {
    const request = vi.fn().mockResolvedValue({ settings: { publicPageEnabled: true } })
    const { wrapper, toast } = mountBuilder({ request })
    expect(wrapper.find('[data-gp-public-link]').exists()).toBe(false)
    await sw(wrapper).trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { publicPageEnabled: true },
    })
    expect(sw(wrapper).attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-gp-public-link] a').attributes('href')).toBe('/g/volleytime-minsk')
    expect(toast).toHaveBeenCalledWith('Страница группы опубликована', 'ok')
  })

  it('keeps the value on a server error', async () => {
    const request = vi.fn().mockRejectedValue(new Error('x'))
    const { wrapper, toast } = mountBuilder({
      request,
      view: makeView({ publicPageEnabled: true }),
    })
    await sw(wrapper).trigger('click')
    await flushPromises()
    expect(sw(wrapper).attributes('aria-checked')).toBe('true')
    expect(toast).toHaveBeenCalledWith('Не удалось изменить публикацию', 'danger')
  })

  it('an organizer cannot publish', async () => {
    const { wrapper, request } = mountBuilder({ canEdit: false })
    await sw(wrapper).trigger('click')
    expect(request).not.toHaveBeenCalled()
  })
})

describe('GroupPageBuilder read-only (organizer)', () => {
  it('explains that only the owner edits and disables every editing control', async () => {
    const { wrapper, request } = mountBuilder({ canEdit: false })
    expect(wrapper.find('[data-gp-readonly]').text()).toContain('только владелец')
    for (const input of wrapper.findAll('input[type="text"], input:not([type]), textarea')) {
      expect(input.attributes('readonly')).toBeDefined()
    }
    for (const move of wrapper.findAll('[data-gp-move]')) {
      expect(move.attributes('disabled')).toBeDefined()
    }
    for (const box of wrapper.findAll('input[type="checkbox"]')) {
      expect(box.attributes('disabled')).toBeDefined()
    }
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-gp-faq-add]').exists()).toBe(false)
    const first = wrapper.find('[data-gp-section] [role="switch"]')
    await first.trigger('click')
    expect(first.attributes('aria-checked')).toBe('true')
    await wrapper.find('[aria-labelledby$="-label"][role="switch"]').trigger('click')
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
    expect(request).not.toHaveBeenCalled()
    // предпросмотр доступен и организатору
    await wrapper.find('[data-gp-device="phone"]').trigger('click')
    expect(wrapper.find('.vt-gp-preview').attributes('data-device')).toBe('phone')
  })
})
