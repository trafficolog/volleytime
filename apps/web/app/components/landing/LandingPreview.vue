<template>
  <div class="landing-preview">
    <p class="landing-preview__caption">Пример интерфейса</p>
    <div class="landing-preview__scene" aria-hidden="true">
      <div data-landing-canvas class="landing__canvas"></div>
      <div class="landing-preview__orbit landing-preview__orbit--one"></div>
      <div class="landing-preview__orbit landing-preview__orbit--two"></div>
      <div class="landing-preview__phone landing-preview__phone--player">
        <div class="landing-preview__screen">
          <div class="landing-preview__status"><span>9:41</span><span>•••</span></div>
          <div class="landing-preview__body">
            <span class="landing-preview__hi">Ваша волейбольная группа</span>
            <strong class="landing-preview__title">Пора на площадку</strong>
            <div class="landing-preview__event">
              <div class="landing-preview__cap">Ближайшая тренировка</div>
              <div class="landing-preview__time">20:00</div>
              <div class="landing-preview__meta">Среда · спортивный зал</div>
              <div class="landing-preview__pill">Записаться на тренировку</div>
            </div>
            <div class="landing-preview__tiles">
              <div class="landing-preview__tile">
                <strong>12 / 14</strong><small>Места в составе</small>
              </div>
              <div class="landing-preview__tile landing-preview__tile--orange">
                <strong>5 / 8</strong><small>Остаток абонемента</small>
              </div>
            </div>
            <div class="landing-preview__section-title">Расписание <span>Все события</span></div>
            <div
              v-for="(day, index) in ['СР', 'ПТ', 'ВС']"
              :key="day"
              class="landing-preview__schedule"
            >
              <span class="landing-preview__date">{{ day }}</span>
              <div><strong>Тренировка</strong><small>20:00 · спортивный зал</small></div>
              <span class="landing-preview__badge">{{
                index === 0 ? 'Запись' : 'Места есть'
              }}</span>
            </div>
          </div>
          <div class="landing-preview__dock"><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="landing-preview__phone landing-preview__phone--roster">
        <div class="landing-preview__screen">
          <div class="landing-preview__status"><span>9:41</span><span>•••</span></div>
          <div class="landing-preview__body">
            <span class="landing-preview__hi">Организатор · пример события</span>
            <strong class="landing-preview__title">Состав тренировки</strong>
            <div class="landing-preview__event">
              <div class="landing-preview__cap">Среда · 20:00</div>
              <div class="landing-preview__time">12 / 14</div>
              <div class="landing-preview__meta">Участники записаны</div>
            </div>
            <div class="landing__segments">
              <i v-for="index in 14" :key="index" :data-filled="index <= 12 ? '' : undefined"></i>
            </div>
            <div class="landing-preview__section-title">Участники <span>Состав</span></div>
            <div v-for="index in 6" :key="index" class="landing-preview__row">
              <span class="landing-preview__avatar">{{ index }}</span>
              <strong>Игрок {{ index }}</strong>
              <span class="landing-preview__badge">{{ index < 5 ? 'Оплачено' : 'Ожидает' }}</span>
            </div>
            <div class="landing-preview__section-title">Лист ожидания <span>2 игрока</span></div>
          </div>
          <div class="landing-preview__dock"><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="landing-preview__float landing-preview__float--places">
        <span class="landing-preview__float-icon"><VtIcon name="check" :size="20" /></span>
        <span>Запись подтверждена<small>Место в составе</small></span>
      </div>
      <div class="landing-preview__float landing-preview__float--cash">
        <span class="landing-preview__float-icon"><VtIcon name="wallet" :size="20" /></span>
        <span>Касса группы<small>Оплаты под контролем</small></span>
      </div>
    </div>
  </div>
</template>
