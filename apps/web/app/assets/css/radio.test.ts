// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- independent mounted production fieldset states */
import { readFileSync } from 'node:fs'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, reactive } from 'vue'

const css = readFileSync('apps/web/app/assets/css/main.css', 'utf8')

describe('branded native membership policy radios', () => {
  for (const surface of ['app', 'm']) {
    it(`${surface} keeps the adjacent native checkbox at 20 CSS pixels independent of root font size`, () => {
      const source = readFileSync(`apps/web/app/pages/${surface}/orgs/[orgId]/settings.vue`, 'utf8')
      const checkbox = source.match(/<input\s[^>]*type="checkbox"[^>]*>/)?.[0] ?? ''
      expect(checkbox).toContain('h-[20px] w-[20px]')
      expect(checkbox).toContain('accent-vt-flame')
      expect(checkbox).toContain('v-model="form.subscriptionsEnabled"')
    })

    it(`${surface} groups labeled native inputs and retains the policy model and disabled state`, async () => {
      const source = readFileSync(`apps/web/app/pages/${surface}/orgs/[orgId]/settings.vue`, 'utf8')
      const template = source.match(/<fieldset>[\s\S]*?<\/fieldset>/)?.[0]
      const form = reactive({ defaultMemberStatus: 'active' })
      const wrapper = mount(
        defineComponent({ setup: () => ({ form, saving: false, archiving: false }), template }),
      )
      const inputs = wrapper.findAll('input')
      expect(inputs).toHaveLength(2)
      expect(inputs.map((input) => input.attributes('type'))).toEqual(['radio', 'radio'])
      expect(inputs.map((input) => input.attributes('value'))).toEqual(['active', 'pending'])
      expect(inputs[0]!.attributes('name')).toBeTruthy()
      expect(inputs[1]!.attributes('name')).toBe(inputs[0]!.attributes('name'))
      for (const input of inputs) {
        expect(input.classes()).toContain('vt-radio')
        expect(input.element.closest('label')?.textContent?.trim()).toBeTruthy()
      }
      await inputs[1]!.setValue()
      expect(form.defaultMemberStatus).toBe('pending')
      expect((inputs[0]!.element as HTMLInputElement).checked).toBe(false)
      expect((inputs[1]!.element as HTMLInputElement).checked).toBe(true)
      wrapper.unmount()
      const disabled = mount(
        defineComponent({ setup: () => ({ form, saving: true, archiving: false }), template }),
      )
      expect(
        disabled.findAll('input').every((input) => input.attributes('disabled') !== undefined),
      ).toBe(true)
      disabled.unmount()
    })
  }

  it('defines a 20px circular control, checked dot, focus and forced-colors fallback', () => {
    const rule = css.match(/\.vt-radio\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(rule).toContain('appearance: none')
    expect(rule).toContain('width: 20px')
    expect(rule).toContain('height: 20px')
    expect(rule).toContain('border-radius: 50%')
    expect(css).toMatch(/\.vt-radio:checked\s*\{[^}]*radial-gradient/)
    expect(css).toMatch(/\.vt-radio:focus-visible\s*\{[^}]*outline: 2px solid var\(--vt-focus\)/)
    expect(css).toMatch(/\.vt-radio:disabled\s*\{[^}]*cursor: not-allowed/)
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*\.vt-radio[\s\S]*appearance: auto/)
  })
})
