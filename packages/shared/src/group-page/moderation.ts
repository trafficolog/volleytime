/**
 * Модерация страниц групп (24.1.3, R-06; макет владельца 2026-11-23,
 * `docs/design/reference-v3/handoff/screens-moderation.jsx`). Решение root действует поверх
 * настроек владельца: `hidden` — страница отдаёт тот же 404, что неопубликованная, и пропадает из
 * поиска, sitemap и каталога города; `noindex` — страница открывается по ссылке, но закрыта от
 * поиска, sitemap и каталога, даже если владелец включил индексацию. Решения нет — всё решают
 * `publicPageEnabled` и `seoIndex` владельца.
 */

/** Решение root по странице группы; отсутствие решения — `null`. */
export const GROUP_PAGE_MODERATION_STATES = ['noindex', 'hidden'] as const
export type GroupPageModerationState = (typeof GROUP_PAGE_MODERATION_STATES)[number]

/**
 * Состояние страницы в Root Admin: `index` — в поиске; `own` — noindex по настройке владельца;
 * `noindex` и `hidden` — решение root.
 */
export type GroupPagePublicState = 'index' | 'own' | GroupPageModerationState

/** Причины решения root: организатор видит `title` в кабинете и в боте. */
export const GROUP_PAGE_MODERATION_REASONS = [
  {
    code: 'price',
    title: 'Цены не совпадают с записью',
    description: 'Цена на странице отличается от цены при записи',
  },
  {
    code: 'pay',
    title: 'Оплата в обход записи',
    description: 'Ссылки на сторонние сайты оплаты, реквизиты',
  },
  {
    code: 'promise',
    title: 'Вводящие в заблуждение обещания',
    description: '«Гарантированное место», «бесплатно» при платной записи',
  },
  {
    code: 'media',
    title: 'Чужие или неподходящие фото',
    description: 'Фото без прав или не про волейбол',
  },
  {
    code: 'inactive',
    title: 'Группа не проводит игры',
    description: 'Нет событий больше 60 дней',
  },
  {
    code: 'spam',
    title: 'Спам или контакты в заголовках',
    description: 'Телефоны, @ники, ключевые слова в H1 и Title',
  },
] as const
export type GroupPageModerationReason = (typeof GROUP_PAGE_MODERATION_REASONS)[number]['code']
export const GROUP_PAGE_MODERATION_REASON_CODES = GROUP_PAGE_MODERATION_REASONS.map(
  (r) => r.code,
) as [GroupPageModerationReason, ...GroupPageModerationReason[]]

/** «Что исправить» — необязательная заметка root организатору. */
export const GROUP_PAGE_MODERATION_NOTE_MAX = 1000

export function groupPageModerationReasonTitle(code: string): string {
  return GROUP_PAGE_MODERATION_REASONS.find((r) => r.code === code)?.title ?? code
}

/** Причины жалобы посетителя на публичной странице (кнопка «Пожаловаться»). */
export const GROUP_PAGE_COMPLAINT_REASONS = [
  { code: 'price', title: 'Цены не совпадают с записью' },
  { code: 'inactive', title: 'Группа не существует или не играет' },
  { code: 'media', title: 'Чужие фото или текст' },
  { code: 'fraud', title: 'Обман или мошенничество' },
  { code: 'other', title: 'Другое' },
] as const
export type GroupPageComplaintReason = (typeof GROUP_PAGE_COMPLAINT_REASONS)[number]['code']
export const GROUP_PAGE_COMPLAINT_REASON_CODES = GROUP_PAGE_COMPLAINT_REASONS.map(
  (r) => r.code,
) as [GroupPageComplaintReason, ...GroupPageComplaintReason[]]

/** «Подробности · необязательно»: до 500 символов. */
export const GROUP_PAGE_COMPLAINT_DETAILS_MAX = 500
/** Не больше 3 жалоб за скользящие сутки с одного устройства (хеш адреса клиента). */
export const GROUP_PAGE_COMPLAINTS_PER_DAY = 3

