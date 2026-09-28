<script setup lang="ts">
import '~/assets/css/landing-fonts.css'
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
            <VtIcon name="tg" :size="14" /> Бот и Mini App для волейбольных групп
          </p>
          <h1 id="landing-title">Игра<br />без чата<br /><em>и таблиц</em></h1>
          <p class="landing__lead">
            Вы публикуете тренировки, игроки записываются в Telegram. Места, лист ожидания, оплаты,
            абонементы и касса — без таблиц и переклички в чате.
          </p>
          <div class="landing__actions">
            <NuxtLink class="landing__button landing__button--orange" :to="createHref"
              >Создать группу <span aria-hidden="true">↗</span></NuxtLink
            >
            <a class="landing__button landing__button--ghost" href="#how-it-works"
              >Как это работает <span aria-hidden="true">↓</span></a
            >
          </div>
          <p class="landing__hero-note">
            <span><VtIcon name="check" :size="16" /> Создайте группу</span
            ><span><VtIcon name="check" :size="16" /> Пригласите игроков</span>
          </p>
        </div>
        <div class="landing__hero-art">
          <LandingPreview />
        </div>
      </section>

      <div class="landing__marquee" aria-label="Возможности Volley Time">
        <div class="landing__container landing__marquee-inner">
          <template v-for="copy in 2" :key="copy">
            <template
              v-for="label in [
                'Запись на тренировку',
                'Лист ожидания',
                'Оплаты',
                'Касса',
                'Абонементы',
                'Расписание',
              ]"
              :key="label"
            >
              <span :aria-hidden="copy === 2 ? true : undefined">{{ label }}</span
              ><i aria-hidden="true"></i>
            </template>
          </template>
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
            <div class="landing__story-body">
              <div class="landing__bubble">
                <small>Организатор</small>Кто в четверг? Ставьте плюсы
              </div>
              <div class="landing__bubble landing__bubble--reply">+1</div>
              <div class="landing__bubble"><small>Игрок</small>А места ещё есть?</div>
              <div class="landing__bubble"><small>Организатор</small>Кто уже перевёл за зал?</div>
              <div class="landing__bubble"><small>Игрок</small>Я не смогу. Кто вместо?</div>
            </div>
          </div>
          <div class="landing__story-card landing__story-card--after">
            <span class="landing__card-label">Стало</span>
            <h3>Состав виден сразу</h3>
            <div class="landing__story-body">
              <div class="landing__event-example">
                <div class="landing__event-heading">
                  <div>
                    <span class="landing__card-label">Пример · четверг · 20:00</span>
                    <h4>Тренировка</h4>
                  </div>
                  <strong>12/14</strong>
                </div>
                <div class="landing__segments" aria-label="12 из 14 мест заняты">
                  <i
                    v-for="index in 14"
                    :key="index"
                    :data-filled="index <= 12 ? '' : undefined"
                  ></i>
                </div>
                <div class="landing__example-tags">
                  <span class="landing__chip">9 оплатили</span
                  ><span class="landing__chip landing__chip--pending">3 ждут оплаты</span
                  ><span class="landing__chip landing__chip--queue">2 в очереди</span>
                </div>
              </div>
              <p>Игроки записываются сами. Организатор видит места, очередь и статус оплаты.</p>
            </div>
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
            <span class="landing__feature-glyph"
              ><VtIcon
                :name="['users', 'wallet', 'calendar', 'chart', 'ticket', 'users'][index]!"
                :size="24"
                :stroke-width="1.8"
            /></span>
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.body }}</p>
            </div>
            <div class="landing__feature-visual" aria-hidden="true">
              <template v-if="index === 0">
                <strong>12 <small>/ 14 мест</small></strong>
                <div class="landing__segments">
                  <i
                    v-for="place in 14"
                    :key="place"
                    :data-filled="place <= 12 ? '' : undefined"
                  ></i>
                </div>
              </template>
              <strong v-else-if="index === 1">Наличные<br />или перевод</strong>
              <strong v-else-if="index === 2">СР · 20:00</strong>
              <template v-else-if="index === 3">
                <div class="landing__ledger-row">
                  <VtIcon name="check" /> Оплата тренировки <small>Приход</small>
                </div>
                <div class="landing__ledger-row">
                  <VtIcon name="wallet" /> Аренда зала <small>Расход</small>
                </div>
              </template>
              <strong v-else-if="index === 4">5 <small>/ 8 тренировок</small></strong>
              <div v-else class="landing__roster-example">
                <i v-for="player in 4" :key="player"><VtIcon name="user" /></i>
              </div>
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
        <h2 id="roles-title" class="landing__visually-hidden">Организатору и игроку</h2>
        <div class="landing__roles-grid">
          <article class="landing__role landing__role--organizer">
            <span class="landing__card-label">Организатор</span>
            <h3>Планируйте, а не пересчитывайте.</h3>
            <ul>
              <li><VtIcon name="check" /> Создавайте события и проверяйте состав</li>
              <li><VtIcon name="check" /> Подтверждайте наличные и переводы</li>
              <li><VtIcon name="check" /> Смотрите кассу и остатки абонементов</li>
            </ul>
            <NuxtLink :to="createHref">Создать группу <span aria-hidden="true">↗</span></NuxtLink>
          </article>
          <article class="landing__role landing__role--player">
            <span class="landing__card-label">Игрок</span>
            <h3>Записаться — в пару касаний.</h3>
            <ul>
              <li><VtIcon name="check" /> Открывайте приглашение в Telegram</li>
              <li><VtIcon name="check" /> Выбирайте тренировку и записывайтесь</li>
              <li><VtIcon name="check" /> Смотрите свою запись и абонемент</li>
            </ul>
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
            <summary>
              {{ item.question }}<span aria-hidden="true"><VtIcon name="plus" :size="18" /></span>
            </summary>
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
          <div class="landing__actions">
            <NuxtLink class="landing__button landing__button--orange" :to="createHref"
              >Создать группу <span aria-hidden="true">↗</span></NuxtLink
            >
          </div>
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <div class="landing__container landing__footer-inner">
        <div>
          <a class="landing__footer-brand" href="#main-content"
            ><img src="/logo.png" alt="" width="32" height="32" /><span
              >VOLLEY<span>TIME</span></span
            ></a
          >
          <p class="landing__footer-copy">
            Волейбольная группа без чата и таблиц. Запись, состав и оплаты — в одном месте.
          </p>
        </div>
        <nav aria-label="Навигация в подвале">
          <a v-for="section in landingSections" :key="section.id" :href="`#${section.id}`">{{
            section.label
          }}</a>
          <a href="#main-content">Наверх ↑</a>
        </nav>
        <nav aria-label="Приложение">
          <NuxtLink to="/auth/login">Войти</NuxtLink
          ><NuxtLink :to="createHref">Создать группу</NuxtLink
          ><a v-if="botHref" :href="botHref" rel="noopener noreferrer">Telegram</a>
        </nav>
      </div>
      <div class="landing__container landing__footer-bottom">
        <small>© {{ new Date().getFullYear() }} Volley Time</small>
        <span>volleytime.by</span>
      </div>
    </footer>
    <LandingMotion />
  </div>
</template>
