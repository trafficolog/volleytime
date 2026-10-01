import { z } from 'zod'

const pricingFields = {
  priceMode: z.enum(['fixed', 'split']).default('fixed'),
  price: z.number().int().min(0).max(2147483647).default(0),
  targetAmount: z.number().int().min(1).max(2147483647).nullable().default(null),
}

function validPricing(data: {
  priceMode: 'fixed' | 'split'
  price: number
  targetAmount: number | null
}): boolean {
  return data.priceMode === 'split'
    ? data.price === 0 && data.targetAmount !== null
    : data.targetAmount === null
}

export const EventPricingInput = z.object(pricingFields).refine(validPricing, {
  message: 'Split requires price=0 and a target; fixed cannot contain a split target',
  path: ['targetAmount'],
})

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
    ...pricingFields,
    // валюта события = валюта организации (6.8.8); передавать не обязательно
    currency: z.string().length(3).optional(),
    cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .strict()
  .refine(validPricing, {
    message: 'Invalid event pricing mode, price or target',
    path: ['targetAmount'],
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
export type CreateEventInput = z.input<typeof CreateEventInput>

export const UpdateEventInput = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    venueId: z.number().int().positive().nullable().optional(),
    locationText: z.string().max(300).nullable().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    capacity: z.number().int().positive().max(500).optional(),
    priceMode: pricingFields.priceMode.removeDefault().optional(),
    price: pricingFields.price.removeDefault().optional(),
    targetAmount: pricingFields.targetAmount.removeDefault().optional(),
    cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
    status: z.enum(['draft', 'published', 'closed', 'finished']).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.priceMode === 'fixed' && data.targetAmount != null) return false
      if (
        data.priceMode === 'split' &&
        ((data.price !== undefined && data.price !== 0) || data.targetAmount === null)
      )
        return false
      return true
    },
    { message: 'Invalid event pricing mode, price or target', path: ['targetAmount'] },
  )
export type UpdateEventInput = z.input<typeof UpdateEventInput>

export const ListEventsQuery = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  status: z.enum(['draft', 'published', 'closed', 'finished', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ListEventsQuery = z.input<typeof ListEventsQuery>
