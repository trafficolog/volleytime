/**
 * Демо-данные по макетам референса v3 (Task 19.2.1, ADR docs/architecture/ADR-v3-domain.md).
 *
 * Создаёт на ТЕКУЩЕЙ схеме группы «VolleyTime Минск», «МинскВолей · Воскресные» и «СпайкКлуб»:
 * залы, участников, события fixed/split во всех статусах, записи, абонементы, платежи и кассу.
 * Идемпотентно: каждая строка ищется по естественному ключу, повторный запуск ничего не дублирует.
 * Даты считаются от `organizations.created_at` (хранится в БД), поэтому стабильны между запусками.
 * Следствие: даты «стареют» — через неделю «ближайшие» события окажутся в прошлом со статусом
 * published. Для свежих данных (например, перед прогоном харнесса 19.0.2) базу пересоздают:
 * `pnpm dev:db:reset`, миграции, затем `pnpm db:seed:demo`.
 * Запуск: `pnpm db:seed:demo`. В production (NODE_ENV=production) отказывается работать;
 * параллельные запуски сериализуются advisory-lock-ом; чужая организация с demo-slug — ошибка.
 */
import { pathToFileURL } from 'node:url'

import { and, eq, sql } from 'drizzle-orm'

import type { DB, Transaction } from './client'
import {
  bookings,
  events,
  ledgerEntries,
  organizationMembers,
  organizations,
  payments,
  subscriptionPlans,
  subscriptions,
  users,
  venues,
  type Booking,
  type Event,
  type Organization,
  type User,
} from './schema'

export const DEMO_EMAIL_DOMAIN = 'demo.volleytime.local'

type Role = 'owner' | 'organizer' | 'assistant' | 'player'
type PayMethod = 'cash' | 'transfer'

/** Как участник оказался в составе события. */
type Seat =
  | { user: string; kind: 'paid'; method?: PayMethod } // fixed: подтверждён, платёж прошёл
  | { user: string; kind: 'pending'; method?: PayMethod } // fixed/split: ждёт оплаты
  | { user: string; kind: 'subscription' } // fixed: списано занятие абонемента
  | { user: string; kind: 'waitlisted' } // лист ожидания

interface DemoEvent {
  title: string
  venue: string
  /** День относительно даты создания группы. */
  day: number
  /** Время начала и окончания по Минску (UTC+3). */
  from: string
  to: string
  capacity: number
  status: Event['status']
  price?: number
  /** Сумма к сбору (split), minor units. */
  split?: { target: number; settled: boolean }
  seats: Seat[]
}

interface DemoOrganization {
  slug: string
  name: string
  description: string
  owner: string
  members: Partial<Record<string, Role>>
  venues: { name: string; address: string; capacityHint: number }[]
  plans: { name: string; totalSessions: number; validityDays: number; price: number }[]
  subscriptions: { user: string; plan: string; status: 'active' | 'pending' }[]
  expenses: { category: 'rent' | 'equipment'; amount: number; day: number; description: string }[]
  events: DemoEvent[]
}

/** Латинский ключ → имя из макета (handoff atoms.jsx `PEOPLE`). */
export const DEMO_USERS: Record<string, string> = {
  artem: 'Артём',
  nikita: 'Никита',
  masha: 'Маша',
  lera: 'Лера',
  igor: 'Игорь',
  sonya: 'Соня',
  denis: 'Денис',
  yulya: 'Юля',
  stas: 'Стас',
  katya: 'Катя',
  pasha: 'Паша',
  dasha: 'Даша',
  lesha: 'Лёша',
  olya: 'Оля',
  vika: 'Вика',
  roma: 'Рома',
  tanya: 'Таня',
  gosha: 'Гоша',
  sergey: 'Сергей',
  misha: 'Миша',
  ira: 'Ира',
  kostya: 'Костя',
  zhenya: 'Женя',
  oleg: 'Олег',
  vadim: 'Вадим',
  liza: 'Лиза',
}

const paid = (user: string, method: PayMethod = 'cash'): Seat => ({ user, kind: 'paid', method })
const pending = (user: string, method: PayMethod = 'transfer'): Seat => ({
  user,
  kind: 'pending',
  method,
})
const sub = (user: string): Seat => ({ user, kind: 'subscription' })
const wait = (user: string): Seat => ({ user, kind: 'waitlisted' })

