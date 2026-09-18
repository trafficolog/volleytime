# 📦 Domain Model

> **Last updated:** 2026-05-25
> Описание сущностей платформы Volley Time.
> **Стек:** Drizzle ORM + PostgreSQL. Все примеры — псевдокод схемы, не финальный TypeScript-код (он появится в Phase 3).

---

## Глоссарий

- **Platform** — Volley Time, провайдер инструмента.
- **Organization** (организация) — клуб, команда, группа организатора. Tenant.
- **User** (пользователь) — глобальная сущность платформы. Один Telegram-аккаунт = один User.
- **OrganizationMember** — связь User ↔ Organization.
- **Event** (событие) — обобщённое название для тренировки, открытой игры, турнирного матча. Phase 5 поддерживает training / open_game.
- **Booking** — заявка пользователя на событие.
- **Subscription** — предоплаченный пакет на N сессий.
- **Payment** — финансовая транзакция (оплата игрока организатору).
- **LedgerEntry** — запись в кассе организации (income / expense).
- **Contribution** — вклад в сбор (Phase 11).
- **Event Credit** — единица платформенной монетизации (Phase 7).

---

## Принципы

1. **Multi-tenancy с первого дня.** Все операционные сущности имеют `organization_id`. Никаких миграций задним числом.

2. **User глобальный.** Один Telegram-аккаунт = один User. Может быть участником нескольких организаций.

3. **Money = Decimal.** В PostgreSQL — `numeric(10, 2)`. В TypeScript — представляем строкой `"15.00"` или используем Decimal.js. Никогда не `number`.

4. **Time = timestamp with time zone.** В PostgreSQL — `timestamptz`. Все timestamps в UTC, конвертация в `Europe/Minsk` только на представлении.

5. **UUIDs vs serial IDs.** Внутренние ID — `serial` (быстро, ёмко). Публичные / shareable ID (invite tokens, public event slugs) — UUID v4 или nanoid.

6. **Soft-delete для аудита.** Большинство сущностей не удаляются физически. Используется `status: archived` или `is_deleted` + `deleted_at`.

7. **Append-only для финансов и журналов.** `LedgerEntry`, `Match Timeline`, `EventCreditTransaction`, `Payment` — никогда не редактируются, только создаются корректирующие записи.

---

## Schema overview

```
┌──────────────────────────────────────────────────────────────┐
│                          Platform Layer                      │
├──────────────────────────────────────────────────────────────┤
│  User (global)                                               │
│  AppSetting (platform-wide)                                  │
│  Feature (catalog)                                           │
│  Plan (catalog)                                              │
│  AddOn (catalog)                                             │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                      Organization Layer                      │
├──────────────────────────────────────────────────────────────┤
│  Organization (tenant root)                                  │
│  OrganizationMember (user × organization)                    │
│  OrganizationFeature (feature entitlements per org)          │
│  OrganizationSubscription (billing)                          │
│  InviteLink                                                  │
│  EventCreditAccount + EventCreditTransaction                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                    Operational Layer (per org)               │
├──────────────────────────────────────────────────────────────┤
│  Event (training / open_game / tournament_match)             │
│  Booking                                                     │
│  Subscription + SubscriptionPlan                             │
│  Payment                                                     │
│  LedgerEntry                                                 │
│  ContributionCampaign + Contribution (Phase 11)              │
│  Venue                                                       │
│  EventStaff (Phase 16)                                       │
│  AuditLog                                                    │
└──────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                  Tournament Layer (Phase 16-17)              │
├──────────────────────────────────────────────────────────────┤
│  Tournament                                                  │
│  TournamentTeam                                              │
│  Match + MatchSet + MatchTimeline                            │
│  MatchScoreAction                                            │
│  Standings (computed, materialized или view)                 │
│  MVPVote                                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                          CRM Layer (Phase 18)                │
├──────────────────────────────────────────────────────────────┤
│  PlayerProfile                                               │
│  PlayerNote                                                  │
│  PlayerTag                                                   │
│  PlayerSegment                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Platform Layer

### User

Глобальная сущность. Один email или Telegram-аккаунт = один User.

```typescript
user {
  id: serial PK
  email: text unique nullable        // null если регистрация через Telegram
  telegram_user_id: bigint unique nullable
  telegram_username: text nullable
  first_name: text
  last_name: text nullable
  phone: text nullable
  rating: integer default 1000       // глобальный рейтинг для balanced team gen
  is_active: boolean default true    // глобальная блокировка (только root)
  is_root_admin: boolean default false  // супер-админ платформы
  created_at: timestamptz default now()
  updated_at: timestamptz default now()
}