export function groupPageComplaintReasonTitle(code: string): string {
  return GROUP_PAGE_COMPLAINT_REASONS.find((r) => r.code === code)?.title ?? code
}

/** Статус жалобы: `new` — ждёт модератора; `rejected` — нарушений нет; `resolved` — решение по странице. */
export const GROUP_PAGE_COMPLAINT_STATUSES = ['new', 'rejected', 'resolved'] as const
export type GroupPageComplaintStatus = (typeof GROUP_PAGE_COMPLAINT_STATUSES)[number]

/**
 * Итог жалобы: `no_violation` — отклонена; `hidden` / `noindex` — по ней принято решение root.
 */
export type GroupPageComplaintResolution = 'no_violation' | GroupPageModerationState

/**
 * Решение root, как его видят владелец и организаторы группы (`GET …/group-page`): причина,
 * заметка и время. Кто из администраторов решил — не показывается.
 */
export interface GroupPageModerationView {
  state: GroupPageModerationState
  reasonCode: GroupPageModerationReason
  reasonTitle: string
  note: string | null
  decidedAt: string
}

/** Справочник городов каталога: все районные центры Беларуси и Минск, по областям. */
export const GROUP_PAGE_CITY_REGIONS: readonly (readonly [string, readonly string[]])[] = [
  ['Минск', ['Минск']],
  [
    'Брестская',
    [
      'Брест',
      'Барановичи',
      'Пинск',
      'Кобрин',
      'Берёза',
      'Ганцевичи',
      'Дрогичин',
      'Жабинка',
      'Иваново',
      'Ивацевичи',
      'Каменец',
      'Лунинец',
      'Ляховичи',
      'Малорита',
      'Пружаны',
      'Столин',
    ],
  ],
  [
    'Витебская',
    [
      'Витебск',
      'Орша',
      'Новополоцк',
      'Полоцк',
      'Бешенковичи',
      'Браслав',
      'Верхнедвинск',
      'Глубокое',
      'Городок',
      'Докшицы',
      'Дубровно',
      'Лепель',
      'Лиозно',
      'Миоры',
      'Поставы',
      'Россоны',
      'Сенно',
      'Толочин',
      'Ушачи',
      'Чашники',
      'Шарковщина',
      'Шумилино',
    ],
  ],
  [
    'Гомельская',
    [
      'Гомель',
      'Мозырь',
      'Жлобин',
      'Светлогорск',
      'Речица',
      'Брагин',
      'Буда-Кошелёво',
      'Ветка',
      'Добруш',
      'Ельск',
      'Житковичи',
      'Калинковичи',
      'Корма',
      'Лельчицы',
      'Лоев',
      'Наровля',
      'Октябрьский',
      'Петриков',
      'Рогачёв',
      'Хойники',
      'Чечерск',
    ],
  ],
  [
    'Гродненская',
    [
      'Гродно',
      'Лида',
      'Слоним',
      'Волковыск',
      'Берестовица',
      'Вороново',
      'Дятлово',
      'Зельва',
      'Ивье',
      'Кореличи',
      'Мосты',
      'Новогрудок',
      'Островец',
      'Ошмяны',
      'Свислочь',
      'Сморгонь',
      'Щучин',
    ],
  ],
  [
    'Минская',
    [
      'Борисов',
      'Солигорск',
      'Молодечно',
      'Жодино',
      'Слуцк',
      'Березино',
      'Вилейка',
      'Воложин',
      'Дзержинск',
      'Клецк',
      'Копыль',
      'Крупки',
      'Логойск',
      'Любань',
      'Марьина Горка',
      'Мядель',
      'Несвиж',
      'Смолевичи',
      'Старые Дороги',
      'Столбцы',
      'Узда',
      'Червень',
    ],
  ],
  [
    'Могилёвская',
    [
      'Могилёв',
      'Бобруйск',
      'Горки',
      'Кричев',
      'Осиповичи',
      'Белыничи',
      'Быхов',
      'Глуск',
      'Дрибин',
      'Кировск',
      'Климовичи',
      'Кличев',
      'Костюковичи',
      'Краснополье',
      'Круглое',
      'Мстиславль',
      'Славгород',
      'Хотимск',
      'Чаусы',
      'Чериков',
      'Шклов',
    ],
  ],
]

