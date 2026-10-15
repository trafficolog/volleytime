<script setup lang="ts">
/** Интеграции: Telegram-бот группы. Статус webhook и тест-сообщение требуют API и не показываются. */
const props = defineProps<{ botUsername: string; base: string }>()
const botLink = props.botUsername ? `https://t.me/${props.botUsername}` : ''
</script>

<template>
  <section class="vt-card vt-settings-card">
    <h2 class="vt-settings-card__title">Telegram-бот</h2>
    <p class="vt-settings-hint">
      Через бота игроки открывают Mini App группы, а группа отправляет уведомления о записи и
      оплате.
    </p>
    <dl class="vt-settings-facts">
      <dt>Бот</dt>
      <dd v-if="botUsername">
        <a :href="botLink" class="vt-settings-link" target="_blank" rel="noopener noreferrer">
          @{{ botUsername }}
        </a>
      </dd>
      <dd v-else>Имя бота не настроено на сервере</dd>
    </dl>
    <p class="vt-settings-hint">
      Приглашения со ссылкой на бота создаются на странице «Приглашения».
    </p>
    <div class="vt-settings-actions vt-settings-actions--start">
      <NuxtLink :to="`${base}/invite`" class="vt-btn vt-btn--ghost vt-btn--sm">
        Открыть приглашения
      </NuxtLink>
    </div>
  </section>
</template>