index: user_telegram_user_id_idx on (telegram_user_id) where not null
index: user_email_idx on (email) where not null
```

**Notes:**

- `email` И `telegram_user_id` могут оба присутствовать (один аккаунт через два канала).
- Минимум одно из двух должно быть — это валидируется на уровне сервиса.
- `is_root_admin = true` только для основателей платформы. Управляется через переменную окружения / seed, не через UI.

### AppSetting

Platform-wide settings (не per-organization).

```typescript
app_setting {
  key: text PK
  value: text                        // JSON-encoded или string
  value_type: text                   // int/decimal/bool/string/json
  description: text
  updated_at: timestamptz
  updated_by_user_id: integer FK -> user
}
```

Примеры ключей: `event_credit_price_pack_10`, `event_credit_demo_quota`, `bepaid_platform_shop_id` (для своей организации в Phase 12).

### Feature, Plan, AddOn

Catalog модели для billing. Подробности — в [strategy/BILLING_AND_ENTITLEMENTS.md](./strategy/BILLING_AND_ENTITLEMENTS.md).

```typescript
feature {
  code: text PK                      // "online_payments", "crm_pro", "tournaments"
  module: text                       // "payments", "crm", "tournaments"
  name: text
  description: text
  status: text                       // "active", "beta", "deprecated"
}

plan {
  id: serial PK
  code: text unique                  // "start", "regular", "club", "pro"
  name: text
  billing_period: text               // "monthly", "yearly", "usage_based", "credit_pack"
  base_price: numeric(10,2)
  is_active: boolean
}

plan_feature {
  plan_id: integer FK -> plan
  feature_code: text FK -> feature
  limits_json: jsonb                 // { "max_organizations": 1, "max_events_per_month": 50 }
  PK (plan_id, feature_code)
}

add_on {
  code: text PK
  feature_code: text FK -> feature
  price: numeric(10,2)
  billing_period: text
  is_active: boolean
}
```

---

## Organization Layer

### Organization

Tenant. Root aggregate.

```typescript
organization {
  id: serial PK
  slug: text unique                  // "volley-minsk-evening"
  name: text                         // "Volley Minsk Evening"
  description: text nullable
  city: text nullable
  sport_type: text default "volleyball"
  owner_user_id: integer FK -> user
  status: text                       // "active", "suspended", "archived"
  default_member_status: text default "active"  // "active" или "pending"
  default_currency: text default "BYN"
  default_timezone: text default "Europe/Minsk"
  bepaid_credentials_encrypted: text nullable   // Phase 13
  public_page_enabled: boolean default false
  created_at: timestamptz
  updated_at: timestamptz
}
```

### OrganizationMember

Связь User ↔ Organization. Один user может быть в нескольких organizations.

```typescript
organization_member {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  role: text                         // "owner", "organizer", "assistant", "player"
  status: text                       // "pending", "active", "guest", "blocked", "left", "rejected"
  joined_at: timestamptz nullable
  invited_by_user_id: integer FK -> user nullable
  invite_id: integer FK -> invite_link nullable
  rating_in_org: integer nullable    // переопределяет user.rating внутри организации
  created_at: timestamptz
  updated_at: timestamptz

  unique (organization_id, user_id)
}
```

**Статусы:**

- `pending` — заявка ждёт подтверждения (если `default_member_status = "pending"`).
- `active` — полноценный член организации.
- `guest` — участвует в конкретном событии, не постоянный.
- `blocked` — заблокирован организатором этой организации.
- `left` — добровольно вышел.
- `rejected` — заявка отклонена.

**Роли:**

- `owner` — создатель организации, нельзя сместить через UI.
- `organizer` — полные права админа внутри организации.
- `assistant` — расширенные права (Phase 4 уточнит).
- `player` — обычный игрок.

### InviteLink

```typescript
invite_link {
  id: serial PK
  token: text unique                 // короткий случайный токен для URL
  organization_id: integer FK -> organization
  event_id: integer FK -> event nullable
  type: text                         // "organization_join", "event_join", "subscription_invite", "staff_invite"
  created_by_user_id: integer FK -> user
  role_to_assign: text               // "player", "assistant", "organizer"
  default_member_status: text        // "pending", "active", "guest"
  max_uses: integer nullable
  uses_count: integer default 0
  expires_at: timestamptz nullable
  is_revoked: boolean default false
  created_at: timestamptz
}
```

**Deeplink:**

- `https://t.me/<bot_username>?start=org_<token>`
- `https://t.me/<bot_username>?start=event_<token>`

