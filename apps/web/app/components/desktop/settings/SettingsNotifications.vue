<script setup lang="ts">
/**
 * Уведомления бота. Отдельных настроек в группе пока нет (нет API), поэтому список только
 * показывает, что приходит игрокам и организаторам; переключателей нет, чтобы не обещать лишнего.
 */
const GROUPS = [
  {
    title: 'Игрокам',
    items: [
      ['Запись подтверждена', 'Сразу после записи или подтверждения оплаты.'],
      ['Ждёт оплаты и лист ожидания', 'Когда запись требует оплаты или стоит в очереди.'],
      ['Освободилось место', 'Первому из листа ожидания.'],
      ['Оплата подтверждена или отклонена', 'После решения организатора.'],
      ['Событие отменено', 'Всем записанным.'],
      ['Напоминания за 24 часа и за 2 часа', 'Игрокам основного состава.'],
    ],
  },
  {
    title: 'Организаторам',
    items: [
      ['Оплата ждёт подтверждения', 'Когда игрок отметил оплату.'],
      ['Итог делёжа суммы', 'После закрытия записи на событие с делением суммы.'],
    ],
  },
] as const
</script>

<template>
  <div class="vt-settings-stack">
    <section v-for="group in GROUPS" :key="group.title" class="vt-card vt-settings-card">
      <div class="vt-settings-card__head">
        <h2 class="vt-settings-card__title">{{ group.title }}</h2>
        <span class="vt-chip">всегда включено</span>
      </div>
      <ul class="vt-settings-list">
        <li v-for="[title, hint] in group.items" :key="title" class="vt-settings-list__item">
          <span class="vt-settings-row__title">{{ title }}</span>
          <span class="vt-settings-hint">{{ hint }}</span>
        </li>
      </ul>
    </section>
    <p class="vt-settings-hint">
      Отключать отдельные уведомления группа пока не может: бот шлёт их всегда.
    </p>
  </div>
</template>
