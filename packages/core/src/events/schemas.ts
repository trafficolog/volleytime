import { z } from 'zod'

export const CreateEventInput = z
  .object({
    type: z.enum(['training', 'open_game', 'custom']).default('training'),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    venueId: z.number().int().positive().optional(),
    locationText: z.string().max(300).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.number().int().positive().max(500),
    price: z.number().int().min(0).default(0),
    // валюта события = валюта организации (6.8.8); передавать не обязательно
    currency: z.string().length(3).optional(),
    cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
export type CreateEventInput = z.input<typeof CreateEventInput>

export const UpdateEventInput = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  venueId: z.number().int().positive().nullable().optional(),
  locationText: z.string().max(300).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  capacity: z.number().int().positive().max(500).optional(),
  price: z.number().int().min(0).optional(),
  cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
  status: z.enum(['draft', 'published', 'closed', 'finished']).optional(),
})
export type UpdateEventInput = z.input<typeof UpdateEventInput>

export const ListEventsQuery = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  status: z.enum(['draft', 'published', 'closed', 'finished', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ListEventsQuery = z.input<typeof ListEventsQuery>