const VT_PLAYERS = [
  'nikita',
  'masha',
  'lera',
  'igor',
  'sonya',
  'denis',
  'yulya',
  'stas',
  'katya',
  'pasha',
  'dasha',
  'lesha',
  'olya',
  'vika',
  'roma',
  'tanya',
  'gosha',
]

export const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    slug: 'demo-vt-minsk',
    name: 'VolleyTime Минск',
    description: 'Любительский волейбол в Минске: тренировки по средам и воскресеньям.',
    owner: 'artem',
    members: {
      ...Object.fromEntries(VT_PLAYERS.map((u) => [u, 'player' as const])),
      nikita: 'organizer',
      masha: 'assistant',
    },
    venues: [
      { name: 'Школа №24', address: 'Минск, малый и большой зал', capacityHint: 16 },
      { name: 'СК «Заслонова»', address: 'Минск, игровой зал', capacityHint: 16 },
    ],
    plans: [
      { name: '8 занятий', totalSessions: 8, validityDays: 30, price: 11000 },
      { name: '4 занятия', totalSessions: 4, validityDays: 30, price: 6000 },
    ],
    subscriptions: [
      { user: 'masha', plan: '8 занятий', status: 'active' },
      { user: 'sonya', plan: '8 занятий', status: 'active' },
      { user: 'katya', plan: '4 занятия', status: 'active' },
      { user: 'lesha', plan: '8 занятий', status: 'active' },
      { user: 'vika', plan: '4 занятия', status: 'pending' },
    ],
    expenses: [
      { category: 'rent', amount: 12000, day: -3, description: 'Аренда зала · Школа №24' },
      { category: 'equipment', amount: 8000, day: -10, description: 'Мячи / инвентарь' },
    ],
    events: [
      {
        title: 'Основа',
        venue: 'Школа №24',
        day: -3,
        from: '20:00',
        to: '22:00',
        capacity: 14,
        price: 1500,
        status: 'finished',
        seats: VT_PLAYERS.slice(0, 13).map((u) => paid(u)),
      },
      {
        title: 'Товарищеская',
        venue: 'СК «Заслонова»',
        day: -1,
        from: '10:00',
        to: '13:00',
        capacity: 12,
        status: 'finished',
        split: { target: 18000, settled: true },
        seats: ['artem', ...VT_PLAYERS.slice(0, 11)].map((u) => paid(u, 'transfer')),
      },
      {
        title: 'Основа',
        venue: 'Школа №24',
        day: 1,
        from: '20:00',
        to: '22:00',
        capacity: 14,
        price: 1500,
        status: 'published',
        seats: [
          sub('masha'),
          sub('sonya'),
          sub('katya'),
          sub('lesha'),
          paid('artem'),
          paid('lera'),
          paid('igor', 'transfer'),
          paid('denis'),
          paid('stas'),
          paid('dasha', 'transfer'),
          pending('nikita', 'cash'),
          pending('olya'),
        ],
      },
      {
        title: 'Утренняя',
        venue: 'Школа №24',
        day: 1,
        from: '08:00',
        to: '10:00',
        capacity: 12,
        price: 1500,
        status: 'published',
        seats: ['yulya', 'pasha', 'roma', 'tanya', 'gosha', 'vika'].map((u) => paid(u, 'transfer')),
      },
      {
        title: 'Открытая игра',
        venue: 'СК «Заслонова»',
        day: 3,
        from: '19:30',
        to: '22:00',
        capacity: 14,
        price: 1500,
        status: 'published',
        seats: ['artem', 'nikita', 'lera', 'igor', 'denis', 'stas', 'pasha', 'dasha', 'olya'].map(
          (u) => paid(u),
        ),
      },
      {
        title: 'Микст',
        venue: 'Школа №24',
        day: 5,
        from: '10:00',
        to: '13:00',
        capacity: 14,
        price: 1500,
        status: 'published',
        seats: [
          sub('masha'),
          sub('sonya'),
          ...[
            'artem',
            'nikita',
            'lera',
            'igor',
            'denis',
            'yulya',
            'stas',
            'katya',
            'pasha',
            'dasha',
          ].map((u) => paid(u)),
          pending('lesha'),
          pending('olya'),
          wait('roma'),
          wait('tanya'),
        ],
      },
      {
        title: 'Основа',
        venue: 'Школа №24',
        day: 8,
        from: '20:00',
        to: '22:00',
        capacity: 14,
        price: 1500,
        status: 'published',
        seats: [sub('masha'), paid('lera'), pending('gosha')],
      },
      {
        title: 'Аренда большого зала',
        venue: 'СК «Заслонова»',
        day: 11,
        from: '12:00',
        to: '15:00',
        capacity: 16,
        status: 'published',
        split: { target: 24000, settled: false },
        seats: ['artem', 'masha', 'igor', 'lera', 'stas', 'katya', 'dasha', 'roma'].map((u) =>
          pending(u),
        ),
      },
      {
        title: 'Воскресная игра',
        venue: 'Школа №24',
        day: 12,
        from: '11:00',
        to: '14:00',
        capacity: 16,
        status: 'closed',
        split: { target: 18000, settled: true },
        seats: [
          ...['artem', 'nikita', 'masha', 'lera', 'igor', 'sonya', 'denis', 'yulya'].map((u) =>
            paid(u, 'transfer'),
          ),
          ...['stas', 'katya', 'pasha', 'dasha'].map((u) => pending(u, 'cash')),
        ],
      },
      {
        title: 'Основа',
        venue: 'Школа №24',
        day: 15,
        from: '20:00',
        to: '22:00',
        capacity: 14,
        price: 1500,
        status: 'cancelled',
        seats: [],
      },
    ],
  },
  {
    slug: 'demo-minskvoley',
    name: 'МинскВолей · Воскресные',
    description: 'Воскресные игры для своих.',
    owner: 'sergey',
    members: {
      nikita: 'player',
      lera: 'player',
      denis: 'player',
      yulya: 'player',
      misha: 'player',
      ira: 'player',
      kostya: 'player',
      zhenya: 'player',
      artem: 'player',
    },
    venues: [{ name: 'Зал МинскВолей', address: 'Минск', capacityHint: 12 }],
    plans: [],
    subscriptions: [],
    expenses: [{ category: 'rent', amount: 9000, day: -7, description: 'Аренда зала' }],
    events: [
      {
        title: 'Воскресная игра',
        venue: 'Зал МинскВолей',
        day: -7,
        from: '11:00',
        to: '14:00',
        capacity: 12,
        price: 1200,
        status: 'finished',
        seats: [
          'nikita',
          'lera',
          'denis',
          'yulya',
          'misha',
          'ira',
          'kostya',
          'zhenya',
          'artem',
        ].map((u) => paid(u)),
      },
      {
        title: 'Воскресная игра',
        venue: 'Зал МинскВолей',
        day: 6,
        from: '11:00',
        to: '14:00',
        capacity: 12,
        price: 1200,
        status: 'published',
        seats: [paid('misha'), paid('ira'), paid('kostya'), pending('zhenya'), pending('artem')],
      },
    ],
  },
  {
    slug: 'demo-spikeclub',
    name: 'СпайкКлуб',
    description: 'Клуб для сильных любителей: тренировки и выездные турниры.',
    owner: 'oleg',
    members: {
      artem: 'player',
      masha: 'player',
      stas: 'player',
      katya: 'player',
      pasha: 'player',
      dasha: 'player',
      vadim: 'organizer',
      liza: 'player',
    },
    venues: [{ name: 'СпайкАрена', address: 'Минск', capacityHint: 16 }],
    plans: [{ name: '8 занятий', totalSessions: 8, validityDays: 45, price: 14000 }],
    subscriptions: [{ user: 'liza', plan: '8 занятий', status: 'active' }],
    expenses: [{ category: 'rent', amount: 15000, day: -2, description: 'Аренда СпайкАрены' }],
    events: [
      {
        title: 'Тренировка',
        venue: 'СпайкАрена',
        day: 2,
        from: '19:00',
        to: '21:00',
        capacity: 16,
        price: 2000,
        status: 'published',
        seats: [
          sub('liza'),
          paid('artem'),
          paid('masha', 'transfer'),
          paid('stas'),
          pending('katya'),
          pending('vadim'),
        ],
      },
      {
        title: 'Турнир выходного дня',
        venue: 'СпайкАрена',
        day: 9,
        from: '10:00',
        to: '16:00',
        capacity: 18,
        status: 'published',
        split: { target: 30000, settled: false },
        seats: ['pasha', 'dasha', 'liza'].map((u) => pending(u)),
      },
    ],
  },
]

