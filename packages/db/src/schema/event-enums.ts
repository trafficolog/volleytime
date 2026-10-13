import { pgEnum } from 'drizzle-orm/pg-core'

// Вынесены из events.ts: organizations (настройки группы по умолчанию) ссылается на них,
// а events ссылается на organizations — без цикла импортов.
export const eventPriceModeEnum = pgEnum('event_price_mode', ['fixed', 'split'])
export const eventJoinModeEnum = pgEnum('event_join_mode', ['open', 'invite'])
