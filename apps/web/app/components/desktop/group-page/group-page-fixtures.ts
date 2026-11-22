import { defaultGroupPageContent, type GroupPageView } from '@volley-time/shared'

/** Ответ GET страницы группы для интеракционных тестов конструктора и предпросмотра. */
export function makeView(over: Partial<GroupPageView> = {}): GroupPageView {
  return {
    content: defaultGroupPageContent(),
    isDefault: true,
    updatedAt: null,
    seoIndex: false,
    group: {
      id: 7,
      name: 'VolleyTime Минск',
      slug: 'volleytime-minsk',
      city: 'Минск',
      district: 'Центр',
      levels: ['v2', 'v3'],
      defaultJoinMode: 'open',
      timezone: 'Europe/Minsk',
      logoUpdatedAt: null,
    },
    venues: [
      { id: 1, name: 'Спорткомплекс «Олимп»', address: 'ул. Мира, 5' },
      { id: 2, name: 'Школа №12', address: null },
    ],
    upcomingEvents: [
      {
        id: 11,
        title: 'Игра в среду',
        startsAt: '2026-12-02T17:00:00.000Z',
        endsAt: '2026-12-02T19:00:00.000Z',
        status: 'published',
        joinMode: 'open',
        venueId: 1,
        publicSlug: 'igra-v-sredu',
      },
    ],
    resolved: {
      metaTitle: 'VolleyTime Минск — волейбол, Минск',
      metaDescription:
        'VolleyTime Минск — волейбольная группа в городе Минск. Расписание игр, цены, залы и запись онлайн.',
      joinText:
        'Откройте ближайшую игру в Telegram и нажмите «Записаться» — место закрепится сразу.',
    },
    warnings: [],
    ...over,
  }
}

export const levelTitles = { v2: 'В2 · Начинающий', v3: 'В3 · Средний' }

export const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
}