const SEED_LOCK_CLASS = 19_021
const SEED_LOCK_ID = 1
const HOUR = 3_600_000
const MINSK_OFFSET_HOURS = 3

/** Бросает ошибку в production — до любого обращения к БД. */
export function assertDemoSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('db:seed:demo is forbidden in production (NODE_ENV=production)')
  }
}

function dayStartUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function minskTime(anchor: number, day: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return new Date(anchor + day * 24 * HOUR + (h - MINSK_OFFSET_HOURS) * HOUR + m * 60_000)
}

/**
 * Точное распределение суммы по копейкам, как R0.7 (`allocateSplitAmount`, D-01).
 * Копия, а не импорт: `@volley-time/db` не зависит от `@volley-time/shared`, и образ миграций
 * (docker/migrator.Dockerfile) собирает только packages/db. Совпадение с оригиналом
 * проверяет seed-demo.integration.test.ts.
 */
export function allocate(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

async function ensureUser(tx: Transaction, key: string): Promise<User> {
  const email = `demo-${key}@${DEMO_EMAIL_DOMAIN}`
  await tx
    .insert(users)
    .values({ email, emailVerified: true, name: DEMO_USERS[key] ?? key })
    .onConflictDoNothing()
  const [user] = await tx.select().from(users).where(eq(users.email, email))
  return user!
}

async function ensureOrganization(
  tx: Transaction,
  spec: DemoOrganization,
  ownerId: number,
): Promise<Organization> {
  await tx
    .insert(organizations)
    .values({
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      city: 'Минск',
      ownerUserId: ownerId,
      publicPageEnabled: true,
      subscriptionsEnabled: spec.plans.length > 0,
    })
    .onConflictDoNothing()
  const [org] = await tx.select().from(organizations).where(eq(organizations.slug, spec.slug))
  if (org!.ownerUserId !== ownerId) {
    throw new Error(
      `Organization slug "${spec.slug}" belongs to a non-demo owner; refusing to seed into it`,
    )
  }
  return org!
}

interface Ctx {
  tx: Transaction
  org: Organization
  owner: User
  people: Map<string, User>
  anchor: number
}

async function addPayment(
  ctx: Ctx,
  values: {
    userId: number
    amount: number
    method: PayMethod
    succeeded: boolean
    at: Date
    bookingId?: number
    subscriptionId?: number
  },
): Promise<number> {
  const [payment] = await ctx.tx
    .insert(payments)
    .values({
      organizationId: ctx.org.id,
      userId: values.userId,
      bookingId: values.bookingId ?? null,
      subscriptionId: values.subscriptionId ?? null,
      amount: values.amount,
      method: values.method,
      status: values.succeeded ? 'succeeded' : 'pending',
      confirmedByUserId: values.succeeded ? ctx.owner.id : null,
      confirmedAt: values.succeeded ? values.at : null,
      createdAt: values.at,
    })
    .returning()
  if (values.succeeded) {
    await ctx.tx.insert(ledgerEntries).values({
      organizationId: ctx.org.id,
      type: 'income',
      category: 'payment_income',
      amount: values.amount,
      paymentId: payment!.id,
      description: values.bookingId ? 'Оплата участия' : 'Оплата абонемента',
      createdByUserId: ctx.owner.id,
      occurredAt: values.at,
      createdAt: values.at,
    })
  }
  return payment!.id
}

async function ensureSubscriptions(ctx: Ctx, spec: DemoOrganization): Promise<Map<string, number>> {
  const planIds = new Map<string, number>()
  for (const plan of spec.plans) {
    let [row] = await ctx.tx
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.organizationId, ctx.org.id),
          eq(subscriptionPlans.name, plan.name),
        ),
      )
    if (!row) {
      ;[row] = await ctx.tx
        .insert(subscriptionPlans)
        .values({ organizationId: ctx.org.id, ...plan })
        .returning()
    }
    planIds.set(plan.name, row!.id)
  }

  const byUser = new Map<string, number>()
  for (const s of spec.subscriptions) {
    const user = ctx.people.get(s.user)!
    const plan = spec.plans.find((p) => p.name === s.plan)!
    const planId = planIds.get(s.plan)!
    const [existing] = await ctx.tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, ctx.org.id),
          eq(subscriptions.userId, user.id),
          eq(subscriptions.planId, planId),
        ),
      )
    if (existing) {
      byUser.set(s.user, existing.id)
      continue
    }
    const purchasedAt = new Date(ctx.anchor - 5 * 24 * HOUR)
    const active = s.status === 'active'
    const [created] = await ctx.tx
      .insert(subscriptions)
      .values({
        organizationId: ctx.org.id,
        userId: user.id,
        planId,
        totalSessions: plan.totalSessions,
        status: s.status,
        purchasedAt,
        activatedAt: active ? purchasedAt : null,
        expiresAt: active ? new Date(purchasedAt.getTime() + plan.validityDays * 24 * HOUR) : null,
      })
      .returning()
    await addPayment(ctx, {
      userId: user.id,
      amount: plan.price,
      method: 'transfer',
      succeeded: active,
      at: purchasedAt,
      subscriptionId: created!.id,
    })
    byUser.set(s.user, created!.id)
  }
  return byUser
}

