// @vitest-environment happy-dom
import { defaultPlayerFeatures, type PlayerFeatures } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import HomeTodayBlocks from './HomeTodayBlocks.vue'

import { visibleHomeBlocks, type HomeBlockData } from '~/utils/home-blocks'

const none = (): PlayerFeatures =>
  Object.fromEntries(Object.keys(defaultPlayerFeatures()).map((k) => [k, false])) as PlayerFeatures

/** Повторяет связку страницы: флаги (me-features) + данные -> блоки -> каркас со слотами. */
function harness(data: HomeBlockData, initial: PlayerFeatures) {
  const features = ref(initial)
  const blocks = computed(() => visibleHomeBlocks(features.value, data))
  const Host = defineComponent({
    render: () =>
      h(
        HomeTodayBlocks,
        { blocks: blocks.value },
        {
          teams: () => h('h3', 'Составы'),
          coach: () => h('h3', 'Неделя тренера'),
          wrapped: () => h('h3', 'Итоги сезона'),
        },
      ),
  })
  return { features, wrapper: mount(Host) }
}

describe('HomeTodayBlocks (23.2.1)', () => {
  it('renders nothing, not even the «Сегодня» header, when no block is visible', () => {
    const { wrapper } = harness({}, defaultPlayerFeatures())
    expect(wrapper.html()).not.toContain('Сегодня')
    expect(wrapper.find('[data-testid="home-today"]').exists()).toBe(false)
  })

  it('renders the injected blocks under one «Сегодня» header', () => {
    const { wrapper } = harness({ teams: [1], coach: { w: 1 } }, defaultPlayerFeatures())
    expect(wrapper.findAll('h2')).toHaveLength(1)
    expect(wrapper.get('h2').text()).toBe('Сегодня')
    expect(
      wrapper.findAll('[data-home-block]').map((n) => n.attributes('data-home-block')),
    ).toEqual(['teams', 'coach'])
  })

  it('removes a block when its flag flips off, without remounting', async () => {
    const { wrapper, features } = harness({ teams: [1], coach: { w: 1 } }, defaultPlayerFeatures())
    features.value = { ...features.value, teams: false }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-home-block="teams"]').exists()).toBe(false)
    expect(wrapper.find('[data-home-block="coach"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Составы')
  })

  it('drops the «Сегодня» header with the last block (Только игры)', async () => {
    const { wrapper, features } = harness({ teams: [1], coach: { w: 1 } }, defaultPlayerFeatures())
    features.value = none()
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).not.toContain('Сегодня')
    features.value = { ...none(), coach: true }
    await wrapper.vm.$nextTick()
    expect(wrapper.get('h2').text()).toBe('Сегодня')
    expect(wrapper.findAll('[data-home-block]')).toHaveLength(1)
  })

  it('does not draw a visible block that has no content slot (no empty header)', () => {
    const { wrapper } = harness({ warmup: { x: 1 } }, defaultPlayerFeatures())
    expect(wrapper.html()).not.toContain('Сегодня')
    expect(wrapper.find('[data-home-block]').exists()).toBe(false)
  })
})