### OrganizationFeature

```typescript
organization_feature {
  organization_id: integer FK -> organization
  feature_code: text FK -> feature
  enabled: boolean
  source: text                       // "plan", "addon", "trial", "admin_grant"
  starts_at: timestamptz
  ends_at: timestamptz nullable
  PK (organization_id, feature_code)
}
```

### OrganizationSubscription (billing)

```typescript
organization_subscription {
  id: serial PK
  organization_id: integer FK -> organization
  plan_id: integer FK -> plan
  status: text                       // "active", "past_due", "cancelled"
  current_period_start: timestamptz
  current_period_end: timestamptz
  created_at: timestamptz
}
```

### EventCreditAccount + EventCreditTransaction (Phase 7)

```typescript
event_credit_account {
  organization_id: integer PK FK -> organization
  balance: integer default 0
  updated_at: timestamptz
}

event_credit_transaction {
  id: serial PK
  organization_id: integer FK -> organization
  type: text                         // "purchase", "spend", "refund", "grant", "correction"
  amount: integer                    // положительное или отрицательное
  related_event_id: integer FK -> event nullable
  comment: text
  created_by_user_id: integer FK -> user
  created_at: timestamptz
}
```

---

## Operational Layer

Все нижеперечисленные сущности имеют `organization_id`.

### Event

```typescript
event {
  id: serial PK
  organization_id: integer FK -> organization
  venue_id: integer FK -> venue nullable
  type: text default "training"      // "training", "open_game", "tournament_match", "custom"
  title: text
  description: text nullable
  starts_at: timestamptz
  ends_at: timestamptz
  city: text nullable
  price_main: numeric(10,2)
  price_rotation: numeric(10,2)
  capacity_main: integer default 12
  capacity_rotation: integer default 2
  waitlist_enabled: boolean default true
  status: text                       // "planned", "open", "closed", "finished", "cancelled"
  notes: text nullable
  reminder_24h_sent_at: timestamptz nullable
  reminder_2h_sent_at: timestamptz nullable
  created_by_user_id: integer FK -> user
  created_at: timestamptz
  updated_at: timestamptz
}

index: event_org_starts_idx on (organization_id, starts_at)
```

### Booking

```typescript
booking {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  event_id: integer FK -> event
  slot_type: text                    // "main", "rotation", "waitlist"
  status: text                       // "pending_payment", "confirmed", "cancelled", "attended", "no_show"
  payment_id: integer FK -> payment nullable
  subscription_id: integer FK -> subscription nullable
  cancellation_reason: text nullable
  cancelled_at: timestamptz nullable
  created_at: timestamptz
  updated_at: timestamptz

  unique (user_id, event_id)
}

index: booking_event_idx on (event_id)
index: booking_user_idx on (user_id)
```

### Subscription + SubscriptionPlan

```typescript
subscription_plan {
  id: serial PK
  organization_id: integer FK -> organization   // планы scoped by org!
  code: text                                    // "4x", "8x", "12x"
  title: text                                   // "Месячный"
  total_sessions: integer
  price: numeric(10,2)
  valid_days: integer
  is_active: boolean default true
  sort_order: integer default 0
  created_at: timestamptz
  updated_at: timestamptz

  unique (organization_id, code)
}

subscription {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  plan_id: integer FK -> subscription_plan
  total_sessions: integer
  used_sessions: integer default 0
  price: numeric(10,2)               // зафиксирована на момент покупки
  purchased_at: timestamptz
  expires_at: timestamptz
  status: text                       // "active", "depleted", "expired", "refunded", "cancelled"
  created_at: timestamptz
}
```

### Payment

```typescript
payment {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  booking_id: integer FK -> booking nullable
  subscription_id: integer FK -> subscription nullable
  contribution_id: integer FK -> contribution nullable
  method: text                       // "cash", "transfer", "online", "subscription", "other"
  status: text                       // "pending", "succeeded", "failed", "refunded", "cancelled"
  amount: numeric(10,2)
  currency: text default "BYN"
  bepaid_uid: text unique nullable   // Phase 12
  bepaid_token: text nullable
  bepaid_status: text nullable
  confirmed_by_user_id: integer FK -> user nullable
  confirmed_at: timestamptz nullable
  description: text nullable
  created_at: timestamptz
}

index: payment_status_idx on (status) where status = 'pending'
```