async function ensureEvent(
  ctx: Ctx,
  spec: DemoEvent,
  venueIds: Map<string, number>,
  subscriptionIds: Map<string, number>,
): Promise<void> {
  const startsAt = minskTime(ctx.anchor, spec.day, spec.from)
  const endsAt = minskTime(ctx.anchor, spec.day, spec.to)
  const [found] = await ctx.tx
    .select()
    .from(events)
    .where(
      and(
        eq(events.organizationId, ctx.org.id),
        eq(events.title, spec.title),
        eq(events.startsAt, startsAt),
      ),
    )
  if (found) return // событие создаётся вместе с составом в одной транзакции

  const settled = spec.split?.settled ?? false
  const active = spec.seats.filter((s) => s.kind !== 'waitlisted')
  const shares = spec.split && settled ? allocate(spec.split.target, active.length) : []
  const [event] = await ctx.tx
    .insert(events)
    .values({
      organizationId: ctx.org.id,
      venueId: venueIds.get(spec.venue) ?? null,
      createdByUserId: ctx.owner.id,
      title: spec.title,
      startsAt,
      endsAt,
      capacity: spec.capacity,
      price: spec.split ? 0 : (spec.price ?? 0),
      priceMode: spec.split ? 'split' : 'fixed',
      targetAmount: spec.split?.target ?? null,
      pricingSettledAt: settled ? new Date(startsAt.getTime() - 2 * HOUR) : null,
      pricingParticipantCount: settled ? active.length : null,
      cancellationDeadlineHours: 6,
      status: spec.status,
    })
    .returning()

  const past = spec.status === 'finished'
  let activeIndex = 0
  for (const [index, seat] of spec.seats.entries()) {
    const user = ctx.people.get(seat.user)!
    const bookedAt = new Date(startsAt.getTime() - 72 * HOUR + index * 60_000)
    const share = seat.kind !== 'waitlisted' && settled ? shares[activeIndex] : undefined
    if (seat.kind !== 'waitlisted') activeIndex += 1
    const amount = share ?? spec.price ?? 0

    let status: Booking['status']
    let method: Booking['method']
    let subscriptionId: number | null = null
    if (seat.kind === 'waitlisted') {
      status = 'waitlisted'
      method = 'cash'
    } else if (seat.kind === 'subscription') {
      status = past ? 'attended' : 'confirmed'
      method = 'subscription'
      subscriptionId = subscriptionIds.get(seat.user)!
    } else if (seat.kind === 'paid') {
      status = past ? 'attended' : 'confirmed'
      method = seat.method ?? 'cash'
    } else {
      status = 'pending_payment'
      method = seat.method ?? 'transfer'
    }

    const [booking] = await ctx.tx
      .insert(bookings)
      .values({
        eventId: event!.id,
        userId: user.id,
        organizationId: ctx.org.id,
        status,
        method,
        subscriptionId,
        allocatedAmount: share ?? null,
        bookedAt,
        confirmedAt: status === 'confirmed' || status === 'attended' ? bookedAt : null,
      })
      .returning()

    if (subscriptionId !== null) {
      const [current] = await ctx.tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
      await ctx.tx
        .update(subscriptions)
        .set({ usedSessions: current!.usedSessions + 1 })
        .where(eq(subscriptions.id, subscriptionId))
    }

    // платёж: fixed — всегда для cash/transfer; split — только после фиксации долей (R0.7)
    const needsPayment =
      (seat.kind === 'paid' || seat.kind === 'pending') && (!spec.split || settled) && amount > 0
    if (needsPayment) {
      const paymentId = await addPayment(ctx, {
        userId: user.id,
        amount,
        method: method as PayMethod,
        succeeded: seat.kind === 'paid',
        at: new Date(bookedAt.getTime() + HOUR),
        bookingId: booking!.id,
      })
      await ctx.tx.update(bookings).set({ paymentId }).where(eq(bookings.id, booking!.id))
    }
  }
}