/** Ключ сравнения города справочника и `organizations.city`: регистр, пробелы и «ё» не важны. */
export function moderationCityKey(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

/** Город в списке Root Admin: страницы групп и сколько из них требуют внимания. */
export interface PlatformGroupPageCity {
  name: string
  /** Страницы групп города (опубликованные владельцем или с решением root). */
  pages: number
  /** Страницы в поиске. */
  indexed: number
  noindex: number
  hidden: number
  /** Страницы с решением root или новыми жалобами. */
  issues: number
}

/** `GET /api/platform/group-pages/cities`. */
export interface PlatformGroupPageCities {
  regions: { region: string; cities: PlatformGroupPageCity[] }[]
  /** Города групп, которых нет в справочнике (опечатка, другая страна); пустой список — нет. */
  other: PlatformGroupPageCity[]
  totals: {
    cities: number
    citiesWithPages: number
    pages: number
    indexed: number
    noindex: number
    hidden: number
  }
}

export interface PlatformModerationActor {
  id: number
  name: string
}

/** Страница группы в Root Admin (`GET /api/platform/group-pages`). */
export interface PlatformGroupPageRow {
  organizationId: number
  name: string
  slug: string
  city: string | null
  state: GroupPagePublicState
  /** Решение root; `null` — решения нет. */
  moderation: {
    reasonCode: GroupPageModerationReason
    reasonTitle: string
    note: string | null
    decidedBy: PlatformModerationActor | null
    decidedAt: string
  } | null
  /** Жалобы в статусе `new`. */
  newComplaints: number
  updatedAt: string
}

export interface PlatformGroupPagesList {
  items: PlatformGroupPageRow[]
}

/** Запись истории страницы (`GET /api/platform/group-pages/{orgId}/history`). */
export interface PlatformGroupPageHistoryEntry {
  at: string
  kind: 'hidden' | 'noindex' | 'restored' | 'complaint'
  /** Причина решения root или жалобы. */
  reasonCode: string | null
  reasonTitle: string | null
  note: string | null
  /** Автор решения; у жалобы — `null` (посетитель, автор организатору не раскрывается). */
  actor: PlatformModerationActor | null
}

export interface PlatformGroupPageHistory {
  page: PlatformGroupPageRow
  entries: PlatformGroupPageHistoryEntry[]
}

/** Автор жалобы — только для root; организатору не отдаётся никогда. */
export type GroupPageComplaintReporter =
  | { kind: 'user'; id: number; name: string; telegramUsername: string | null }
  | { kind: 'anonymous' }

export interface PlatformGroupPageComplaint {
  id: number
  organizationId: number
  groupName: string
  slug: string
  city: string | null
  pageState: GroupPagePublicState
  reasonCode: GroupPageComplaintReason
  reasonTitle: string
  details: string | null
  reporter: GroupPageComplaintReporter
  status: GroupPageComplaintStatus
  resolution: GroupPageComplaintResolution | null
  resolvedAt: string | null
  createdAt: string
  /** Другие новые жалобы на эту страницу с той же причиной. */
  sameReasonOpen: number
}

/** `GET /api/platform/group-page-complaints`. */
export interface PlatformGroupPageComplaints {
  items: PlatformGroupPageComplaint[]
  stats: {
    open: number
    /** Самая старая новая жалоба; `null` — новых нет. */
    oldestOpenAt: string | null
    /** Решено и отклонено за 30 суток и среднее время до решения в часах. */
    closed30d: number
    avgHoursToClose30d: number | null
    /** Попытки, отсечённые лимитом 3 в сутки, за 30 суток. */
    limited30d: number
  }
}
