// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import ErrorPage from './error.vue'

import EmptyState from '~/components/EmptyState.vue'

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('clearError', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

function render(statusCode: number) {
  return mount(ErrorPage, {
    props: { error: { statusCode } },
    global: { components: { EmptyState }, stubs: { VtIcon: true } },
  })
}

describe('error page', () => {
  it('403 (R-15, a Root Admin section the role may not open) says there is no access', () => {
    const w = render(403)
    expect(w.text()).toContain('Нет доступа к разделу')
    expect(w.text()).not.toContain('Что-то пошло не так')
  })

  it('keeps the existing texts for 404 and other errors', () => {
    expect(render(404).text()).toContain('Страница не найдена')
    expect(render(500).text()).toContain('Что-то пошло не так')
  })
})