### LedgerEntry

Append-only journal. Корректировки — через создание новой записи со ссылкой на исходную (паттерн из Python-прототипа Phase 2.5).

```typescript
ledger_entry {
  id: serial PK
  organization_id: integer FK -> organization
  type: text                         // "income", "expense"
  category: text                     // "training_fee", "subscription", "rent", "balls", "refund", "other"
  amount: numeric(10,2)
  occurred_on: date
  description: text
  related_payment_id: integer FK -> payment nullable
  related_event_id: integer FK -> event nullable
  evidence_file_id: text nullable    // Telegram file_id для фото чека
  corrects_entry_id: integer FK -> ledger_entry nullable    // для сторно
  created_by_user_id: integer FK -> user
  created_at: timestamptz
}
```

### Venue

```typescript
venue {
  id: serial PK
  organization_id: integer FK -> organization
  name: text                         // "Спортшкола №1"
  address: text nullable
  city: text nullable
  notes: text nullable
  is_active: boolean default true
  created_at: timestamptz
}
```

### AuditLog

```typescript
audit_log {
  id: serial PK
  organization_id: integer FK -> organization nullable  // null для platform-level actions
  user_id: integer FK -> user
  action: text                       // "event.created", "booking.cancelled", "payment.confirmed"
  entity_type: text                  // "event", "booking", "payment"
  entity_id: integer
  old_value: jsonb nullable
  new_value: jsonb nullable
  ip_address: text nullable
  user_agent: text nullable
  created_at: timestamptz
}

index: audit_org_created_idx on (organization_id, created_at desc)
```

---

## Contributions (Phase 11)

```typescript
contribution_campaign {
  id: serial PK
  organization_id: integer FK -> organization
  title: text
  description: text nullable
  target_amount: numeric(10,2)
  currency: text default "BYN"
  status: text                       // "draft", "active", "completed", "cancelled"
  visibility: text                   // "members_only", "public_link"
  public_token: text unique nullable // для public shareable link
  created_by_user_id: integer FK -> user
  created_at: timestamptz
  completed_at: timestamptz nullable
}

contribution {
  id: serial PK
  campaign_id: integer FK -> contribution_campaign
  organization_id: integer FK -> organization
  user_id: integer FK -> user nullable   // null если offline
  offline_name: text nullable
  amount: numeric(10,2)
  method: text                       // "cash", "transfer", "online", "other"
  status: text                       // "pledged", "received_cash", "received_transfer", "received_online", "cancelled", "refunded"
  confirmed_by_user_id: integer FK -> user nullable
  comment: text nullable
  created_at: timestamptz
  confirmed_at: timestamptz nullable
}
```

---

## Tournament Layer (Phase 16-17, порт Volley Time)

### Match

```typescript
match {
  id: serial PK
  organization_id: integer FK -> organization
  event_id: integer FK -> event
  team_a_id: integer FK -> tournament_team
  team_b_id: integer FK -> tournament_team
  judge_id: integer FK -> user nullable
  status: text                       // "scheduled", "live", "completed", "cancelled"
  score_a: integer default 0         // счёт по сетам
  score_b: integer default 0
  winner_team_id: integer FK -> tournament_team nullable
  round_number: integer nullable
  scheduled_at: timestamptz nullable
  started_at: timestamptz nullable
  finished_at: timestamptz nullable
  version: integer default 1         // optimistic locking
  created_at: timestamptz
}

match_set {
  id: serial PK
  match_id: integer FK -> match
  set_number: integer
  score_a: integer default 0
  score_b: integer default 0
  is_finished: boolean default false
  is_tiebreak: boolean default false

  unique (match_id, set_number)
}

match_score_action {
  id: serial PK
  match_id: integer FK -> match
  set_number: integer
  team: text                         // "a" or "b"
  delta: integer default 1
  is_reverted: boolean default false  // для undo
  reverted_by_action_id: integer FK -> match_score_action nullable
  created_by_user_id: integer FK -> user
  created_at: timestamptz
}

index: action_match_idx on (match_id, created_at)
```

### TournamentTeam

```typescript
tournament_team {
  id: serial PK
  organization_id: integer FK -> organization
  event_id: integer FK -> event
  name: text
  color: text default "#3B82F6"
  captain_user_id: integer FK -> user nullable
  created_at: timestamptz
}

tournament_team_member {
  team_id: integer FK -> tournament_team
  user_id: integer FK -> user
  PK (team_id, user_id)
}
```