async function seedOrganization(tx: Transaction, spec: DemoOrganization): Promise<void> {
  const owner = await ensureUser(tx, spec.owner)
  const org = await ensureOrganization(tx, spec, owner.id)
  const people = new Map<string, User>([[spec.owner, owner]])
  const members: [string, Role][] = [
    [spec.owner, 'owner'],
    ...(Object.entries(spec.members) as [string, Role][]),
  ]
  for (const [key, role] of members) {
    const user = people.get(key) ?? (await ensureUser(tx, key))
    people.set(key, user)
    await tx
      .insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: user.id,
        role,
        status: 'active',
        joinedAt: org.createdAt,
      })
      .onConflictDoNothing()
  }

  const venueIds = new Map<string, number>()
  for (const venue of spec.venues) {
    let [row] = await tx
      .select()
      .from(venues)
      .where(and(eq(venues.organizationId, org.id), eq(venues.name, venue.name)))
    if (!row)
      [row] = await tx
        .insert(venues)
        .values({ organizationId: org.id, ...venue })
        .returning()
    venueIds.set(venue.name, row!.id)
  }

  const ctx: Ctx = { tx, org, owner, people, anchor: dayStartUtc(org.createdAt) }
  const subscriptionIds = await ensureSubscriptions(ctx, spec)

  for (const expense of spec.expenses) {
    const occurredAt = minskTime(ctx.anchor, expense.day, '12:00')
    const [row] = await tx
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.organizationId, org.id),
          eq(ledgerEntries.category, expense.category),
          eq(ledgerEntries.occurredAt, occurredAt),
        ),
      )
    if (!row) {
      await tx.insert(ledgerEntries).values({
        organizationId: org.id,
        type: 'expense',
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        createdByUserId: owner.id,
        occurredAt,
      })
    }
  }

  for (const event of spec.events) await ensureEvent(ctx, event, venueIds, subscriptionIds)
}

export interface DemoSeedSummary {
  organizations: string[]
}

/** Идемпотентно создаёт демо-данные в одной транзакции. */
export async function seedDemo(database: DB): Promise<DemoSeedSummary> {
  assertDemoSeedAllowed()
  await database.transaction(async (tx) => {
    // параллельные запуски ждут друг друга; ключ из двух int — отдельное от event_id пространство
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_CLASS}, ${SEED_LOCK_ID})`)
    for (const spec of DEMO_ORGANIZATIONS) await seedOrganization(tx, spec)
  })
  return { organizations: DEMO_ORGANIZATIONS.map((o) => o.name) }
}

async function main(): Promise<void> {
  assertDemoSeedAllowed()
  const { db, closeDb } = await import('./client')
  try {
    const summary = await seedDemo(db)
    console.log(`Demo data ready: ${summary.organizations.join(', ')}`)
  } finally {
    await closeDb()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
