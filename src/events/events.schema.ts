import { z } from 'zod';

const dateInput = z.union([z.string().min(1), z.date()]);

export const createEventSchema = z.object({
  artistId: z.string().min(1),
  name: z.string().min(1),
  startAt: dateInput,
  city: z.string().min(1),
  country: z.string().min(1),
  venueId: z.string().min(1).optional().nullable(),
  endAt: dateInput.optional().nullable(),
  timezone: z.string().min(1).optional().nullable(),
  continent: z.string().min(1).optional().nullable(),
  ticketUrl: z.string().url().optional().nullable(),
  priceMin: z.number().positive().optional().nullable(),
  priceMax: z.number().positive().optional().nullable(),
  currency: z.string().min(1).optional().nullable(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