### MVPVote

```typescript
mvp_vote {
  id: serial PK
  match_id: integer FK -> match
  voter_user_id: integer FK -> user
  voted_for_user_id: integer FK -> user
  created_at: timestamptz

  unique (match_id, voter_user_id)
}
```

---

## CRM Layer (Phase 18)

```typescript
player_profile {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  skill_level: text nullable         // "beginner", "intermediate", "advanced", "pro"
  playing_role: text nullable        // "setter", "outside", "middle", "opposite", "libero"
  notes_summary: text nullable
  no_show_count: integer default 0
  last_attended_at: timestamptz nullable
  created_at: timestamptz

  unique (organization_id, user_id)
}

player_note {
  id: serial PK
  organization_id: integer FK -> organization
  user_id: integer FK -> user
  author_user_id: integer FK -> user
  text: text
  created_at: timestamptz
}

player_tag {
  id: serial PK
  organization_id: integer FK -> organization
  name: text
  color: text
}

player_tag_assignment {
  user_id: integer FK -> user
  tag_id: integer FK -> player_tag
  organization_id: integer FK -> organization
  PK (user_id, tag_id, organization_id)
}
```

---

## Бизнес-правила (выжимка)

### Бронирование

1. Игрок не может записаться на одно событие дважды (unique `(user_id, event_id)`).
2. Запись закрывается за `booking_closes_hours_before` (default 2) часов.
3. Распределение слотов: `capacity_main` (12) → `capacity_rotation` (2) → waitlist.
4. При отмене кого-то — первый из waitlist получает уведомление с TTL подтверждения (Phase 15).

### Абонементы

1. Срок действия индивидуальный для плана.
2. Списание сессии — в момент **подтверждения** записи (атомарно, через transaction + WHERE).
3. При отмене брони в срок «бесплатной отмены» (например, ≥ 24 ч) — возврат сессии.
4. FIFO по `expires_at` — списываем с ближайшего к истечению.

### Платежи

1. Все суммы в `numeric(10,2)`.
2. Идемпотентность webhook через `bepaid_uid` unique.
3. Confirm — single source of truth для активации Booking / Subscription / LedgerEntry.

### Event Credits

1. Создание Event → -1 credit. Если баланс 0 → отказ.
2. Отмена Event до открытия записи → +1 credit refund.
3. Демо-квота даётся новой организации при создании.

### Multi-tenancy enforcement

1. Каждый запрос в БД должен фильтроваться по `organization_id` (или быть платформенным).
2. На уровне сервиса — middleware проверяет, что текущий User является `OrganizationMember` запрашиваемой организации.
3. Cross-organization операции (типа «выбрать User из другой организации») — только для root-admin.

---

## Что приходит из Phase 1+2 Python-прототипа

- Логика slot distribution
- Атомарное consume_session
- FIFO subscription
- LedgerService с категориями
- Цикл PaymentService.confirm

Всё это переписывается на Drizzle с теми же принципами.

## Что приходит из Volley Time в Phase 16-17

- Match / MatchSet / MatchScoreAction (append-only) / MVPVote / TournamentTeam
- Standings с настраиваемой `tiebreak_order` и `scoring_system`
- Match Timeline с `is_reverted`
- Optimistic locking через `version`

---

## Открытые вопросы (решаются в момент реализации)

1. **Standings — view, materialized view или вычисляется в коде?** Решается в Phase 16.
2. **`Match` нужен только для tournament_match, или для любого event?** Скорее всего, отдельная сущность для тренировок не нужна — у них нет matches. В Phase 16 уточнить.
3. **JobQueue для scheduler — BullMQ (Redis), или PG-based?** Решается в Phase 15.
4. **Encryption strategy для `bepaid_credentials_encrypted`?** Phase 13. Probably AES-256-GCM with key in env.
5. **Public event slug — обязательный или опциональный?** Phase 5 уточнит.

---

## Ссылки

- [PLATFORM_VISION.md](./PLATFORM_VISION.md)
- [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md)
- [ROADMAP.md](./ROADMAP.md)
- [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md)
- [architecture/MODULITH_ARCHITECTURE.md](./architecture/MODULITH_ARCHITECTURE.md)
- [strategy/BILLING_AND_ENTITLEMENTS.md](./strategy/BILLING_AND_ENTITLEMENTS.md)
- [strategy/INVITES_AND_MEMBERSHIP.md](./strategy/INVITES_AND_MEMBERSHIP.md)
