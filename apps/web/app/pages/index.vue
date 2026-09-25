<script setup lang="ts">
import '~/assets/css/landing.css'
import {
  groupCreateHref,
  landingFaq,
  landingFeatures,
  landingSections,
  telegramBotHref,
} from '~/utils/landing'

const { user, fetchSession } = useAuth()
const sessionKnown = ref(false)
const createHref = computed(() => groupCreateHref(sessionKnown.value ? user.value !== null : null))
const botHref = computed(() => telegramBotHref(useRuntimeConfig().public.telegramBotUsername))

onMounted(async () => {
  try {
    await fetchSession()
  } finally {
    sessionKnown.value = true
  }
})

useHead({
  title: 'Volley Time — игра без чата и таблиц',
  meta: [
    {
      name: 'description',
      content:
        'Запись на волейбол, лист ожидания, оплаты и касса группы в одном месте. Создайте группу и пригласите игроков в Telegram Mini App.',
    },
  ],
})
</script>

<template>
  <div class="landing">
    <a class="landing__skip" href="#main-content">К содержанию</a>

    <header class="landing__header">
      <div class="landing__container landing__header-inner">
        <a class="landing__brand" href="#main-content" aria-label="Volley Time — к началу страницы">
          <img src="/logo.png" alt="" width="34" height="34" />
          <span>VOLLEY<span>TIME</span></span>
        </a>
        <nav class="landing__nav" aria-label="Основная навигация">
          <a
            v-for="section in landingSections"
            :key="section.id"
            class="landing__nav-section"
            :href="`#${section.id}`"
            >{{ section.label }}</a
          >
          <NuxtLink class="landing__login" to="/auth/login">Войти</NuxtLink>
          <NuxtLink
            class="landing__button landing__button--dark landing__header-cta"
            :to="createHref"
            >Создать группу</NuxtLink
          >
        </nav>
      </div>
    </header>

    <main id="main-content">
      <section class="landing__hero landing__container" aria-labelledby="landing-title">
        <div class="landing__hero-copy">
          <p class="landing__eyebrow">
            <span aria-hidden="true">✦</span> Бот и Mini App для волейбольных групп
          </p>
          <h1 id="landing-title">Игра<br />без чата<br /><em>и таблиц</em></h1>
          <p class="landing__lead">
            Вы публикуете тренировки, игроки записываются в Telegram. Места, лист ожидания, оплаты,
            абонементы и касса — без таблиц и переклички в чате.
          </p>
          <div class="landing__actions">
            <NuxtLink class="landing__button landing__button--dark" :to="createHref"
              >Создать группу <span aria-hidden="true">↗</span></NuxtLink
            >
            <a class="landing__text-link" href="#how-it-works"
              >Как это работает <span aria-hidden="true">↓</span></a
            >
          </div>
          <p class="landing__hero-note">Начните с группы, затем пригласите игроков.</p>
        </div>
        <div class="landing__hero-art">
          <div data-landing-canvas class="landing__canvas" aria-hidden="true"></div>
          <LandingPreview />
        </div>
      </section>

      <div class="landing__marquee" aria-label="Возможности Volley Time">
        <div class="landing__container landing__marquee-inner">
          <span>ЗАПИСЬ</span><i aria-hidden="true">✦</i><span>ОЧЕРЕДЬ</span
          ><i aria-hidden="true">✦</i><span>ОПЛАТЫ</span><i aria-hidden="true">✦</i
          ><span>КАССА</span><i aria-hidden="true">✦</i><span>АБОНЕМЕНТЫ</span>
        </div>
      </div>

      <section class="landing__story landing__container" aria-labelledby="story-title">
        <div class="landing__section-intro">
          <p class="landing__kicker">Знакомая ситуация?</p>
          <h2 id="story-title">Меньше переписки.<br />Больше игры.</h2>
        </div>
        <div class="landing__story-grid">
          <div class="landing__story-card landing__story-card--before">
            <span class="landing__card-label">Было</span>
            <h3>«Кто придёт в четверг?»</h3>
            <p>Ответы теряются в чате. Список участников и оплаты приходится сверять вручную.</p>
            <span class="landing__story-mark" aria-hidden="true">✕</span>
          </div>
          <div class="landing__story-card landing__story-card--after">
            <span class="landing__card-label">Стало</span>
            <h3>Состав виден сразу</h3>
            <p>Игроки записываются сами. Организатор видит места, очередь и статус оплаты.</p>
            <span class="landing__story-mark" aria-hidden="true">✓</span>
          </div>
        </div>
      </section>

      <section
        id="features"
        class="landing__features landing__container"
        aria-labelledby="features-title"
      >
        <div class="landing__section-intro">
          <p class="landing__kicker">Возможности MVP</p>
          <h2 id="features-title">Всё для тренировок.<br />Ничего лишнего.</h2>
          <p>Используйте то, что нужно вашей группе. Абонементы можно отключить в настройках.</p>
        </div>
        <div class="landing__feature-grid">
          <article
            v-for="(feature, index) in landingFeatures"
            :key="feature.title"
            class="landing__feature"
            :class="`landing__feature--${index + 1}`"
          >
            <span class="landing__feature-number">0{{ index + 1 }}</span>
            <span class="landing__feature-glyph" aria-hidden="true">{{
              ['↗', '₽', '▤', '◷'][index]
            }}</span>
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.body }}</p>
            </div>
          </article>
        </div>
      </section>

      <section id="how-it-works" class="landing__steps" aria-labelledby="steps-title">
        <div class="landing__container">
          <div class="landing__section-intro">
            <p class="landing__kicker">Три шага</p>
            <h2 id="steps-title">От группы<br />до игры.</h2>
          </div>
          <ol class="landing__step-list">
            <li>
              <span>01</span>
              <div>
                <h3>Создайте группу</h3>
                <p>Войдите по email и настройте свою волейбольную группу.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Опубликуйте тренировку</h3>
                <p>Укажите время, место и количество мест, затем поделитесь приглашением.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Играйте</h3>
                <p>Игроки записываются в Mini App, а вы видите состав и отмечаете оплаты.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="landing__roles landing__container" aria-labelledby="roles-title">
        <div class="landing__section-intro">
          <p class="landing__kicker">Каждому — своё</p>
          <h2 id="roles-title">Организатору<br />и игроку.</h2>
        </div>
        <div class="landing__roles-grid">
          <article class="landing__role landing__role--organizer">
            <span class="landing__card-label">Организатор</span>
            <h3>Планируйте, а не пересчитывайте.</h3>
            <p>
              Создавайте события, проверяйте состав, подтверждайте оплаты и смотрите кассу группы.
            </p>
            <NuxtLink :to="createHref">Создать группу <span aria-hidden="true">↗</span></NuxtLink>
          </article>
          <article class="landing__role landing__role--player">
            <span class="landing__card-label">Игрок</span>
            <h3>Записаться — в пару касаний.</h3>
            <p>
              Открывайте приглашение группы в Telegram, выбирайте тренировку и смотрите свою запись.
            </p>
            <a v-if="botHref" :href="botHref" rel="noopener noreferrer"
              >Открыть бота <span aria-hidden="true">↗</span></a
            >
          </article>
        </div>
      </section>

      <section id="faq" class="landing__faq landing__container" aria-labelledby="faq-title">
        <div class="landing__section-intro">
          <p class="landing__kicker">Коротко о главном</p>
          <h2 id="faq-title">Вопросы<br />и ответы.</h2>
        </div>
        <div class="landing__faq-list">
          <details v-for="item in landingFaq" :key="item.question">
            <summary>{{ item.question }}<span aria-hidden="true">+</span></summary>
            <p>{{ item.answer }}</p>
          </details>
        </div>
      </section>

      <section class="landing__final" aria-labelledby="final-title">
        <div data-landing-canvas class="landing__canvas" aria-hidden="true"></div>
        <div class="landing__container landing__final-inner">
          <p class="landing__kicker">До встречи на площадке</p>
          <h2 id="final-title">Соберите группу.<br />Играйте чаще.</h2>
          <p>Запись, состав и оплаты — в одном месте. Начните с вашей первой группы.</p>
          <NuxtLink class="landing__button landing__button--light" :to="createHref"
            >Создать группу <span aria-hidden="true">↗</span></NuxtLink
          >
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <div class="landing__container landing__footer-inner">
        <span class="landing__footer-brand">VOLLEY<span>TIME</span></span>
        <nav aria-label="Навигация в подвале">
          <a v-for="section in landingSections" :key="section.id" :href="`#${section.id}`">{{
            section.label
          }}</a>
          <a href="#main-content">Наверх ↑</a>
        </nav>
        <small>© {{ new Date().getFullYear() }} Volley Time</small>
      </div>
    </footer>
  </div>
</template>
