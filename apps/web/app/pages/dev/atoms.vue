<script setup lang="ts">
import { ref } from 'vue'

import { useToast } from '~/composables/useToast'

/**
 * Dev-only витрина атомов v3 (задача 19.1.3) для визуальной сверки с `1 Brand and System`.
 * Маршрут исключается из production-сборки в nuxt.config.ts (хук pages:extend).
 */
definePageMeta({ layout: false })

const toggles = ref({ cancel: true, report: false })
const view = ref('list')
const remind = ref('1h')
const kind = ref('Аренда зала')
const venue = ref('v1')
const level = ref('v3')
const menuOpen = ref(false)
const alertOpen = ref(false)
const sheetOpen = ref(false)
const { show } = useToast()

const toggleRows = [
  { key: 'cancel', label: 'Разрешить отмену записи' },
  { key: 'report', label: 'Еженедельный отчёт' },
] as const
const venues = [
  { value: 'v1', label: 'Школа №24, малый зал', sub: '15 Br/ч' },
  { value: 'v2', label: 'СК «Заслонова»', sub: '20 Br/ч' },
  { value: 'v3', label: 'Школа №3, большой зал', sub: '25 Br/ч' },
]
const levels = [
  { value: 'all', label: 'Любой' },
  { value: 'v2', label: 'В2 · сильный любительский' },
  { value: 'v3', label: 'В3 · средний любительский' },
  { value: 'v4_plus', label: 'В4+ · начинающие' },
]
const reminders = [
  { value: '1h', label: 'за 1 ч' },
  { value: '2h', label: 'за 2 ч' },
  { value: '6h', label: 'за 6 ч' },
  { value: '24h', label: 'за 24 ч' },
]
const kinds = ['Аренда зала', 'Мячи', 'Судья', 'Прочее'].map((k) => ({ value: k, label: k }))
const menuItems = [
  { key: 'edit', label: 'Редактировать', shortcut: 'E' },
  { key: 'copy', label: 'Копировать ссылку' },
  { key: 'del', label: 'Удалить', tone: 'danger' as const },
]
</script>

<template>
  <main class="atoms-demo">
    <h1 class="atoms-demo__title">Формы и контролы</h1>
    <div class="atoms-demo__card">
      <div class="atoms-demo__col">
        <section>
          <div class="vt-cap atoms-demo__cap">Toggle · переключатели</div>
          <div class="atoms-demo__stack">
            <div v-for="row in toggleRows" :key="row.key" class="atoms-demo__row">
              <span :id="`t-${row.key}`" class="atoms-demo__row-label">{{ row.label }}</span>
              <VtToggle v-model="toggles[row.key]" :labelledby="`t-${row.key}`" />
            </div>
          </div>
        </section>
        <section>
          <div class="vt-cap atoms-demo__cap">Segmented · сегменты</div>
          <VtSegment
            v-model="view"
            label="Вид"
            :options="[
              { value: 'list', label: 'Список' },
              { value: 'cal', label: 'Календарь' },
            ]"
          />
          <div class="atoms-demo__gap">
            <VtSegment v-model="remind" label="Напоминание" variant="chips" :options="reminders" />
          </div>
        </section>
        <section>
          <div class="vt-cap atoms-demo__cap">Действия · popover, alert, toast, sheet</div>
          <div class="atoms-demo__actions">
            <VtPopover v-model="menuOpen" label="Действия" :items="menuItems">
              <template #trigger="{ toggle, attrs }">
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  v-bind="attrs"
                  @click="toggle"
                >
                  Ещё
                </button>
              </template>
            </VtPopover>
            <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="alertOpen = true">
              Alert
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              @click="show('Ссылка скопирована')"
            >
              Toast
            </button>
            <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="sheetOpen = true">
              Sheet
            </button>
          </div>
        </section>
      </div>
      <div class="atoms-demo__col">
        <section>
          <div class="vt-cap atoms-demo__cap">Fields · поля</div>
          <div class="atoms-demo__stack atoms-demo__stack--fields">
            <div>
              <label id="l-venue" class="vt-label">Зал</label>
              <VtSelect v-model="venue" labelledby="l-venue" :options="venues" />
            </div>
            <div>
              <label id="l-level" class="vt-label">Уровень</label>
              <VtSelect v-model="level" labelledby="l-level" :options="levels" />
            </div>
          </div>
        </section>
        <section>
          <div class="vt-cap atoms-demo__cap">Chip-buttons · чипы-кнопки</div>
          <VtSegment v-model="kind" label="Категория расхода" variant="chips" :options="kinds" />
        </section>
      </div>
    </div>
    <VtAlert
      v-model="alertOpen"
      title="Отменить запись?"
      body="Место уйдёт первому из листа ожидания."
      confirm-label="Отменить запись"
      cancel-label="Оставить"
      danger
    />
    <VtSheet v-model="sheetOpen" title="Действия">
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--full" @click="sheetOpen = false">
        Закрыть
      </button>
    </VtSheet>
    <VtToast />
  </main>
</template>

<style scoped>
.atoms-demo {
  min-height: 100vh;
  padding: 32px;
  background: var(--vt-bone);
  color: var(--vt-ink);
}
.atoms-demo__title {
  margin: 0 0 14px;
  font-family: var(--f-display);
  font-size: 32px;
  font-weight: 700;
  text-transform: uppercase;
}
.atoms-demo__card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 32px;
  background: var(--vt-paper);
  border-radius: 28px;
  box-shadow: var(--vt-shadow-card);
}
.atoms-demo__col {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.atoms-demo__cap {
  margin-bottom: 10px;
  color: var(--vt-mute-2);
}
.atoms-demo__stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 300px;
}
.atoms-demo__stack--fields {
  max-width: 320px;
  gap: 12px;
}
.atoms-demo__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--r-chip);
  background: var(--vt-ctl);
  border: 1px solid var(--vt-stroke);
}
.atoms-demo__row-label {
  flex: 1;
  font-size: var(--fs-sm);
  font-weight: 500;
}
.atoms-demo__gap {
  margin-top: 10px;
}
.atoms-demo__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .atoms-demo__card {
    grid-template-columns: 1fr;
  }
}
</style>
