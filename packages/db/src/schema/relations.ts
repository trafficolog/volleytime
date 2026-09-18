import { relations } from 'drizzle-orm'

import { bookings } from './bookings'
import { events } from './events'
import { organizationMembers } from './organization-members'
import { organizations } from './organizations'
import { users } from './users'
import { venues } from './venues'

export const bookingsRelations = relations(bookings, ({ one }) => ({
  event: one(events, { fields: [bookings.eventId], references: [events.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
}))

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  bookings: many(bookings),
}))

export const venuesRelations = relations(venues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [venues.organizationId],
    references: [organizations.id],
  }),
  events: many(events),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}))
